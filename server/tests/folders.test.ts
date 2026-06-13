import { describe, it, expect, beforeEach } from 'vitest';
import { createDb } from '../src/db/index.js';
import { makeFolderRepo } from '../src/db/folders.js';
import { makeFileRepo } from '../src/db/files.js';

let db: ReturnType<typeof createDb>;
function setup() {
  db = createDb(':memory:');
  return makeFolderRepo(db);
}

describe('folders repo', () => {
  let repo: ReturnType<typeof setup>;
  beforeEach(() => { repo = setup(); });

  it('membuat folder akar dan mengembalikannya', () => {
    const f = repo.create('Foto', null);
    expect(f.id).toBeGreaterThan(0);
    expect(f.name).toBe('Foto');
    expect(f.parent_id).toBeNull();
  });

  it('list folder berdasarkan parent', () => {
    repo.create('Akar1', null);
    const akar2 = repo.create('Akar2', null);
    repo.create('Anak', akar2.id);
    expect(repo.listByParent(null)).toHaveLength(2);
    expect(repo.listByParent(akar2.id)).toHaveLength(1);
  });

  it('rename folder', () => {
    const f = repo.create('Lama', null);
    repo.rename(f.id, 'Baru');
    expect(repo.listByParent(null)[0].name).toBe('Baru');
  });

  it('hapus folder', () => {
    const f = repo.create('X', null);
    repo.remove(f.id);
    expect(repo.listByParent(null)).toHaveLength(0);
  });

  it('descendantFileMessageIds mengumpulkan file rekursif dari subfolder', () => {
    const files = makeFileRepo(db);
    const root = repo.create('Root', null);
    const sub = repo.create('Sub', root.id);
    const lain = repo.create('Lain', null);
    files.create({ name: 'a', folderId: root.id, size: 1, mimeType: 'text/plain', tgMessageId: 100 });
    files.create({ name: 'b', folderId: sub.id, size: 1, mimeType: 'text/plain', tgMessageId: 200 });
    files.create({ name: 'c', folderId: lain.id, size: 1, mimeType: 'text/plain', tgMessageId: 300 });

    const ids = repo.descendantFileMessageIds(root.id).sort((a, b) => a - b);
    expect(ids).toEqual([100, 200]); // file in the other folder (300) is not included
  });

  it('move memindahkan folder ke parent lain', () => {
    const a = repo.create('A', null);
    const b = repo.create('B', null);
    repo.move(b.id, a.id);
    expect(repo.getById(b.id)?.parent_id).toBe(a.id);
    expect(repo.listByParent(a.id)).toHaveLength(1);
    expect(repo.listByParent(null)).toHaveLength(1); // only A remains at the root
  });

  it('move menolak memindahkan folder ke dalam keturunannya (cegah siklus)', () => {
    const root = repo.create('Root', null);
    const sub = repo.create('Sub', root.id);
    expect(() => repo.move(root.id, sub.id)).toThrow();
    expect(() => repo.move(root.id, root.id)).toThrow();
    expect(repo.getById(root.id)?.parent_id).toBeNull(); // unchanged
  });
});
