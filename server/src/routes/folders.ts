import { Router } from 'express';
import { db } from '../db/index.js';
import { makeFolderRepo } from '../db/folders.js';
import { deleteMessage } from '../telegram/storage.js';

const repo = makeFolderRepo(db);
export const foldersRouter = Router();

// GET /api/folders?parent=ID  (empty parent = root)
foldersRouter.get('/', (req, res) => {
  const parent = req.query.parent ? Number(req.query.parent) : null;
  res.json(repo.listByParent(parent));
});

// GET /api/folders/all  → all active folders (for the move-destination picker dialog)
foldersRouter.get('/all', (_req, res) => {
  res.json(repo.listAll());
});

// GET /api/folders/search?q=...  → active folders whose name matches
foldersRouter.get('/search', (req, res) => {
  const q = String(req.query.q ?? '').trim();
  res.json(q ? repo.search(q) : []);
});

// GET /api/folders/trash  → folders in trash (top level)
foldersRouter.get('/trash', (_req, res) => {
  res.json(repo.listTrash());
});

// POST /api/folders  { name, parentId }
foldersRouter.post('/', (req, res) => {
  const { name, parentId } = req.body as { name: string; parentId: number | null };
  if (!name?.trim()) return res.status(400).json({ error: 'Folder name is required' });
  res.status(201).json(repo.create(name.trim(), parentId ?? null));
});

// PATCH /api/folders/:id  { name? , parentId? }  (rename and/or move)
foldersRouter.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  try {
    if (typeof req.body.name === 'string' && req.body.name.trim()) {
      repo.rename(id, req.body.name.trim());
    }
    if ('parentId' in req.body) {
      repo.move(id, req.body.parentId == null ? null : Number(req.body.parentId));
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// DELETE /api/folders/:id  → move the folder + its contents to trash (does not delete from TG)
foldersRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!repo.getById(id)) return res.status(404).json({ error: 'Not found' });
  repo.softDeleteSubtree(id);
  res.json({ ok: true });
});

// POST /api/folders/:id/restore  → restore the folder + its contents from trash
foldersRouter.post('/:id/restore', (req, res) => {
  const id = Number(req.params.id);
  if (!repo.getById(id)) return res.status(404).json({ error: 'Not found' });
  repo.restoreSubtree(id);
  res.json({ ok: true });
});

// DELETE /api/folders/:id/permanent
// First delete all files (recursively) from Telegram, then delete the folder from the DB
// (cascade also removes file & subfolder rows). Prevents orphaned files on TG.
foldersRouter.delete('/:id/permanent', async (req, res) => {
  const id = Number(req.params.id);
  try {
    const messageIds = repo.descendantFileMessageIds(id);
    for (const mid of messageIds) {
      await deleteMessage(mid);
    }
    repo.remove(id);
    res.json({ ok: true, deletedFiles: messageIds.length });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});
