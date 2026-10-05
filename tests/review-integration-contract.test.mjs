import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const files=[
  'js/game-review.js',
  'js/review-reliability.js',
  'js/review-corrections.js',
  'js/review-display.js',
  'js/local-stockfish.js'
];

test('review JavaScript modules are syntactically valid',()=>{
  for(const file of files){
    assert.doesNotThrow(()=>execFileSync(process.execPath,['--check',file],{stdio:'pipe'}),file);
  }
});

test('guided review renders best line from active review data without clearing it first',async()=>{
  const src=await readFile('js/game-review.js','utf8');
  assert.match(src,/displayLineFor/);
  assert.match(src,/renderAutoBest\(i,data,positions\[i\]\?\.fen\)/);
  assert.doesNotMatch(src,/setEvalBar\(cp\);drawBestArrow\(''\);renderGuide/);
});

test('navigation reliability layer does not blank the best line on button press',async()=>{
  const src=await readFile('js/review-reliability.js','utf8');
  assert.doesNotMatch(src,/Updating engine line/);
  assert.match(src,/MutationObserver/);
});

test('cached local reviews validate actual line content before trusting precompute flag',async()=>{
  const src=await readFile('js/review-corrections.js','utf8');
  assert.match(src,/displayCacheNeedsRepair/);
  assert.match(src,/displayPrecomputedVersion=2/);
});

test('service worker precaches review display and local Stockfish runtime',async()=>{
  const src=await readFile('sw.js','utf8');
  for(const asset of [
    './js/review-display.js',
    './engine/stockfish-19-lite-single.js',
    './engine/stockfish.wasm'
  ]) assert.ok(src.includes(asset),asset);
});
