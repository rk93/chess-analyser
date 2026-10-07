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

test('Analysis Board module remains syntactically valid',()=>{
  assert.doesNotThrow(()=>execFileSync(process.execPath,['--check','js/lab.js'],{stdio:'pipe'}));
});
