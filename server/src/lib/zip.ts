// Minimal ZIP archive builder (STORE method, no compression) with no dependencies.
// Suitable because the contents are mostly already-compressed media. Everything is
// built in memory (Buffer) — TeleDrive files are already downloaded into a buffer
// before being archived. Note: ZIP64 is not supported, so the total archive is
// assumed to be < 4 GB.

export interface ZipEntry {
  name: string;
  data: Buffer;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Avoid duplicate names within a single archive: "foto.png", "foto (1).png", etc.
function dedupeNames(entries: ZipEntry[]): ZipEntry[] {
  const seen = new Map<string, number>();
  return entries.map((e) => {
    const lower = e.name.toLowerCase();
    const count = seen.get(lower) ?? 0;
    seen.set(lower, count + 1);
    if (count === 0) return e;
    const dot = e.name.lastIndexOf('.');
    const name = dot > 0 ? `${e.name.slice(0, dot)} (${count})${e.name.slice(dot)}` : `${e.name} (${count})`;
    return { name, data: e.data };
  });
}

export function makeZip(rawEntries: ZipEntry[]): Buffer {
  const entries = dedupeNames(rawEntries);
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // signature
    local.writeUInt16LE(20, 4);         // version needed
    local.writeUInt16LE(0x0800, 6);     // flag: UTF-8 name
    local.writeUInt16LE(0, 8);          // method: STORE
    local.writeUInt16LE(0, 10);         // mod time
    local.writeUInt16LE(0x21, 12);      // mod date (1980-01-01)
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(size, 18);      // compressed size
    local.writeUInt32LE(size, 22);      // uncompressed size
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);         // extra length
    locals.push(local, nameBuf, entry.data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // signature
    central.writeUInt16LE(20, 4);         // version made by
    central.writeUInt16LE(20, 6);         // version needed
    central.writeUInt16LE(0x0800, 8);     // flag: UTF-8 name
    central.writeUInt16LE(0, 10);         // method
    central.writeUInt16LE(0, 12);         // mod time
    central.writeUInt16LE(0x21, 14);      // mod date
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(size, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);         // extra length
    central.writeUInt16LE(0, 32);         // comment length
    central.writeUInt16LE(0, 34);         // disk number start
    central.writeUInt16LE(0, 36);         // internal attrs
    central.writeUInt32LE(0, 38);         // external attrs
    central.writeUInt32LE(offset, 42);    // offset of local header
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + size;
  }

  const centralStart = offset;
  const centralBuf = Buffer.concat(centrals);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // signature
  end.writeUInt16LE(0, 4);          // disk number
  end.writeUInt16LE(0, 6);          // disk with central dir
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(centralStart, 16);
  end.writeUInt16LE(0, 20);         // comment length

  return Buffer.concat([...locals, centralBuf, end]);
}
