import test from 'node:test';
import assert from 'node:assert/strict';
import { winPercent,moverWinLoss,lichessJudgement,moveAccuracy,classifyReviewedMove } from '../js/lichess-review.js';

test('Lichess win-percent curve is centered at 50%',()=>{
  assert.equal(Math.round(winPercent(0)),50);
  assert.ok(winPercent(300)>70);
  assert.ok(winPercent(-300)<30);
});

test('Lichess thresholds map 10/20/30 percentage-point winning-chance drops',()=>{
  // These cp pairs are chosen only to exercise the published threshold logic.
  const findAfter=(targetLoss)=>{let cp=0;while(moverWinLoss(0,cp,1)<targetLoss&&cp>-5000)cp-=5;return cp};
  assert.equal(lichessJudgement(0,findAfter(.11),1),'Inaccuracy');
  assert.equal(lichessJudgement(0,findAfter(.21),1),'Mistake');
  assert.equal(lichessJudgement(0,findAfter(.31),1),'Blunder');
});

test('same evaluation swing is interpreted from the mover perspective',()=>{
  assert.ok(moverWinLoss(200,-200,1)>.3);
  assert.ok(moverWinLoss(-200,200,2)>.3);
});

test('engine-best move remains Best unless it crosses a bad-move threshold',()=>{
  assert.equal(classifyReviewedMove({before:10,after:8,ply:1,played:'e2e4',best:'e2e4'}),'Best');
  assert.ok(moveAccuracy(10,8,1)>95);
});
