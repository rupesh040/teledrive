import express, { type Express } from 'express';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

/** Serve the public production build without turning API or missing-asset errors into HTML. */
export function serveFrontend(app: Express, directory: string | undefined): void {
  if (!directory) return;
  const root = resolve(directory);
  const index = join(root, 'index.html');
  if (!existsSync(index)) throw new Error('WEB_DIST_PATH must point to a complete frontend build.');
  app.use('/api', (_req, res) => { res.status(404).json({ error: 'API route not found.' }); });
  app.use(express.static(root, {
    index: false,
    setHeaders(res, path) {
      if (path.includes(`${join(root, 'assets')}/`) || path.includes(`${join(root, 'assets')}\\`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        res.setHeader('Cache-Control', 'no-cache');
      }
      if (path === join(root, 'sw.js')) res.setHeader('Service-Worker-Allowed', '/');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  }));
  app.get('*', (req, res, next) => {
    if (extname(req.path) || !req.accepts('html')) { next(); return; }
    res.set('Cache-Control', 'no-cache');
    res.sendFile(index);
  });
}
