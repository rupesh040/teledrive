import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const CACHE_PREFIX = 'teledrive-shell-';

/** Only build assets enter this worker; authenticated responses never do. */
export function createServiceWorkerSource(paths, version) {
  return `/* TeleDrive public app shell. Do not add API or user files to this cache. */
const CACHE_PREFIX = ${JSON.stringify(CACHE_PREFIX)};
const CACHE_NAME = CACHE_PREFIX + ${JSON.stringify(version)};
const PRECACHE = ${JSON.stringify(paths)};
const PUBLIC_ASSETS = new Set(PRECACHE.map(path => new URL(path, self.location.origin).href));
const SHELL_URL = PRECACHE.find(path => path.endsWith('/index.html'));
const OFFLINE_URL = PRECACHE.find(path => path.endsWith('/offline.html'));

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      await cache.addAll(PRECACHE.map(path => new Request(path, { cache: 'reload' })));
    } catch (error) {
      // A failed new installation must not leave an incomplete app shell behind.
      await caches.delete(CACHE_NAME);
      throw error;
    }
    // Updates wait until existing app windows close; uploads are not interrupted.
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Query strings can contain media tokens. Neither intercept nor cache them.
  if (request.method !== 'GET' || request.headers.has('Authorization') || url.origin !== self.location.origin || url.search || url.pathname === '/api' || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) return response;
      } catch { /* Show the public app shell when the network is unavailable. */ }
      const cache = await caches.open(CACHE_NAME);
      return await cache.match(SHELL_URL) || await cache.match(OFFLINE_URL) || Response.error();
    })());
    return;
  }

  if (!PUBLIC_ASSETS.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Unversioned manifest/icons must reflect a new deployment immediately.
    if (!url.pathname.includes('/assets/')) {
      try {
        const response = await fetch(request);
        if (response.ok) return response;
      } catch { /* Fall back to the public install assets. */ }
      return await cache.match(request) || Response.error();
    }
    return await cache.match(request) || fetch(request);
  })());
});
`;
}

async function publicFiles(directory, prefix = '') {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = await Promise.all(entries.map(async entry => {
      const relative = `${prefix}${entry.name}`;
      if (entry.isDirectory()) return publicFiles(join(directory, entry.name), `${relative}/`);
      if (['favicon.svg', 'manifest.webmanifest', 'offline.html'].includes(relative) || /^icons\/[a-zA-Z0-9._-]+\.(png|svg)$/.test(relative)) {
        return [{ name: relative, bytes: await readFile(join(directory, entry.name)) }];
      }
      return [];
    }));
    return files.flat();
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

/** Emit a deterministic worker after Vite has produced its hashed asset names. */
export function pwaPlugin() {
  let configuration;
  return {
    name: 'teledrive-pwa',
    apply: 'build',
    enforce: 'post',
    configResolved(config) { configuration = config; },
    async generateBundle(_options, bundle) {
      const base = configuration.base;
      if (!base.startsWith('/') || base.startsWith('//')) throw new Error('TeleDrive PWA requires a same-origin Vite base path.');
      const files = Object.values(bundle)
        .filter(file => file.fileName === 'index.html' || /\.(js|css|woff2?)$/.test(file.fileName))
        .map(file => ({ name: file.fileName, bytes: file.type === 'chunk' ? file.code : file.source }));
      files.push(...await publicFiles(configuration.publicDir));
      files.sort((a, b) => a.name.localeCompare(b.name));
      const paths = [...new Set(files.map(file => `${base}${file.name}`))];
      if (!paths.includes(`${base}index.html`) || !paths.includes(`${base}offline.html`)) throw new Error('PWA build requires index.html and offline.html.');
      const hash = createHash('sha256');
      hash.update(createServiceWorkerSource(paths, ''));
      for (const file of files) hash.update(file.name).update('\0').update(file.bytes).update('\0');
      const version = hash.digest('hex').slice(0, 20);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: createServiceWorkerSource(paths, version) });
    },
  };
}
