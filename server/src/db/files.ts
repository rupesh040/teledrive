import type { DB } from './index.js';

export interface FileRow {
  id: number;
  name: string;
  folder_id: number | null;
  size: number;
  mime_type: string;
  tg_message_id: number;
  created_at: string;
  deleted_at?: string | null;
}

export interface NewFile {
  name: string;
  folderId: number | null;
  size: number;
  mimeType: string;
  tgMessageId: number;
}

export function makeFileRepo(db: DB) {
  return {
    create(f: NewFile): FileRow {
      const now = new Date().toISOString();
      const info = db
        .prepare(
          'INSERT INTO files (name, folder_id, size, mime_type, tg_message_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run(f.name, f.folderId, f.size, f.mimeType, f.tgMessageId, now);
      return {
        id: Number(info.lastInsertRowid),
        name: f.name,
        folder_id: f.folderId,
        size: f.size,
        mime_type: f.mimeType,
        tg_message_id: f.tgMessageId,
        created_at: now,
      };
    },
    listByFolder(folderId: number | null): FileRow[] {
      const sql = folderId === null
        ? 'SELECT * FROM files WHERE folder_id IS NULL AND deleted_at IS NULL ORDER BY name'
        : 'SELECT * FROM files WHERE folder_id = ? AND deleted_at IS NULL ORDER BY name';
      const stmt = db.prepare(sql);
      return (folderId === null ? stmt.all() : stmt.all(folderId)) as unknown as FileRow[];
    },
    // Search active (not trashed) files by name, across the entire drive.
    search(q: string): FileRow[] {
      return db
        .prepare("SELECT * FROM files WHERE deleted_at IS NULL AND name LIKE ? ESCAPE '\\' ORDER BY name")
        .all(`%${q}%`) as unknown as FileRow[];
    },
    getById(id: number): FileRow | undefined {
      return db.prepare('SELECT * FROM files WHERE id = ?').get(id) as unknown as FileRow | undefined;
    },
    rename(id: number, name: string): void {
      db.prepare('UPDATE files SET name = ? WHERE id = ?').run(name, id);
    },
    move(id: number, folderId: number | null): void {
      db.prepare('UPDATE files SET folder_id = ? WHERE id = ?').run(folderId, id);
    },
    // Move to trash (does not delete from Telegram).
    softDelete(id: number): void {
      db.prepare('UPDATE files SET deleted_at = ? WHERE id = ?').run(new Date().toISOString(), id);
    },
    restore(id: number): void {
      db.prepare('UPDATE files SET deleted_at = NULL WHERE id = ?').run(id);
    },
    // "Top-level" files in the trash: their folder is not also trashed
    // (if the parent folder is also trashed, the file shows up as part of that folder).
    listTrash(): FileRow[] {
      return db
        .prepare(
          `SELECT f.* FROM files f
           LEFT JOIN folders d ON f.folder_id = d.id
           WHERE f.deleted_at IS NOT NULL AND (f.folder_id IS NULL OR d.deleted_at IS NULL)
           ORDER BY f.deleted_at DESC`
        )
        .all() as unknown as FileRow[];
    },
    remove(id: number): void {
      db.prepare('DELETE FROM files WHERE id = ?').run(id);
    },
    stats(): { totalFiles: number; totalBytes: number } {
      const row = db
        .prepare('SELECT COUNT(*) AS c, COALESCE(SUM(size), 0) AS b FROM files WHERE deleted_at IS NULL')
        .get() as { c: number; b: number };
      return { totalFiles: row.c, totalBytes: row.b };
    },
  };
}
