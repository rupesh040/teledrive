import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

// Bundle the production modules together so every test uses their real shared state.
const { outputFiles } = await build({
  stdin: {
    contents: `export { api, ApiError } from './src/api/client.ts';
      export { getToken, setToken, clearToken, onLocked } from './src/api/auth.ts';`,
    resolveDir: fileURLToPath(new URL('..', import.meta.url)),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'cjs',
  target: 'es2022',
});
const source = outputFiles[0].text;
const TOKEN_KEY = 'td-token';

function storage(initial = {}, blocked = false) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { if (blocked) throw new Error('Storage unavailable'); return values.get(key) ?? null; },
    setItem(key, value) { if (blocked) throw new Error('Storage unavailable'); values.set(key, String(value)); },
    removeItem(key) { if (blocked) throw new Error('Storage unavailable'); values.delete(key); },
  };
}

function load({ local = {}, session = {}, blocked = false, fetch = async () => response({}) } = {}) {
  const events = new Map();
  const window = {
    localStorage: storage(local, blocked),
    sessionStorage: storage(session, blocked),
    addEventListener(type, listener) { events.set(type, listener); },
  };
  const uploads = [];
  class FakeXHR {
    upload = {};
    headers = {};
    open() {}
    setRequestHeader(key, value) { this.headers[key] = value; }
    send() { uploads.push(this); }
    respond(status, body) {
      this.status = status;
      this.responseText = JSON.stringify(body);
      this.onload();
    }
  }
  const module = { exports: {} };
  vm.runInNewContext(source, {
    module, exports: module.exports, window, fetch, Headers, AbortSignal,
    FormData, XMLHttpRequest: FakeXHR,
  }, { filename: 'bundled-auth-test.cjs' });
  return { ...module.exports, window, events, uploads };
}

function response(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

test('ordinary sign-in migrates legacy credentials to session storage and survives a reload', () => {
  const context = load({ local: { [TOKEN_KEY]: 'legacy-token' } });
  assert.equal(context.getToken(), 'legacy-token');
  context.setToken('tab-token');
  assert.equal(context.window.localStorage.getItem(TOKEN_KEY), null);
  assert.equal(context.window.sessionStorage.getItem(TOKEN_KEY), 'tab-token');
  assert.equal(load({ session: { [TOKEN_KEY]: 'tab-token' } }).getToken(), 'tab-token');
});

test('remembered sign-in uses local storage and removes an older tab credential', () => {
  const context = load({ session: { [TOKEN_KEY]: 'old-tab-token' } });
  context.setToken('remembered-token', true);
  assert.equal(context.window.sessionStorage.getItem(TOKEN_KEY), null);
  assert.equal(context.window.localStorage.getItem(TOKEN_KEY), 'remembered-token');
  assert.equal(load({ local: { [TOKEN_KEY]: 'remembered-token' } }).getToken(), 'remembered-token');
});

test('blocked browser storage still permits a memory session and sign-out', () => {
  const context = load({ blocked: true });
  context.setToken('memory-token');
  assert.equal(context.getToken(), 'memory-token');
  assert.equal(context.clearToken('memory-token'), true);
  assert.equal(context.getToken(), null);
});

test('stale token clearing cannot end a newer sign-in', () => {
  const context = load();
  let locked = 0;
  context.onLocked(() => locked++);
  context.setToken('old-token');
  context.setToken('new-token');
  assert.equal(context.clearToken('old-token'), false);
  assert.equal(context.getToken(), 'new-token');
  assert.equal(locked, 0);
  context.clearToken('new-token');
  assert.equal(locked, 1);
});

test('sign-out preserves a different remembered token saved by another tab', () => {
  const context = load();
  context.setToken('tab-token');
  context.window.localStorage.setItem(TOKEN_KEY, 'other-tab-token');
  context.clearToken('tab-token');
  assert.equal(context.getToken(), null);
  assert.equal(context.window.localStorage.getItem(TOKEN_KEY), 'other-tab-token');
});

test('a remembered token change in another tab locks the old tab without deleting the new token', () => {
  const context = load({ local: { [TOKEN_KEY]: 'old-token' } });
  let locked = 0;
  context.onLocked(() => locked++);
  context.window.localStorage.setItem(TOKEN_KEY, 'new-token');
  context.events.get('storage')({ storageArea: context.window.localStorage, key: TOKEN_KEY, oldValue: 'old-token', newValue: 'new-token' });
  assert.equal(context.getToken(), null);
  assert.equal(locked, 1);
  assert.equal(context.window.localStorage.getItem(TOKEN_KEY), 'new-token');
});

test('a late authenticated 401 preserves the token from a newer sign-in', async () => {
  let resolveRequest;
  let sentAuthorization;
  const context = load({ fetch: (_url, init) => {
    sentAuthorization = init.headers.Authorization;
    return new Promise(resolve => { resolveRequest = resolve; });
  } });
  context.setToken('old-token');
  const pending = context.api.listAllFiles();
  assert.equal(sentAuthorization, 'Bearer old-token');
  context.setToken('new-token');
  resolveRequest(response({ error: 'Session expired.', code: 'SESSION_EXPIRED' }, 401));
  await assert.rejects(pending, error => error instanceof context.ApiError && error.status === 401);
  assert.equal(context.getToken(), 'new-token');
});

test('an authenticated 401 clears the current token and signals the login screen', async () => {
  const context = load({ fetch: async () => response({ error: 'Session expired.', code: 'SESSION_EXPIRED' }, 401) });
  let locked = 0;
  context.onLocked(() => locked++);
  context.setToken('current-token');
  await assert.rejects(context.api.listAllFiles(), error => error.code === 'SESSION_EXPIRED');
  assert.equal(context.getToken(), null);
  assert.equal(locked, 1);
});

test('public login failures preserve active authentication and structured error metadata', async () => {
  const calls = [];
  const context = load({ fetch: async (url, init) => {
    calls.push({ url, init });
    return response({ error: 'Incorrect verification.', code: 'INVALID_CODE', retryAfter: 30 }, 401, { 'Retry-After': '45' });
  } });
  context.setToken('active-token', true);
  for (const request of [() => context.api.login('0000'), () => context.api.telegramVerify('pending-login', '00000')]) {
    await assert.rejects(request(), error => error instanceof context.ApiError && error.status === 401 && error.code === 'INVALID_CODE' && error.retryAfter === 45 && error.message === 'Incorrect verification.');
    assert.equal(context.getToken(), 'active-token');
  }
  assert.equal(calls.length, 2);
  for (const { init } of calls) assert.equal(new Headers(init.headers).has('Authorization'), false);
});

test('a late upload 401 cannot clear a newer sign-in', async () => {
  const context = load();
  context.setToken('old-token');
  const pending = context.api.uploadFile(new Blob(['sample']), null);
  assert.equal(context.uploads[0].headers.Authorization, 'Bearer old-token');
  context.setToken('new-token');
  context.uploads[0].respond(401, { error: 'Session expired.', code: 'SESSION_EXPIRED' });
  await assert.rejects(pending);
  assert.equal(context.getToken(), 'new-token');
});
