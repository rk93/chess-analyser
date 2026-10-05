import test from 'node:test';
import assert from 'node:assert/strict';
import { displayLineFor,displayCacheNeedsRepair,isUciMove } from '../js/review-display.js';

test('review display falls back safely when SAN/PV enrichment is missing',()=>{
  const review={bestMoves:['e2e4']};
  assert.deepEqual(displayLineFor(review,0),{bestUci:'e2e4',bestSan:'e2e4',line:'e2e4'});
});

test('empty precomputed best lines are treated as corrupt cache and repaired',()=>{
  const review={
    displayPrecomputed:true,
    displayPrecomputedVersion:2,
    bestMoves:['e2e4','e7e5'],
    bestSans:['e4','e5'],
    bestLines:['','e5 Nf3']
  };
  assert.equal(displayCacheNeedsRepair(review,2),true);
});

test('complete precomputed review display cache is accepted',()=>{
  const review={
    displayPrecomputed:true,
    displayPrecomputedVersion:2,
    bestMoves:['e2e4','e7e5'],
    bestSans:['e4','e5'],
    bestLines:['e4 e5 Nf3','e5 Nf3 Nc6']
  };
  assert.equal(displayCacheNeedsRepair(review,2),false);
});

test('positions without an engine best move do not require a display line',()=>{
  const review={bestMoves:[''],bestSans:[''],bestLines:['']};
  assert.equal(displayCacheNeedsRepair(review,1),false);
});

test('UCI move validation accepts promotions and rejects malformed data',()=>{
  assert.equal(isUciMove('e7e8q'),true);
  assert.equal(isUciMove('e2e4'),true);
  assert.equal(isUciMove('Nf3'),false);
});
