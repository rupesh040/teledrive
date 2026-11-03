import express from 'express';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { serveFrontend } from '../src/http/frontend.js';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { await Promise.all(cleanup.splice(0).map(fn => fn())); });
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'teledrive-static-'));
  await mkdir(join(root, 'assets'));
  await Promise.all([
    writeFile(join(root, 'index.html'), '<html>TeleDrive app</html>'),
    writeFile(join(root, 'sw.js'), '/* public worker */'),
    writeFile(join(root, 'manifest.webmanifest'), '{}'),
    writeFile(join(root, 'assets', 'app-hash.js'), '/* built chunk */'),
  ]);
  const app = express();
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  serveFrontend(app, root);
  const server = await new Promise<ReturnType<typeof app.listen>>(resolve => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No port');
  cleanup.push(async () => {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (!root.startsWith(join(tmpdir(), 'teledrive-static-'))) throw new Error('Unexpected test directory');
    await rm(root, { recursive: true, force: true });
  });
  return (path: string, init?: RequestInit) => fetch(`http://127.0.0.1:${address.port}${path}`, init);
}

describe('one-service production hosting', () => {
  it('serves the app shell for UI navigation while API routes stay JSON', async () => {
    const request = await fixture();
    expect(await (await request('/drive', { headers: { Accept: 'text/html' } })).text()).toContain('TeleDrive app');
    expect(await (await request('/api/health')).json()).toEqual({ ok: true });
    const missing = await request('/api/missing');
    expect(missing.status).toBe(404);
    expect(missing.headers.get('Content-Type')).toContain('application/json');
  });
  it('keeps install metadata fresh, caches hashed assets, and never serves HTML as missing JavaScript', async () => {
    const request = await fixture();
    for (const path of ['/', '/sw.js', '/manifest.webmanifest']) {
      expect((await request(path)).headers.get('Cache-Control')).toBe('no-cache');
    }
    expect((await request('/sw.js')).headers.get('Service-Worker-Allowed')).toBe('/');
    expect((await request('/assets/app-hash.js')).headers.get('Cache-Control')).toContain('immutable');
    expect((await request('/assets/missing.js')).status).toBe(404);
  });
});
