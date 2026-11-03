import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const { outputFiles } = await build({
  entryPoints: [fileURLToPath(new URL('../src/pwa/install.ts', import.meta.url))],
  bundle: true, write: false, platform: 'browser', format: 'cjs', target: 'es2022',
});

function load(navigator = {}) {
  const events = new Map();
  const media = new Map();
  const window = {
    addEventListener: (name, listener) => events.set(name, listener),
    matchMedia: query => {
      const item = { matches: false, addEventListener: (_name, listener) => { item.change = listener; } };
      media.set(query, item);
      return item;
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(outputFiles[0].text, {
    window, navigator: { userAgent: 'Chrome', maxTouchPoints: 0, ...navigator },
    module, exports: module.exports,
  });
  return { ...module.exports, events, media };
}

test('a deferred install prompt is invoked during the click and consumed exactly once', async () => {
  const app = load();
  let prompts = 0;
  let prevented = 0;
  let choose;
  const userChoice = new Promise(resolve => { choose = resolve; });
  app.events.get('beforeinstallprompt')({
    preventDefault() { prevented++; },
    prompt() { prompts++; return Promise.resolve(); },
    userChoice,
  });
  assert.equal(prevented, 1);
  assert.equal(app.getInstallState().available, true);
  const install = app.requestAppInstall();
  assert.equal(prompts, 1, 'prompt must run before waiting for any asynchronous work');
  assert.equal(app.getInstallState().prompting, true);
  assert.equal(await app.requestAppInstall(), 'dismissed', 'a concurrent click cannot reuse the prompt');
  choose({ outcome: 'accepted' });
  assert.equal(await install, 'accepted');
  assert.equal(app.getInstallState().installed, false, 'accepting waits for actual installation confirmation');
  assert.equal(await app.requestAppInstall(), 'unavailable');
  app.events.get('appinstalled')();
  assert.equal(app.getInstallState().installed, true);
  assert.equal(app.getInstallState().available, false);
});

test('a rejected prompt recovers and a fresh browser event can offer installation again', async () => {
  const app = load();
  let changes = 0;
  const unsubscribe = app.subscribeToInstall(() => changes++);
  app.events.get('beforeinstallprompt')({ preventDefault() {}, prompt() { throw new Error('Browser denied prompt'); } });
  assert.equal(await app.requestAppInstall(), 'failed');
  assert.equal(app.getInstallState().prompting, false);
  app.events.get('beforeinstallprompt')({
    preventDefault() {}, prompt: async () => ({ outcome: 'dismissed' }),
  });
  assert.equal(await app.requestAppInstall(), 'dismissed');
  assert.ok(changes >= 4);
  unsubscribe();
  const previous = changes;
  app.events.get('appinstalled')();
  assert.equal(changes, previous);
});

test('standalone mode and iOS standalone launch suppress redundant installation', async () => {
  const app = load();
  const standalone = app.media.get('(display-mode: standalone)');
  standalone.matches = true;
  standalone.change();
  assert.equal(app.getInstallState().installed, true);
  app.events.get('beforeinstallprompt')({ preventDefault() {} });
  assert.equal(app.getInstallState().available, false);
  assert.equal(await app.requestAppInstall(), 'dismissed');
  assert.equal(load({ standalone: true }).getInstallState().installed, true);
});

test('installation guidance distinguishes iPad desktop mode, Android, and Safari for Mac', () => {
  assert.equal(load({ userAgent: 'Mozilla Macintosh Safari', maxTouchPoints: 5 }).installPlatform(), 'ios');
  assert.equal(load({ userAgent: 'Mozilla iPhone Safari' }).installPlatform(), 'ios');
  assert.equal(load({ userAgent: 'Mozilla Android Chrome' }).installPlatform(), 'android');
  assert.equal(load({ userAgent: 'Mozilla Macintosh Safari' }).installPlatform(), 'mac-safari');
  assert.equal(load({ userAgent: 'Mozilla Macintosh Chrome Safari' }).installPlatform(), 'desktop');
});
