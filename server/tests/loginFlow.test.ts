import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDb } from '../src/db/index.js';
import { makeAppConfigRepo } from '../src/db/appConfig.js';
import { makeLoginFlow } from '../src/telegram/loginFlow.js';

const PHONE = '+15551234567';
const API_HASH = 'a'.repeat(32);
const closers: (() => Promise<unknown>)[] = [];
afterEach(async () => { await Promise.all(closers.splice(0).map(close => close())); });
function rpc(errorMessage: string) { return Object.assign(new Error(errorMessage), { errorMessage }); }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function setup(options: { needPassword?: boolean; identity?: string; sendError?: unknown } = {}) {
  const db = createDb(':memory:');
  const repo = makeAppConfigRepo(db);
  let time = 1000;
  const clients: ReturnType<typeof makeClient>[] = [];
  function makeClient() {
    const client = {
      connected: false,
      connect: vi.fn(async () => { client.connected = true; }),
      disconnect: vi.fn(async () => { client.connected = false; }),
      logOut: vi.fn(async () => {}),
      sendCode: vi.fn(async () => { if (options.sendError) throw options.sendError; return { phoneCodeHash: 'HASH' }; }),
      signIn: vi.fn(async ({ phoneCode }: { phoneCode: string }) => {
        if (phoneCode !== '11111') throw rpc('PHONE_CODE_INVALID');
        if (options.needPassword) throw rpc('SESSION_PASSWORD_NEEDED');
      }),
      signInPassword: vi.fn(async ({ password }: { password: string }) => { if (password !== 'correct-password') throw rpc('PASSWORD_HASH_INVALID'); }),
      getMe: vi.fn(async () => ({ firstName: 'Test Account', phone: options.identity ?? '15551234567' })),
      session: { save: vi.fn(() => `SESSION_${clients.length}`) },
    };
    clients.push(client);
    return client;
  }
  const createChannel = vi.fn(async () => '999');
  const flow = makeLoginFlow({ repo, makeClient, createChannel, now: () => time });
  closers.push(async () => { await flow.dispose(); db.close(); });
  const start = () => flow.start(123, API_HASH, PHONE);
  async function verify() { const { loginId } = await start(); await flow.verifyCode(loginId, '11111'); return loginId; }
  return { db, repo, flow, clients, createChannel, start, verify, advance: (ms: number) => { time += ms; } };
}

describe('one-time phone signup proof', () => {
  it('keeps credentials and Telegram proof out of the database until PIN completion', async () => {
    const c = setup();
    const { loginId, needs } = await c.start();
    expect(needs).toBe('code');
    expect(c.repo.get()).toBeUndefined();
    expect((await c.flow.verifyCode(loginId, '11111')).needs).toBe('pin');
    expect(c.repo.get()).toBeUndefined();
    expect(c.createChannel).not.toHaveBeenCalled();
    await c.flow.complete(loginId, '1234');
    expect(c.repo.isConfigured()).toBe(true);
    expect(c.repo.get()).toMatchObject({ api_id: 123, api_hash: API_HASH, session: 'SESSION_1', channel_id: '999', account_name: 'Test Account', account_phone: PHONE });
    expect(c.repo.verifyPin('1234')).toBe(true);
    expect(c.clients[0].logOut).not.toHaveBeenCalled();
    expect(c.clients[0].disconnect).toHaveBeenCalledOnce();
  });

  it('requires the correct phase and a valid Telegram two-step password before setting PIN', async () => {
    const c = setup({ needPassword: true });
    const { loginId } = await c.start();
    await expect(c.flow.verifyPassword(loginId, 'correct-password')).rejects.toMatchObject({ code: 'INVALID_PHASE' });
    await expect(c.flow.complete(loginId, '1234')).rejects.toMatchObject({ code: 'INVALID_PHASE' });
    expect((await c.flow.verifyCode(loginId, '11111')).needs).toBe('password');
    await expect(c.flow.complete(loginId, '1234')).rejects.toMatchObject({ code: 'INVALID_PHASE' });
    await expect(c.flow.verifyPassword(loginId, 'wrong-password')).rejects.toMatchObject({ code: 'INVALID_PASSWORD' });
    expect((await c.flow.verifyPassword(loginId, 'correct-password')).needs).toBe('pin');
    expect(c.repo.get()).toBeUndefined();
    await c.flow.complete(loginId, '1234');
    expect(c.repo.isConfigured()).toBe(true);
  });

  it('rejects missing proof, bounds PIN length, and consumes the proof only once', async () => {
    const c = setup();
    await expect(c.flow.complete('', '1234')).rejects.toMatchObject({ code: 'LOGIN_EXPIRED' });
    const loginId = await c.verify();
    await expect(c.flow.complete(loginId, '1234567890123')).rejects.toMatchObject({ code: 'INVALID_PIN' });
    await c.flow.complete(loginId, '1234');
    await expect(c.flow.complete(loginId, '9999')).rejects.toMatchObject({ code: 'LOGIN_EXPIRED' });
    await expect(c.start()).rejects.toMatchObject({ code: 'ALREADY_CONFIGURED' });
    expect(c.repo.verifyPin('1234')).toBe(true);
    expect(c.createChannel).toHaveBeenCalledOnce();
  });

  it('limits invalid code attempts and destroys exhausted challenges', async () => {
    const c = setup();
    const { loginId } = await c.start();
    for (let i = 0; i < 4; i++) await expect(c.flow.verifyCode(loginId, '00000')).rejects.toMatchObject({ code: 'INVALID_CODE' });
    await expect(c.flow.verifyCode(loginId, '00000')).rejects.toMatchObject({ code: 'TOO_MANY_ATTEMPTS', status: 429, retryAfter: 60 });
    await expect(c.flow.verifyCode(loginId, '11111')).rejects.toMatchObject({ code: 'LOGIN_EXPIRED' });
    expect(c.repo.get()).toBeUndefined();
    expect(c.clients[0].disconnect).toHaveBeenCalled();
  });

  it('accepts formatted international phone numbers and checks the verified identity', async () => {
    const c = setup();
    const { loginId } = await c.flow.start(123, API_HASH, '+1 (555) 123-4567');
    expect(c.clients[0].sendCode).toHaveBeenCalledWith({ apiId: 123, apiHash: API_HASH }, PHONE);
    await c.flow.verifyCode(loginId, '11111');
    await c.flow.complete(loginId, '1234');
    expect(c.repo.get()?.account_phone).toBe(PHONE);
    const mismatch = setup({ identity: '15559999999' });
    const wrong = await mismatch.start();
    await expect(mismatch.flow.verifyCode(wrong.loginId, '11111')).rejects.toMatchObject({ code: 'ACCOUNT_MISMATCH' });
    expect(mismatch.repo.get()).toBeUndefined();
    expect(mismatch.clients[0].logOut).toHaveBeenCalledOnce();
  });

  it('reserves the send cooldown before network I/O', async () => {
    const c = setup();
    const starting = c.start();
    await vi.waitFor(() => expect(c.clients).toHaveLength(1));
    // connect yields before sendCode; the reservation already blocks parallel calls.
    await expect(c.start()).rejects.toMatchObject({ code: 'TOO_MANY_ATTEMPTS', status: 429 });
    await starting;
    expect(c.clients).toHaveLength(1);
    expect(c.repo.get()).toBeUndefined();
  });

  it('expires or cancels authenticated proofs without creating a drive', async () => {
    const c = setup();
    const loginId = await c.verify();
    c.advance(5 * 60_000);
    await expect(c.flow.complete(loginId, '1234')).rejects.toMatchObject({ code: 'LOGIN_EXPIRED' });
    expect(c.repo.get()).toBeUndefined();
    expect(c.clients[0].logOut).toHaveBeenCalledOnce();
    const next = await c.verify();
    await c.flow.cancel(next);
    await expect(c.flow.complete(next, '1234')).rejects.toMatchObject({ code: 'LOGIN_EXPIRED' });
    expect(c.clients[1].logOut).toHaveBeenCalledOnce();
  });

  it('cancel during verification prevents late authentication from writing data', async () => {
    const c = setup();
    const { loginId } = await c.start();
    const identity = deferred<{ firstName: string; phone: string }>();
    c.clients[0].getMe.mockImplementation(() => identity.promise);
    const verification = c.flow.verifyCode(loginId, '11111');
    await vi.waitFor(() => expect(c.clients[0].getMe).toHaveBeenCalled());
    await c.flow.cancel(loginId);
    identity.resolve({ firstName: 'Late Account', phone: '15551234567' });
    await expect(verification).rejects.toMatchObject({ code: 'LOGIN_EXPIRED' });
    expect(c.repo.get()).toBeUndefined();
  });

  it('serializes PIN completion and prevents a late competing signup from replacing the account', async () => {
    const c = setup();
    const first = await c.verify();
    c.advance(60_000);
    const second = await c.verify();
    const channel = deferred<string>();
    c.createChannel.mockImplementation(() => channel.promise);
    const completing = c.flow.complete(first, '1234');
    await vi.waitFor(() => expect(c.createChannel).toHaveBeenCalledOnce());
    await expect(c.flow.complete(first, '9999')).rejects.toMatchObject({ code: 'LOGIN_BUSY' });
    // Both proofs can reach channel creation, but the commit rechecks account state.
    const competing = c.flow.complete(second, '9999');
    await vi.waitFor(() => expect(c.createChannel).toHaveBeenCalledTimes(2));
    channel.resolve('verified-channel');
    const results = await Promise.allSettled([completing, competing]);
    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('rejected');
    expect(c.repo.get()?.channel_id).toBe('verified-channel');
    expect(c.repo.verifyPin('1234')).toBe(true);
    expect(c.repo.verifyPin('9999')).toBe(false);
  });

  it('failed sends and channel creation never save partial account settings', async () => {
    const failedSend = setup({ sendError: rpc('PHONE_NUMBER_INVALID') });
    await expect(failedSend.start()).rejects.toMatchObject({ code: 'INVALID_PHONE' });
    expect(failedSend.repo.get()).toBeUndefined();
    expect(failedSend.clients[0].disconnect).toHaveBeenCalled();
    const c = setup();
    const loginId = await c.verify();
    c.createChannel.mockRejectedValue(new Error('network failure'));
    await expect(c.flow.complete(loginId, '1234')).rejects.toMatchObject({ code: 'TELEGRAM_UNAVAILABLE' });
    expect(c.repo.get()).toBeUndefined();
    expect(c.clients[0].logOut).toHaveBeenCalledOnce();
  });
});
