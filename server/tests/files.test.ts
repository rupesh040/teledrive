import { describe, it, expect, beforeEach } from 'vitest';
import { createDb } from '../src/db/index.js';
import { makeFileRepo } from '../src/db/files.js';
import { makeFolderRepo } from '../src/db/folders.js';

function setup() {
  const db = createDb(':memory:');
  return { repo: makeFileRepo(db), folders: makeFolderRepo(db) };
}

describe('files repo', () => {
  let repo: ReturnType<typeof makeFileRepo>;
  let folders: ReturnType<typeof makeFolderRepo>;
  beforeEach(() => { ({ repo, folders } = setup()); });

  it('membuat metadata file', () => {
    const f = repo.create({
      name: 'a.png', folderId: null, size: 1024,
      mimeType: 'image/png', tgMessageId: 55,
    });
    expect(f.id).toBeGreaterThan(0);
    expect(f.tg_message_id).toBe(55);
  });

  it('list file per folder', () => {
    const dir = folders.create('Dir', null);
    repo.create({ name: 'akar.txt', folderId: null, size: 1, mimeType: 'text/plain', tgMessageId: 1 });
    repo.create({ name: 'dalam.txt', folderId: dir.id, size: 1, mimeType: 'text/plain', tgMessageId: 2 });
    expect(repo.listByFolder(null)).toHaveLength(1);
    expect(repo.listByFolder(dir.id)).toHaveLength(1);
  });

  it('getById mengembalikan file', () => {
    const f = repo.create({ name: 'x', folderId: null, size: 1, mimeType: 'text/plain', tgMessageId: 7 });
    expect(repo.getById(f.id)?.tg_message_id).toBe(7);
  });

  it('lists active files across folders, excluding trash', () => {
    const dir = folders.create('Projects', null);
    repo.create({ name: 'root.txt', folderId: null, size: 1, mimeType: 'text/plain', tgMessageId: 10 });
    repo.create({ name: 'nested.txt', folderId: dir.id, size: 1, mimeType: 'text/plain', tgMessageId: 11 });
    const removed = repo.create({ name: 'removed.txt', folderId: null, size: 1, mimeType: 'text/plain', tgMessageId: 12 });
    repo.softDelete(removed.id);
    expect(repo.listAll().map((file) => file.name).sort()).toEqual(['nested.txt', 'root.txt']);
  });

  it('rename & hapus file', () => {
    const f = repo.create({ name: 'lama', folderId: null, size: 1, mimeType: 'text/plain', tgMessageId: 3 });
    repo.rename(f.id, 'baru');
    expect(repo.getById(f.id)?.name).toBe('baru');
    repo.remove(f.id);
    expect(repo.getById(f.id)).toBeUndefined();
  });

  it('stats menjumlah file & byte', () => {
    repo.create({ name: 'a', folderId: null, size: 100, mimeType: 'text/plain', tgMessageId: 1 });
    repo.create({ name: 'b', folderId: null, size: 250, mimeType: 'text/plain', tgMessageId: 2 });
    expect(repo.stats()).toEqual({ totalFiles: 2, totalBytes: 350 });
  });

  it('move memindahkan file ke folder lain (dan kembali ke akar)', () => {
    const dir = folders.create('Dir', null);
    const f = repo.create({ name: 'x', folderId: null, size: 1, mimeType: 'text/plain', tgMessageId: 9 });
    repo.move(f.id, dir.id);
    expect(repo.getById(f.id)?.folder_id).toBe(dir.id);
    expect(repo.listByFolder(dir.id)).toHaveLength(1);
    repo.move(f.id, null);
    expect(repo.getById(f.id)?.folder_id).toBeNull();
  });
});
