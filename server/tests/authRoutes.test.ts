import express from 'express';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAuthRouter, createAccountRouter } from '../src/auth/routes.js';
import { createSetupRouter } from '../src/auth/setupRoutes.js';
import { createTokenStore } from '../src/auth/tokens.js';

const closers: (() => Promise<void>)[] = [];
afterEach(async () => { await Promise.all(closers.splice(0).map(close => close())); });
async function fixture(initiallyConfigured = true) {
  let configured = initiallyConfigured;
  let time = 1000;
  const repo = {
    isConfigured: () => configured,
    get: () => ({ session: 'saved-session', channel_id: 'saved-channel', account_name: 'Test Account', account_phone: '15551234567' }),
    verifyPin: (pin: string) => pin === '1234',
    setPin: vi.fn((_pin: string) => { configured = true; }),
    clearAll: vi.fn(),
  };
  const loginFlow = {
    start: vi.fn(async () => ({ loginId: 'test', needs: 'code' as const })),
    verifyCode: vi.fn(async () => ({ needs: 'pin' as const })),
    verifyPassword: vi.fn(async () => ({ needs: 'pin' as const })),
  };
  const tokens = createTokenStore(() => time);
  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter({ repo, tokens, now: () => time }));
  app.use('/api/setup', createSetupRouter({ repo, loginFlow }));
  app.use('/api/account', createAccountRouter({ repo, tokens, disconnectClient: vi.fn(async () => {}) }));
  const server: Server = await new Promise(resolve => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test port');
  closers.push(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  const request = async (path: string, body?: unknown, token?: string) => {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, headers: response.headers, body: await response.json() };
  };
  return { repo, tokens, request, advance: (ms: number) => { time += ms; } };
}

describe('account setup and browser sessions', () => {
  it('validates the PIN during account creation and leaves the browser signed out', async () => {
    const c = await fixture(false);
    expect((await c.request('auth/login', { pin: '1234' })).body.code).toBe('NOT_CONFIGURED');
    expect((await c.request('setup/pin', { pin: 'abcd' })).status).toBe(400);
    expect(c.repo.setPin).not.toHaveBeenCalled();
    const created = await c.request('setup/pin', { pin: '1234' });
    expect(created.body).toEqual({ ok: true });
    expect(c.repo.setPin).toHaveBeenCalledOnce();
    expect(c.repo.setPin).toHaveBeenCalledWith('1234');
    expect((await c.request('auth/session')).body).toEqual({ configured: true, authenticated: false, account: null });
    expect((await c.request('setup/status')).body.account).toBeNull();
    expect((await c.request('auth/login', { pin: '1234' })).body.token).toBeTypeOf('string');
    expect((await c.request('setup/pin', { pin: '9999' })).status).toBe(403);
  });

  it('throttles incorrect PIN attempts and allows retry after the cooldown', async () => {
    const c = await fixture();
    for (let i = 0; i < 4; i++) expect((await c.request('auth/login', { pin: '0000' })).body.code).toBe('INVALID_PIN');
    const blocked = await c.request('auth/login', { pin: '0000' });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBe('30');
    expect((await c.request('auth/login', { pin: '1234' })).status).toBe(429);
    c.advance(30000);
    expect((await c.request('auth/login', { pin: '1234' })).status).toBe(200);
  });

  it('auth logout is idempotent, revokes only the supplied browser token and preserves account configuration', async () => {
    const c = await fixture();
    const first = await c.request('auth/login', { pin: '1234' });
    const other = await c.request('auth/unlock', { pin: '1234' });
    expect((await c.request('auth/session', undefined, first.body.token)).body.account).toEqual({ name: 'Test Account', phone: '15551234567' });
    expect((await c.request('auth/logout', {}, first.body.token)).body).toEqual({ ok: true });
    expect((await c.request('auth/logout', {}, first.body.token)).body).toEqual({ ok: true });
    expect((await c.request('auth/session', undefined, first.body.token)).body.authenticated).toBe(false);
    expect((await c.request('auth/session', undefined, other.body.token)).body.authenticated).toBe(true);
    expect(c.repo.isConfigured()).toBe(true);
    expect(c.repo.clearAll).not.toHaveBeenCalled();
    expect((await c.request('auth/logout?token=' + other.body.token, {})).status).toBe(200);
    expect(c.tokens.isValidToken(other.body.token)).toBe(true);
  });
});
