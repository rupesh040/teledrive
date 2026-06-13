import { Router } from 'express';
import multer from 'multer';
import { db } from '../db/index.js';
import { makeFileRepo } from '../db/files.js';
import { uploadFile, downloadFile, deleteMessage } from '../telegram/storage.js';
import { makeZip } from '../lib/zip.js';

const repo = makeFileRepo(db);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 * 1024 } });
export const filesRouter = Router();

// GET /api/files?folder=ID
filesRouter.get('/', (req, res) => {
  const folder = req.query.folder ? Number(req.query.folder) : null;
  res.json(repo.listByFolder(folder));
});

// GET /api/files/stats  → { totalFiles, totalBytes } for the sidebar capacity bar
filesRouter.get('/stats', (_req, res) => {
  res.json(repo.stats());
});

// GET /api/files/search?q=...  → active files whose name matches, across the whole drive
filesRouter.get('/search', (req, res) => {
  const q = String(req.query.q ?? '').trim();
  res.json(q ? repo.search(q) : []);
});

// GET /api/files/trash  → files in trash (top level)
filesRouter.get('/trash', (_req, res) => {
  res.json(repo.listTrash());
});

// GET /api/files/download-zip?ids=1,2,3  → a .zip archive containing the selected files
filesRouter.get('/download-zip', async (req, res) => {
  const ids = String(req.query.ids ?? '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length === 0) return res.status(400).json({ error: 'No files' });

  try {
    const entries = [];
    for (const id of ids) {
      const file = repo.getById(id);
      if (!file) continue;
      const data = await downloadFile(file.tg_message_id);
      entries.push({ name: file.name, data });
    }
    if (entries.length === 0) return res.status(404).json({ error: 'Not found' });

    const zip = makeZip(entries);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="teledrive.zip"');
    res.setHeader('Content-Length', String(zip.length));
    res.send(zip);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/files  (multipart: file + field folderId)
filesRouter.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File is required' });
  const folderId = req.body.folderId ? Number(req.body.folderId) : null;
  try {
    const messageId = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);
    const row = repo.create({
      name: req.file.originalname,
      folderId,
      size: req.file.size,
      mimeType: req.file.mimetype,
      tgMessageId: messageId,
    });
    res.status(201).json(row);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// GET /api/files/:id/download
filesRouter.get('/:id/download', async (req, res) => {
  const file = repo.getById(Number(req.params.id));
  if (!file) return res.status(404).json({ error: 'Not found' });
  try {
    const buffer = await downloadFile(file.tg_message_id);
    res.setHeader('Content-Type', file.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    res.send(buffer);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// GET /api/files/:id/preview  (inline, for images/videos/pdf)
filesRouter.get('/:id/preview', async (req, res) => {
  const file = repo.getById(Number(req.params.id));
  if (!file) return res.status(404).json({ error: 'Not found' });
  try {
    const buffer = await downloadFile(file.tg_message_id);
    res.setHeader('Content-Type', file.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.name)}"`);
    // The TG message content never changes → safe for the browser to cache long-term (fast thumbnails)
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    res.send(buffer);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// PATCH /api/files/:id  { name? , folderId? }  (rename and/or move)
filesRouter.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (typeof req.body.name === 'string' && req.body.name.trim()) {
    repo.rename(id, req.body.name.trim());
  }
  if ('folderId' in req.body) {
    repo.move(id, req.body.folderId == null ? null : Number(req.body.folderId));
  }
  res.json({ ok: true });
});

// DELETE /api/files/:id  → move to trash (does not delete from Telegram)
filesRouter.delete('/:id', (req, res) => {
  const file = repo.getById(Number(req.params.id));
  if (!file) return res.status(404).json({ error: 'Not found' });
  repo.softDelete(file.id);
  res.json({ ok: true });
});

// POST /api/files/:id/restore  → restore from trash
filesRouter.post('/:id/restore', (req, res) => {
  const file = repo.getById(Number(req.params.id));
  if (!file) return res.status(404).json({ error: 'Not found' });
  repo.restore(file.id);
  res.json({ ok: true });
});

// DELETE /api/files/:id/permanent  → permanently delete (from Telegram + DB)
filesRouter.delete('/:id/permanent', async (req, res) => {
  const file = repo.getById(Number(req.params.id));
  if (!file) return res.status(404).json({ error: 'Not found' });
  try {
    await deleteMessage(file.tg_message_id);
    repo.remove(file.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});
