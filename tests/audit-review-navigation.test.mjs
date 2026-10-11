import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const src=await readFile('js/analysis-recovery.js','utf8');

test('recovery validates the original generation, FEN, game key and ply',()=>{
  assert.match(src,/function isCurrent\(gen,fen,key,ply\)/);
  assert.match(src,/gen===generation/);
  assert.match(src,/fen===fenAtCurrent\(\)/);
  assert.match(src,/key===reviewKey\(\)/);
  assert.match(src,/ply===currentPly\(\)/);
  assert.match(src,/variationNote/);
});

test('async reads cannot show an old cached or remote position',()=>{
  assert.match(src,/async function reviewFallback\(key,ply\)/);
  assert.ok((src.match(/if\(!isCurrent\(gen,fen,key,ply\)\)return/g)||[]).length>=4);
  assert.match(src,/finally\{if\(gen===generation\)/);
});

test('navigation and game switches invalidate pending recovery',()=>{
  assert.match(src,/addEventListener\('reviewNavigation',invalidate\)/);
  assert.match(src,/#back,#games \.game/);
  assert.match(src,/function invalidate\(\)\{generation\+\+;running=false/);
});
