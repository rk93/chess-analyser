import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('service worker avoids caching third-party chess API and CDN requests',async()=>{
 const sw=await readFile('sw.js','utf8');
 assert.match(sw,/url\.origin!==self\.location\.origin/);
 assert.match(sw,/const SHELL=/);
 assert.match(sw,/Promise\.allSettled/);
 assert.match(sw,/response\.ok&&response\.type==='basic'/);
 assert.match(sw,/cache:'no-cache'/);
});
test('offline indicator appears only without connectivity and has retry',async()=>{
 const js=await readFile('js/ux-shell.js','utf8');
 const css=await readFile('ux-shell.css','utf8');
 assert.ok(js.includes("window.addEventListener('offline',refresh)"));
 assert.ok(js.includes("window.addEventListener('online',refresh)"));
 assert.ok(js.includes('appConnectivityRetry'));
 assert.ok(css.includes('position:fixed;z-index:4200'));
});
test('manifest stays scoped to Chess Analyser rather than origin root',async()=>{
 const data=JSON.parse(await readFile('manifest.webmanifest','utf8'));
 assert.equal(data.start_url,'/chess-analyser/');
 assert.equal(data.scope,'/chess-analyser/');
 assert.equal(data.display,'standalone');
 assert.ok(data.icons.some(i=>i.purpose==='maskable'));
});
