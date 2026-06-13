export interface FolderItem {
  id: number;
  name: string;
  parent_id: number | null;
  created_at: string;
  deleted_at?: string | null;
}

export interface FileItem {
  id: number;
  name: string;
  folder_id: number | null;
  size: number;
  mime_type: string;
  tg_message_id: number;
  created_at: string;
  deleted_at?: string | null;
}

export interface Stats {
  totalFiles: number;
  totalBytes: number;
}

export type SortKey = 'name' | 'date' | 'size';
export type SortDir = 'asc' | 'desc';

export type ItemKind = 'file' | 'folder';

// Item currently being moved (used by MoveModal)
export type MovingItem =
  | { kind: 'folder'; id: number; name: string }
  | { kind: 'file'; id: number; name: string };

// Unique item key for the selection set (e.g. "file:12", "folder:3").
export const selKey = (kind: ItemKind, id: number): string => `${kind}:${id}`;

export interface SetupStatus {
  configured: boolean;
  account: { name: string | null; phone: string | null } | null;
}
