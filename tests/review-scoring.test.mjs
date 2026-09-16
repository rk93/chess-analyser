import test from 'node:test';
import assert from 'node:assert/strict';
import { whiteWinProbability,moverExpectedPointLoss,baseMoveClass,classifyReviewedMove } from '../js/review-scoring.js';

test('published win-probability curve avoids early saturation',()=>{
  const before=whiteWinProbability(600),after=whiteWinProbability(200),loss=before-after;
  assert.ok(loss>0.20,`expected >20% expected-point loss, got ${loss}`);
  assert.equal(baseMoveClass(loss),'Blunder');
});

test('queen hang confirmed by engine-best capture is always surfaced as a blunder',()=>{
  const label=classifyReviewedMove({
    loss:0.08,
    ply:29,
    played:'f3e4',
    best:'f3d1',
    previousLabel:'Inaccuracy',
    queenHangConfirmed:true,
    queenTrade:false
  });
  assert.equal(label,'Blunder');
});

test('normal queen trade is not forced into a blunder',()=>{
  const label=classifyReviewedMove({
    loss:0.01,
    ply:21,
    played:'d1d8',
    best:'d1d8',
    previousLabel:'Best',
    queenHangConfirmed:true,
    queenTrade:true
  });
  assert.notEqual(label,'Blunder');
});

test('black mover loss uses the same expected-points direction correctly',()=>{
  const loss=moverExpectedPointLoss(-500,-100,30);
  assert.ok(loss>0.20);
  assert.equal(baseMoveClass(loss),'Blunder');
});
