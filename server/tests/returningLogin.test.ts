import express from 'express';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAuthRouter, createAccountRouter } from '../src/auth/routes.js';
import { createTokenStore, REMEMBERED_SESSION_TTL_MS, SESSION_TTL_MS } from '../src/auth/tokens.js';
import { makeReturningLoginFlow } from '../src/telegram/returningLogin.js';

const closers: (() => Promise<unknown>)[] = [];
afterEach(async () => { await Promise.all(closers.splice(0).map(close => close())); });

function rpc(message: string, seconds?: number) { return Object.assign(new Error(message), { errorMessage: message, seconds }); }
async function setup(options: { password?: boolean; identity?: string; sendError?: unknown } = {}) {
  let time = 1000;
  const account = { api_id: 123, api_hash: 'not-a-real-hash', account_name: 'Test', account_phone: '15551234567' };
  const repo = { isConfigured: vi.fn(() => true), get: vi.fn(() => account), verifyPin: vi.fn(pin => pin === '1234'), clearAll: vi.fn() };
  const tokens = createTokenStore(() => time);
  const clients: ReturnType<typeof makeClient>[] = [];
  function makeClient() {
    const client = {
      connected: false,
      connect: vi.fn(async () => { client.connected = true; }),
      disconnect: vi.fn(async () => { client.connected = false; }),
      logOut: vi.fn(async () => {}),
      sendCode: vi.fn(async () => { if (options.sendError) throw options.sendError; return { phoneCodeHash: 'test-code-hash' }; }),
      signIn: vi.fn(async ({ phoneCode }: { phoneCode: string }) => {
        if (phoneCode !== '12345') throw rpc('PHONE_CODE_INVALID');
        if (options.password) throw rpc('SESSION_PASSWORD_NEEDED');
      }),
      signInPassword: vi.fn(async ({ password }: { password: string }) => { if (password !== 'test-password') throw rpc('PASSWORD_HASH_INVALID'); }),
      getMe: vi.fn(async () => ({ firstName: 'Test', phone: options.identity ?? account.account_phone })),
      session: { save: vi.fn(() => 'must-not-be-saved') },
    };
    clients.push(client);
    return client;
  }
  const flow = makeReturningLoginFlow({ repo, makeClient, issueToken: tokens.issueToken, now: () => time });
  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter({ repo, tokens, telegramLogin: flow, now: () => time }));
  app.use('/api/account', createAccountRouter({ repo, tokens, disconnectClient: vi.fn(async () => {}) }));
  const server: Server = await new Promise(resolve => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test port');
  const base = `http://127.0.0.1:${address.port}`;
  closers.push(async () => { await flow.dispose(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  async function post(path: string, body: unknown = {}, token?: string) {
    const response = await fetch(`${base}/api/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    return { status: response.status, headers: response.headers, body: await response.json() };
  }
  async function session(token?: string) {
    const response = await fetch(`${base}/api/auth/session`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    return response.json();
  }
  const start = (remember = false) => post('auth/telegram/start', { phone: '+1 (555) 123-4567', remember });
  return { repo, tokens, flow, clients, post, session, start, advance: (ms: number) => { time += ms; } };
}

describe('returning Telegram login over HTTP', () => {
  it('proves phone ownership, consumes proof, and keeps saved storage untouched', async () => {
    const c = await setup();
    expect(await c.session()).toEqual({ authenticated: false, configured: true, account: null, phoneSignupAvailable: false });
    const started = await c.start();
    expect(started.status).toBe(200);
    expect(started.body).toMatchObject({ needs: 'code', retryAfter: 60 });
    const verified = await c.post('auth/telegram/verify', { loginId: started.body.loginId, code: '12345' });
    expect(verified.status).toBe(200);
    expect(c.tokens.isValidToken(verified.body.token)).toBe(true);
    expect(await c.session(verified.body.token)).toEqual({ authenticated: true, configured: true, account: { name: 'Test', phone: '15551234567' }, phoneSignupAvailable: false });
    expect(c.clients[0].session.save).not.toHaveBeenCalled();
    expect(c.clients[0].logOut).toHaveBeenCalledOnce();
    expect(c.clients[0].disconnect).toHaveBeenCalledOnce();
    expect((await c.post('auth/telegram/verify', { loginId: started.body.loginId, code: '12345' })).body.code).toBe('LOGIN_EXPIRED');
    expect(c.repo.clearAll).not.toHaveBeenCalled();
  });

  it('requires a valid code before two-step password and issues no early token', async () => {
    const c = await setup({ password: true });
    const { body } = await c.start(true);
    expect((await c.post('auth/telegram/password', { loginId: body.loginId, password: 'test-password' })).body.code).toBe('INVALID_PHASE');
    expect((await c.post('auth/telegram/verify', { loginId: body.loginId, code: '00000' })).body.code).toBe('INVALID_CODE');
    expect((await c.post('auth/telegram/verify', { loginId: body.loginId, code: '12345' })).body).toEqual({ needs: 'password' });
    expect((await c.post('auth/telegram/password', { loginId: body.loginId, password: 'wrong' })).body.code).toBe('INVALID_PASSWORD');
    const result = await c.post('auth/telegram/password', { loginId: body.loginId, password: 'test-password' });
    expect(result.status).toBe(200);
    c.advance(SESSION_TTL_MS + 1);
    expect(c.tokens.isValidToken(result.body.token)).toBe(true);
    c.advance(REMEMBERED_SESSION_TTL_MS);
    expect(c.tokens.isValidToken(result.body.token)).toBe(false);
  });

  it('rejects another phone before contacting Telegram and verifies returned Telegram identity', async () => {
    const c = await setup({ identity: '15559876543' });
    expect((await c.post('auth/telegram/start', { phone: '+15559876543' })).body.code).toBe('ACCOUNT_MISMATCH');
    expect(c.clients).toHaveLength(0);
    const started = await c.start();
    const verified = await c.post('auth/telegram/verify', { loginId: started.body.loginId, code: '12345' });
    expect(verified.body.code).toBe('ACCOUNT_MISMATCH');
    expect(verified.body.token).toBeUndefined();
    expect(c.clients[0].logOut).toHaveBeenCalled();
    expect(c.repo.clearAll).not.toHaveBeenCalled();
  });

  it('enforces send cooldown even when an old challenge is cancelled', async () => {
    const c = await setup();
    const started = await c.start();
    await c.post('auth/telegram/cancel', { loginId: started.body.loginId });
    expect(c.clients[0].disconnect).toHaveBeenCalledOnce();
    const blocked = await c.start();
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBe('60');
    expect(c.clients).toHaveLength(1);
    expect((await c.post('auth/telegram/verify', { loginId: started.body.loginId, code: '12345' })).body.code).toBe('LOGIN_EXPIRED');
    c.advance(60000);
    expect((await c.start()).status).toBe(200);
  });

  it('expires challenges and disconnects their clients', async () => {
    const c = await setup();
    const started = await c.start();
    c.advance(5 * 60000 + 1);
    const expired = await c.post('auth/telegram/verify', { loginId: started.body.loginId, code: '12345' });
    expect(expired.body.code).toBe('LOGIN_EXPIRED');
    expect(c.clients[0].disconnect).toHaveBeenCalledOnce();
  });

  it('invalidates a proof after five failures and enforces a new cooldown', async () => {
    const c = await setup();
    const started = await c.start();
    c.advance(61000);
    for (let i = 0; i < 4; i++) expect((await c.post('auth/telegram/verify', { loginId: started.body.loginId, code: '00000' })).body.code).toBe('INVALID_CODE');
    const final = await c.post('auth/telegram/verify', { loginId: started.body.loginId, code: '00000' });
    expect(final.status).toBe(429);
    expect(final.body.code).toBe('TOO_MANY_ATTEMPTS');
    expect((await c.start()).status).toBe(429);
    expect(c.clients[0].disconnect).toHaveBeenCalledOnce();
  });

  it('maps Telegram flood wait without leaking raw errors', async () => {
    const c = await setup({ sendError: rpc('FLOOD_WAIT_120', 120) });
    const result = await c.start();
    expect(result.status).toBe(429);
    expect(result.body).toMatchObject({ code: 'FLOOD_WAIT', retryAfter: 120 });
    expect(result.headers.get('Retry-After')).toBe('120');
    expect(c.clients[0].disconnect).toHaveBeenCalledOnce();
  });

  it('does not issue a token if verification was cancelled while reading identity', async () => {
    const c = await setup();
    const started = await c.start();
    let resolveIdentity!: (value: { firstName: string; phone: string }) => void;
    c.clients[0].getMe.mockImplementation(() => new Promise(resolve => { resolveIdentity = resolve; }));
    const verification = c.post('auth/telegram/verify', { loginId: started.body.loginId, code: '12345' });
    await vi.waitFor(() => expect(c.clients[0].getMe).toHaveBeenCalled());
    const simultaneous = await c.post('auth/telegram/verify', { loginId: started.body.loginId, code: '12345' });
    expect(simultaneous.body.code).toBe('LOGIN_BUSY');
    await c.post('auth/telegram/cancel', { loginId: started.body.loginId });
    resolveIdentity({ firstName: 'Test', phone: '15551234567' });
    const result = await verification;
    expect(result.body.code).toBe('LOGIN_EXPIRED');
    expect(result.body.token).toBeUndefined();
  });

  it('supports PIN fallback, expires default sessions, and signs out only the supplied token', async () => {
    const c = await setup();
    expect((await c.post('auth/login', { phone: '+15551234567', pin: '0000' })).body.code).toBe('INVALID_PIN');
    const first = await c.post('auth/login', { phone: '+15551234567', pin: '1234' });
    const second = await c.post('auth/login', { phone: '+15551234567', pin: '1234' });
    await c.post('account/logout', {}, first.body.token);
    expect(c.tokens.isValidToken(first.body.token)).toBe(false);
    expect(c.tokens.isValidToken(second.body.token)).toBe(true);
    expect(c.repo.clearAll).not.toHaveBeenCalled();
    expect(c.repo.isConfigured()).toBe(true);
    c.advance(SESSION_TTL_MS);
    expect(c.tokens.isValidToken(second.body.token)).toBe(false);
    expect((await c.post('auth/logout', {}, second.body.token)).status).toBe(200);
  });
});
