import express from 'express';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAuthRouter, createAccountRouter } from '../src/auth/routes.js';
import { createSetupRouter } from '../src/auth/setupRoutes.js';
import { createTokenStore, REMEMBERED_SESSION_TTL_MS, SESSION_TTL_MS } from '../src/auth/tokens.js';
import { makeLoginFlow } from '../src/telegram/loginFlow.js';
import type { NewAccount } from '../src/db/appConfig.js';

const closers: (() => Promise<unknown>)[] = [];
afterEach(async () => { await Promise.all(closers.splice(0).map(close => close())); });
const PHONE = '+15551234567';
const CREDENTIALS = { apiId: 123, apiHash: 'a'.repeat(32) };
async function fixture(initiallyConfigured = true, serverCredentials = true) {
  let configured = initiallyConfigured;
  let time = 1000;
  let saved: NewAccount | null = initiallyConfigured
    ? { ...CREDENTIALS, session: 'saved-session', channelId: 'saved-channel', name: 'Test Account', phone: PHONE, pin: '1234' } : null;
  const repo = {
    isConfigured: () => configured,
    get: () => saved ? { account_name: saved.name, account_phone: saved.phone } : undefined,
    verifyPin: vi.fn((pin: string) => saved?.pin === pin),
    completeSetup: vi.fn((account: NewAccount) => { if (configured) throw new Error('Already configured'); saved = account; configured = true; }),
    clearAll: vi.fn(),
  };
  const sendCode = vi.fn(async () => ({ phoneCodeHash: 'test-hash' }));
  const loginFlow = makeLoginFlow({
    repo, now: () => time, createChannel: async () => 'new-channel',
    makeClient: () => ({
      connected: true, connect: async () => {}, disconnect: async () => {}, logOut: async () => {}, sendCode,
      signIn: async ({ phoneCode }) => { if (phoneCode !== '12345') throw Object.assign(new Error(), { errorMessage: 'PHONE_CODE_INVALID' }); },
      signInPassword: async () => {}, getMe: async () => ({ firstName: 'Test Account', phone: PHONE }),
      session: { save: () => 'verified-session' },
    }),
  });
  const tokens = createTokenStore(() => time);
  const credentials = () => serverCredentials ? CREDENTIALS : null;
  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter({ repo, tokens, now: () => time, phoneSignupAvailable: () => credentials() !== null }));
  app.use('/api/setup', createSetupRouter({ repo, loginFlow, credentials, tokens }));
  app.use('/api/account', createAccountRouter({ repo, tokens, disconnectClient: vi.fn(async () => {}) }));
  const server: Server = await new Promise(resolve => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test port');
  closers.push(async () => { await loginFlow.dispose(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  const request = async (path: string, body?: unknown, token?: string) => {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, headers: response.headers, body: await response.json() };
  };
  async function signup() {
    const started = await request('setup/start', { phone: PHONE });
    expect(started.status).toBe(200);
    const loginId = started.body.loginId;
    expect((await request('setup/verify', { loginId, code: '12345' })).body.needs).toBe('pin');
    return loginId;
  }
  return { repo, tokens, request, signup, sendCode, advance: (ms: number) => { time += ms; } };
}

describe('phone account setup and browser sessions', () => {
  it('signs up with a phone only, keeps credentials server-side, and starts a remembered browser session', async () => {
    const c = await fixture(false);
    const start = await c.request('setup/start', { phone: PHONE, apiId: 999, apiHash: 'user-supplied-must-be-ignored' });
    expect(start.status).toBe(200);
    expect(c.sendCode).toHaveBeenCalledWith(CREDENTIALS, PHONE);
    expect(c.repo.completeSetup).not.toHaveBeenCalled();
    expect(JSON.stringify(start.body)).not.toContain(CREDENTIALS.apiHash);
    const loginId = start.body.loginId;
    expect((await c.request('setup/pin', { loginId, pin: '1234' })).body.code).toBe('INVALID_PHASE');
    await c.request('setup/verify', { loginId, code: '12345' });
    expect(c.repo.completeSetup).not.toHaveBeenCalled();
    const created = await c.request('setup/pin', { loginId, pin: '1234', remember: true });
    expect(created.body).toMatchObject({ ok: true, token: expect.any(String) });
    expect(c.repo.completeSetup).toHaveBeenCalledOnce();
    expect((await c.request('auth/session', undefined, created.body.token)).body).toMatchObject({ configured: true, authenticated: true, account: { phone: PHONE } });
    c.advance(SESSION_TTL_MS);
    expect(c.tokens.isValidToken(created.body.token)).toBe(true);
    c.advance(REMEMBERED_SESSION_TTL_MS);
    expect(c.tokens.isValidToken(created.body.token)).toBe(false);
  });

  it('requires the verified signup proof to set a PIN and forbids repeated signup after creation', async () => {
    const c = await fixture(false);
    expect((await c.request('auth/login', { phone: PHONE, pin: '1234' })).body.code).toBe('NOT_CONFIGURED');
    expect((await c.request('setup/pin', { pin: '1234' })).body.code).toBe('LOGIN_EXPIRED');
    const loginId = await c.signup();
    expect((await c.request('setup/pin', { loginId: 'unrelated', pin: '1234' })).body.code).toBe('LOGIN_EXPIRED');
    expect((await c.request('setup/pin', { loginId, pin: 'abcd' })).body.code).toBe('INVALID_PIN');
    expect(c.repo.completeSetup).not.toHaveBeenCalled();
    const created = await c.request('setup/pin', { loginId, pin: '1234' });
    expect(created.status).toBe(200);
    for (const [path, body] of [
      ['setup/start', { phone: '+15559999999' }],
      ['setup/pin', { loginId, pin: '9999' }],
      ['setup/verify', { loginId, code: '12345' }],
    ] as const) expect((await c.request(path, body)).body.code).toBe('ALREADY_CONFIGURED');
    expect(c.repo.completeSetup).toHaveBeenCalledOnce();
    expect((await c.request('auth/session')).body).toEqual({ configured: true, authenticated: false, account: null, phoneSignupAvailable: true });
    expect((await c.request('setup/status')).body.account).toBeNull();
  });

  it('does not accept browser API credentials when server phone signup is unavailable', async () => {
    const c = await fixture(false, false);
    expect((await c.request('auth/session')).body.phoneSignupAvailable).toBe(false);
    const response = await c.request('setup/start', { phone: PHONE, ...CREDENTIALS });
    expect(response.status).toBe(503);
    expect(response.body.code).toBe('SIGNUP_UNAVAILABLE');
    expect(c.sendCode).not.toHaveBeenCalled();
  });

  it('binds PIN login to the matching normalized phone and throttles incorrect identities', async () => {
    const c = await fixture();
    for (const phone of [undefined, '', '+15559999999', '15551234567']) {
      expect((await c.request('auth/login', { phone, pin: '1234' })).body.code).toBe('INVALID_PIN');
    }
    expect(c.repo.verifyPin).not.toHaveBeenCalled();
    const blocked = await c.request('auth/login', { phone: PHONE, pin: '0000' });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBe('30');
    expect((await c.request('auth/login', { phone: PHONE, pin: '1234' })).status).toBe(429);
    c.advance(30000);
    expect((await c.request('auth/login', { phone: '+1 (555) 123-4567', pin: '1234' })).status).toBe(200);
  });

  it('logout revokes only its browser token, preserves the account, and allows same-number PIN login again', async () => {
    const c = await fixture();
    const first = await c.request('auth/login', { phone: PHONE, pin: '1234' });
    const other = await c.request('auth/unlock', { phone: PHONE, pin: '1234' });
    expect((await c.request('auth/session', undefined, first.body.token)).body.account).toEqual({ name: 'Test Account', phone: PHONE });
    expect((await c.request('auth/logout', {}, first.body.token)).body).toEqual({ ok: true });
    expect((await c.request('auth/logout', {}, first.body.token)).body).toEqual({ ok: true });
    expect((await c.request('auth/session', undefined, first.body.token)).body.authenticated).toBe(false);
    expect((await c.request('auth/session', undefined, other.body.token)).body.authenticated).toBe(true);
    expect(c.repo.isConfigured()).toBe(true);
    expect(c.repo.clearAll).not.toHaveBeenCalled();
    expect((await c.request('auth/login', { phone: PHONE, pin: '1234' })).status).toBe(200);
    await c.request('auth/logout?token=' + other.body.token, {});
    expect(c.tokens.isValidToken(other.body.token)).toBe(true);
  });
});
