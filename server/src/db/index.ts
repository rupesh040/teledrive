import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { config } from '../config.js';

// node:sqlite is a new builtin (Node 22.5+). Some bundlers (Vite/vitest)
// don't recognize it yet and fail to resolve the static 'node:sqlite' specifier.
// Loading it via createRequire with a non-literal specifier makes the bundler
// ignore it, while Node still resolves it at runtime.
const nodeRequire = createRequire(import.meta.url);
const sqliteSpecifier = 'node:sqlite';
const { DatabaseSync } = nodeRequire(sqliteSpecifier) as typeof import('node:sqlite');

export type DB = import('node:sqlite').DatabaseSync;

const __dirname = dirname(fileURLToPath(import.meta.url));

// Simple migration for old DBs: add columns that don't exist yet.
// CREATE TABLE IF NOT EXISTS does not add columns to an already-created table,
// so new columns must go through a conditional ALTER TABLE.
function migrate(db: DB): void {
  const hasColumn = (table: string, col: string): boolean =>
    (db.prepare(`PRAGMA table_info(${table})`).all() as unknown as Array<{ name: string }>)
      .some((c) => c.name === col);

  if (!hasColumn('files', 'deleted_at')) db.exec('ALTER TABLE files ADD COLUMN deleted_at TEXT');
  if (!hasColumn('folders', 'deleted_at')) db.exec('ALTER TABLE folders ADD COLUMN deleted_at TEXT');
}

export function createDb(path: string = config.dbPath): DB {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);
  migrate(db);
  return db;
}

export const db = createDb();
