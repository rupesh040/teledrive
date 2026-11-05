import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';

const { outputFiles } = await build({
  stdin: {
    contents: `export { LinearProgress } from './src/components/material/Progress.tsx';
      export { UploadQueue } from './src/components/UploadQueue.tsx';
      export { LangProvider } from './src/i18n/lang.tsx';`,
    resolveDir: fileURLToPath(new URL('..', import.meta.url)),
    loader: 'tsx',
  },
  bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic',
  external: ['react'], loader: { '.css': 'empty' },
});
const subject = { exports: {} };
vm.runInNewContext(outputFiles[0].text, { module: subject, exports: subject.exports, require: createRequire(import.meta.url), console });
const { LinearProgress, UploadQueue, LangProvider } = subject.exports;
const progress = props => renderToStaticMarkup(React.createElement(LinearProgress, { label: 'Transfer', ...props }));
const queue = items => renderToStaticMarkup(React.createElement(LangProvider, null, React.createElement(UploadQueue, { items, onClose() {} })));

test('indeterminate loading has an accessible name without claiming a percentage', () => {
  const html = progress({});
  assert.match(html, /role="progressbar"/);
  assert.match(html, /aria-label="Transfer"/);
  assert.match(html, /data-indeterminate="true"/);
  assert.doesNotMatch(html, /aria-valuenow=/);
});

test('determinate progress clamps invalid values and preserves a valid real percentage', () => {
  for (const [value, expected] of [[-10, 0], [140, 100], [NaN, 0], [Infinity, 0], [42, 42]]) {
    const html = progress({ value });
    assert.match(html, new RegExp(`aria-valuenow="${expected}"`));
    assert.doesNotMatch(html, /NaN|Infinity/);
  }
});

test('saving to Telegram stays indeterminate until the server confirms completion', () => {
  const saving = queue([{ id: 1, name: 'report.pdf', progress: 100, status: 'uploading' }]);
  assert.match(saving, /Saving…/);
  assert.match(saving, /data-indeterminate="true"/);
  assert.doesNotMatch(saving, /aria-valuenow=/);
  const complete = queue([{ id: 1, name: 'report.pdf', progress: 100, status: 'done' }]);
  assert.match(complete, /data-state="complete"/);
  assert.match(complete, /aria-valuenow="100"/);
});

test('failed uploads retain their actual percentage and report failure', () => {
  const html = queue([{ id: 2, name: 'photo.jpg', progress: 37, status: 'error' }]);
  assert.match(html, /data-state="error"/);
  assert.match(html, /aria-valuenow="37"/);
  assert.match(html, /aria-valuetext="Upload failed"/);
});

test('inactive progress stays out of the accessibility tree', () => {
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null,
    React.createElement(LinearProgress, { label: 'First', value: 10 }),
    React.createElement(LinearProgress, { label: 'Second', active: false }),
  ));
  assert.equal([...html.matchAll(/role="progressbar"/g)].length, 1);
  assert.match(html, /aria-hidden="true"/);
});
