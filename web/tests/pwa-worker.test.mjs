import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { createServiceWorkerSource } from '../scripts/pwa.mjs';

const paths = ['/index.html', '/offline.html', '/manifest.webmanifest', '/assets/app-123.js'];
function worker({ offline = false, failInstall = false } = {}) {
  const events = new Map();
  const network = [];
  const deleted = [];
  const shell = new Response('<html>Public app shell</html>', { headers: { 'Content-Type': 'text/html' } });
  const cache = {
    async addAll() { if (failInstall) throw new Error('Network unavailable'); },
    async match(request) { return (typeof request === 'string' ? request : new URL(request.url).pathname) === '/index.html' ? shell.clone() : undefined; },
  };
  const self = {
    location: { origin: 'https://drive.example.com' },
    addEventListener: (name, fn) => events.set(name, fn),
    clients: { async claim() {} },
  };
  vm.runInNewContext(createServiceWorkerSource(paths, 'version-test'), {
    self, URL, Request: class extends Request {
      constructor(input, init) { super(new URL(input, self.location.origin), init); }
    }, Response, Set,
    fetch: async request => {
      network.push(request);
      if (offline) throw new TypeError('Offline');
      return new Response('Fresh public content');
    },
    caches: {
      async open() { return cache; },
      async delete(name) { deleted.push(name); },
      async keys() { return ['teledrive-shell-old', 'teledrive-shell-version-test', 'unrelated-cache']; },
    },
  });
  return {
    events, network, deleted,
    fetch(path, { method = 'GET', mode = 'cors', authorization } = {}) {
      let result;
      events.get('fetch')({
        request: { url: new URL(path, self.location.origin).href, method, mode, headers: new Headers(authorization ? { Authorization: authorization } : {}) },
        respondWith(value) { result = value; },
      });
      return result;
    },
    async lifecycle(name) {
      let result;
      events.get(name)({ waitUntil(value) { result = value; } });
      return result;
    },
  };
}

test('the service worker never intercepts private API, token links, external resources, or mutations', () => {
  const w = worker();
  for (const path of ['/api', '/api/auth/session', '/api/files/1/preview?token=private', '/index.html?token=private', 'https://api.example.com/api/files']) {
    assert.equal(w.fetch(path), undefined);
  }
  assert.equal(w.fetch('/index.html', { authorization: 'Bearer private' }), undefined);
  assert.equal(w.fetch('/index.html', { method: 'POST' }), undefined);
  assert.equal(w.fetch('/private-photo.png'), undefined);
  assert.equal(w.network.length, 0);
});

test('offline navigation returns only the precached public shell', async () => {
  const w = worker({ offline: true });
  const response = await w.fetch('/', { mode: 'navigate' });
  assert.equal(await response.text(), '<html>Public app shell</html>');
});

test('unversioned manifest assets prefer the network after a deployment', async () => {
  const w = worker();
  assert.equal(await (await w.fetch('/manifest.webmanifest')).text(), 'Fresh public content');
  assert.equal(w.network.length, 1);
});

test('a failed new worker install removes its incomplete cache', async () => {
  const w = worker({ failInstall: true });
  await assert.rejects(w.lifecycle('install'), /Network unavailable/);
  assert.deepEqual(w.deleted, ['teledrive-shell-version-test']);
});

test('activation removes only obsolete TeleDrive caches', async () => {
  const w = worker();
  await w.lifecycle('activate');
  assert.deepEqual(w.deleted, ['teledrive-shell-old']);
});
