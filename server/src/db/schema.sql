CREATE TABLE IF NOT EXISTS folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  parent_id INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  folder_id INTEGER,
  size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  tg_message_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  api_id INTEGER,
  api_hash TEXT,
  session TEXT,
  channel_id TEXT,
  pin_hash TEXT,
  pin_salt TEXT,
  account_name TEXT,
  account_phone TEXT,
  created_at TEXT
);
