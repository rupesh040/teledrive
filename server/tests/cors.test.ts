import express from 'express';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCors } from '../src/http/cors.js';

const closers: (() => Promise<void>)[] = [];
afterEach(async () => { await Promise.all(closers.splice(0).map(close => close())); });

async function fixture(allowedOrigins: string[]) {
  const app = express();
  const mutate = vi.fn();
  app.use(createCors(allowedOrigins));
  app.use(express.json());
  app.all('/api/test', (_req, res) => {
    mutate();
    res.set('Retry-After', '30');
    res.set('Content-Disposition', 'attachment; filename="example.txt"');
    res.json({ ok: true });
  });
  const server: Server = await new Promise(resolve => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test port');
  closers.push(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  return {
    mutate,
    request: (init?: RequestInit) => fetch(`http://127.0.0.1:${address.port}/api/test`, init),
  };
}

describe('separately hosted frontend access', () => {
  it('answers an allowed preflight without invoking the route or accepting credential cookies', async () => {
    const c = await fixture(['https://drive.example.com']);
    const response = await c.request({ method: 'OPTIONS', headers: {
      Origin: 'https://drive.example.com',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type',
    } });
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://drive.example.com');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Authorization, Content-Type');
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull();
    expect(response.headers.get('Vary')).toContain('Origin');
    expect(c.mutate).not.toHaveBeenCalled();
  });

  it('allows the exact frontend origin and exposes retry and download headers', async () => {
    const c = await fixture(['https://drive.example.com', 'https://drive-preview.vercel.app']);
    const response = await c.request({ method: 'POST', headers: { Origin: 'https://drive-preview.vercel.app', 'Content-Type': 'application/json', Authorization: 'Bearer test' }, body: '{}' });
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://drive-preview.vercel.app');
    expect(response.headers.get('Access-Control-Expose-Headers')).toBe('Retry-After, Content-Disposition');
    expect(response.headers.get('Retry-After')).toBe('30');
    expect(c.mutate).toHaveBeenCalledOnce();
  });

  it.each(['https://drive.example.com.attacker.test', 'https://attacker.test', 'null'])('rejects disallowed Origin %s before a POST can mutate data', async origin => {
    const c = await fixture(['https://drive.example.com']);
    const response = await c.request({ method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{}' });
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('ORIGIN_NOT_ALLOWED');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(c.mutate).not.toHaveBeenCalled();
  });

  it('allows originless server clients without adding browser access headers', async () => {
    const c = await fixture(['https://drive.example.com']);
    const response = await c.request();
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('preserves local same-origin behavior while leaving CORS disabled when no allowlist is configured', async () => {
    const c = await fixture([]);
    const response = await c.request({ method: 'POST', headers: { Origin: 'http://localhost:5173' } });
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it.each(['*', 'https://*.vercel.app', 'https://drive.example.com/api', 'https://user:password@drive.example.com', 'file:///tmp/drive'])('rejects unsafe allowlist configuration %s', origin => {
    expect(() => createCors([origin])).toThrow(/ALLOWED_ORIGINS/);
  });
});
