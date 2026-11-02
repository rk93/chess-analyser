import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile('sw.js', 'utf8');

for (const extension of ['js', 'css', 'html', 'wasm']) {
  test(`service worker ${extension === 'wasm' ? 'reuses cached' : 'revalidates cached'} ${extension} assets`, async () => {
    const handlers = {}, calls = [];
    const sandbox = {
      URL, Response, Promise,
      self: { location: { origin: 'https://app.test' }, addEventListener: (name, fn) => { handlers[name] = fn; } },
      caches: { match: async () => new Response('cached'), open: async () => ({ put: async () => {} }) },
      fetch: async (request, options) => { calls.push(options); return new Response('network'); },
    };
    vm.runInNewContext(source, sandbox);
    let result;
    handlers.fetch({ request: { method: 'GET', mode: 'cors', url: `https://app.test/asset.${extension}` }, respondWith: value => { result = value; } });
    const response = await result;
    assert.equal(await response.text(), extension === 'wasm' ? 'cached' : 'network');
    if (extension === 'wasm') assert.equal(calls.length, 0);
    else assert.equal(calls[0].cache, 'no-cache');
  });
}
