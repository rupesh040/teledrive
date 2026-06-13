import type { DB } from './index.js';

export interface Folder {
  id: number;
  name: string;
  parent_id: number | null;
  created_at: string;
  deleted_at?: string | null;
}

export function makeFolderRepo(db: DB) {
  return {
    create(name: string, parentId: number | null): Folder {
      const now = new Date().toISOString();
      const info = db
        .prepare('INSERT INTO folders (name, parent_id, created_at) VALUES (?, ?, ?)')
        .run(name, parentId, now);
      return { id: Number(info.lastInsertRowid), name, parent_id: parentId, created_at: now };
    },
    listByParent(parentId: number | null): Folder[] {
      const sql = parentId === null
        ? 'SELECT * FROM folders WHERE parent_id IS NULL AND deleted_at IS NULL ORDER BY name'
        : 'SELECT * FROM folders WHERE parent_id = ? AND deleted_at IS NULL ORDER BY name';
      const stmt = db.prepare(sql);
      return (parentId === null ? stmt.all() : stmt.all(parentId)) as unknown as Folder[];
    },
    listAll(): Folder[] {
      return db.prepare('SELECT * FROM folders WHERE deleted_at IS NULL ORDER BY name').all() as unknown as Folder[];
    },
    // Search active folders by name, across the entire drive.
    search(q: string): Folder[] {
      return db
        .prepare("SELECT * FROM folders WHERE deleted_at IS NULL AND name LIKE ? ESCAPE '\\' ORDER BY name")
        .all(`%${q}%`) as unknown as Folder[];
    },
    getById(id: number): Folder | undefined {
      return db.prepare('SELECT * FROM folders WHERE id = ?').get(id) as unknown as Folder | undefined;
    },
    rename(id: number, name: string): void {
      db.prepare('UPDATE folders SET name = ? WHERE id = ?').run(name, id);
    },
    // Move a folder to a new parent. Rejects if the target is itself or one
    // of its descendants (would create a cycle & break the tree).
    move(id: number, parentId: number | null): void {
      if (parentId !== null) {
        if (parentId === id || this.descendantFolderIds(id).includes(parentId)) {
          throw new Error('Cannot move a folder into itself');
        }
      }
      db.prepare('UPDATE folders SET parent_id = ? WHERE id = ?').run(parentId, id);
    },
    // IDs of this folder plus all of its subfolders (recursive), including itself.
    descendantFolderIds(folderId: number): number[] {
      const rows = db
        .prepare(
          `WITH RECURSIVE sub(id) AS (
             SELECT ?
             UNION ALL
             SELECT f.id FROM folders f JOIN sub ON f.parent_id = sub.id
           )
           SELECT id FROM sub`
        )
        .all(folderId) as unknown as Array<{ id: number }>;
      return rows.map((r) => r.id);
    },
    // Move a folder + all its subfolders & files into the trash (recursive).
    // Does not delete from Telegram — only sets deleted_at.
    softDeleteSubtree(id: number): void {
      const now = new Date().toISOString();
      const ids = this.descendantFolderIds(id);
      const placeholders = ids.map(() => '?').join(',');
      db.prepare(`UPDATE folders SET deleted_at = ? WHERE id IN (${placeholders})`).run(now, ...ids);
      db.prepare(`UPDATE files SET deleted_at = ? WHERE folder_id IN (${placeholders}) AND deleted_at IS NULL`).run(now, ...ids);
    },
    // Restore a folder + all its contents from the trash.
    restoreSubtree(id: number): void {
      const ids = this.descendantFolderIds(id);
      const placeholders = ids.map(() => '?').join(',');
      db.prepare(`UPDATE folders SET deleted_at = NULL WHERE id IN (${placeholders})`).run(...ids);
      db.prepare(`UPDATE files SET deleted_at = NULL WHERE folder_id IN (${placeholders})`).run(...ids);
    },
    // "Top-level" folders in the trash: their parent is not also trashed.
    listTrash(): Folder[] {
      return db
        .prepare(
          `SELECT c.* FROM folders c
           LEFT JOIN folders p ON c.parent_id = p.id
           WHERE c.deleted_at IS NOT NULL AND (c.parent_id IS NULL OR p.deleted_at IS NULL)
           ORDER BY c.deleted_at DESC`
        )
        .all() as unknown as Folder[];
    },
    remove(id: number): void {
      db.prepare('DELETE FROM folders WHERE id = ?').run(id);
    },
    // All tg_message_id of files in this folder AND all its subfolders
    // (recursive). Used to delete files from Telegram before the folder is
    // removed from the DB (cascade), so no orphan files are left on Telegram.
    descendantFileMessageIds(folderId: number): number[] {
      const rows = db
        .prepare(
          `WITH RECURSIVE sub(id) AS (
             SELECT ?
             UNION ALL
             SELECT f.id FROM folders f JOIN sub ON f.parent_id = sub.id
           )
           SELECT tg_message_id FROM files WHERE folder_id IN (SELECT id FROM sub)`
        )
        .all(folderId) as unknown as Array<{ tg_message_id: number }>;
      return rows.map((r) => r.tg_message_id);
    },
  };
}
