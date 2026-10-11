import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const main=await readFile('js/game-review.js','utf8');
const legacy=await readFile('js/review-reliability.js','utf8');
test('main review owns MultiPV content exclusively',()=>{
 const section=legacy.split('function renderPreparedBest(i){')[1].split('async function showBest()')[0];
 assert.doesNotMatch(section,/\.innerHTML\s*=/);
 assert.doesNotMatch(section,/textContent\s*=/);
 assert.match(main,/data\.localMultiLines\?\.\[i\]/);
});
test('legacy reviewer never overwrites a completed review with unavailable text',()=>{
 assert.match(legacy,/if\(review\?\.evals\?\.length\)return/);
 assert.doesNotMatch(legacy,/Engine line unavailable for this position\./);
});
test('verified Show Best uses its own registered handler',()=>{
 assert.match(legacy,/if\(review\?\.evals\?\.length\)return; e\.preventDefault/);
});
test('start-position arrows are retained',()=>{
 assert.doesNotMatch(legacy,/ply===0\)\{lastRenderedPly=0;\$\('analysisArrows'\)/);
});
