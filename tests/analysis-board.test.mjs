import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

test('Analysis Board uses local Stockfish as primary engine',async()=>{
  const src=await readFile('js/lab.js','utf8');
  assert.match(src,/getLocalStockfish/);
  assert.match(src,/Starting local Stockfish/);
  assert.match(src,/engine\.analyse\(fen,\{depth:16,multipv:3,clearHash:true\}\)/);
  assert.doesNotMatch(src,/chess-api\.com\/v1/);
});

test('Analysis Board remote fallback is bounded by timeout',async()=>{
  const src=await readFile('js/lab.js','utf8');
  assert.match(src,/AbortController/);
  assert.match(src,/fetchTimeout/);
  assert.match(src,/3000/);
});

test('PGN candidate lookup cannot wait forever on cloud',async()=>{
  const src=await readFile('js/pgn-analyzer.js','utf8');
  assert.match(src,/AbortController/);
  assert.match(src,/2500/);
});

test('local Stockfish startup has timeout and resets failed ready promise',async()=>{
  const src=await readFile('js/local-stockfish.js','utf8');
  assert.match(src,/Local Stockfish startup timed out/);
  assert.match(src,/this\.readyPromise=null/);
  assert.match(src,/this\.worker\?\.terminate/);
});

test('Analysis Board Auto preserves local engine failure reason',async()=>{
  const src=await readFile('js/lab.js','utf8');
  assert.match(src,/Local Stockfish failed:/);
  assert.match(src,/Cloud fallback was also unavailable/);
});

test('Analysis Board ignores stale analysis completions',async()=>{
  const src=await readFile('js/lab.js','utf8');
  assert.match(src,/let analysisRun=0/);
  assert.match(src,/const run=\+\+analysisRun/);
  assert.match(src,/if\(run!==analysisRun\)return/);
});

test('Stockfish worker companion WASM is kept and precached',async()=>{
  const worker=await readFile('engine/stockfish-19-lite-single.js','utf8');
  const wasm=await readFile('engine/stockfish-19-lite-single.wasm');
  const sw=await readFile('sw.js','utf8');
  assert.ok(worker.includes('location.pathname.replace(/\\.js$/i,".wasm")'));
  assert.ok(wasm.byteLength>1000000);
  assert.ok(sw.includes('./engine/stockfish-19-lite-single.wasm'));
});

test('engine modules remain syntactically valid',()=>{
  for(const file of ['js/lab.js','js/local-stockfish.js']){
    assert.doesNotThrow(()=>execFileSync(process.execPath,['--check',file],{stdio:'pipe'}),file);
  }
});
