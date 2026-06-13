import { describe, it, expect, beforeEach } from 'vitest';
import { createDb } from '../src/db/index.js';
import { makeFileRepo } from '../src/db/files.js';
import { makeFolderRepo } from '../src/db/folders.js';

function setup() {
  const db = createDb(':memory:');
  return { files: makeFileRepo(db), folders: makeFolderRepo(db) };
}

describe('trash (soft delete)', () => {
  let files: ReturnType<typeof makeFileRepo>;
  let folders: ReturnType<typeof makeFolderRepo>;
  beforeEach(() => { ({ files, folders } = setup()); });

  it('file di sampah hilang dari listing & stats, muncul di trash', () => {
    const f = files.create({ name: 'a', folderId: null, size: 100, mimeType: 'text/plain', tgMessageId: 1 });
    files.softDelete(f.id);
    expect(files.listByFolder(null)).toHaveLength(0);
    expect(files.stats()).toEqual({ totalFiles: 0, totalBytes: 0 });
    expect(files.listTrash().map((x) => x.id)).toContain(f.id);
  });

  it('restore mengembalikan file', () => {
    const f = files.create({ name: 'a', folderId: null, size: 1, mimeType: 'text/plain', tgMessageId: 1 });
    files.softDelete(f.id);
    files.restore(f.id);
    expect(files.listByFolder(null)).toHaveLength(1);
    expect(files.listTrash()).toHaveLength(0);
  });

  it('hapus folder = soft delete folder + isinya (rekursif)', () => {
    const dir = folders.create('Dir', null);
    const sub = folders.create('Sub', dir.id);
    const f = files.create({ name: 'x', folderId: sub.id, size: 1, mimeType: 'text/plain', tgMessageId: 9 });
    folders.softDeleteSubtree(dir.id);
    expect(folders.listByParent(null)).toHaveLength(0);
    expect(files.listByFolder(sub.id)).toHaveLength(0);
    // only the top-level folder shows up in trash (Dir), not Sub
    const trashTop = folders.listTrash().map((x) => x.id);
    expect(trashTop).toContain(dir.id);
    expect(trashTop).not.toContain(sub.id);
    // files inside don't show as top-level trash items (their folder is in trash too)
    expect(files.listTrash().map((x) => x.id)).not.toContain(f.id);
  });

  it('restore folder memulihkan seluruh subtree', () => {
    const dir = folders.create('Dir', null);
    const f = files.create({ name: 'x', folderId: dir.id, size: 1, mimeType: 'text/plain', tgMessageId: 9 });
    folders.softDeleteSubtree(dir.id);
    folders.restoreSubtree(dir.id);
    expect(folders.listByParent(null)).toHaveLength(1);
    expect(files.listByFolder(dir.id).map((x) => x.id)).toContain(f.id);
  });

  it('search hanya menemukan item aktif', () => {
    const f = files.create({ name: 'laporan.pdf', folderId: null, size: 1, mimeType: 'application/pdf', tgMessageId: 1 });
    expect(files.search('lapor')).toHaveLength(1);
    files.softDelete(f.id);
    expect(files.search('lapor')).toHaveLength(0);
  });
});
