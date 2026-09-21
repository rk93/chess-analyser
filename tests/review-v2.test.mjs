import test from 'node:test';
import assert from 'node:assert/strict';
import {
  winPercent,moverWinLossPct,lichessBadMove,classifyStockfishMove,moveAccuracyFromLoss
} from '../js/review-v2-core.js';

test('Lichess Win% transform is symmetric around equality',()=>{
  assert.ok(Math.abs(winPercent(0)-50)<1e-9);
  assert.ok(Math.abs((winPercent(200)+winPercent(-200))-100)<1e-9);
});

test('Lichess bad-move thresholds are exact at 10/20/30 percentage points',()=>{
  assert.equal(lichessBadMove(9.999),null);
  assert.equal(lichessBadMove(10),'Inaccuracy');
  assert.equal(lichessBadMove(20),'Mistake');
  assert.equal(lichessBadMove(30),'Blunder');
});

test('mover perspective is correct for both colours',()=>{
  const whiteLoss=moverWinLossPct(150,-450,1);
  const blackLoss=moverWinLossPct(-150,450,2);
  assert.ok(whiteLoss>30);
  assert.ok(blackLoss>30);
});

test('large queen-like evaluation collapse is a blunder',()=>{
  const row=classifyStockfishMove({
    beforeCp:180,afterCp:-500,ply:29,played:'f3e4',best:'f3d1',
    secondBestCp:120,legalMoveCount:28,isBook:false
  });
  assert.equal(row.label,'Blunder');
  assert.ok(row.lossPct>=30);
});

test('engine-equivalent move within 10cp is Best even when UCI differs',()=>{
  const row=classifyStockfishMove({
    beforeCp:80,afterCp:72,ply:11,played:'c3d5',best:'f3e5',
    secondBestCp:20,legalMoveCount:25,isBook:false
  });
  assert.equal(row.label,'Best');
});

test('singular engine-equivalent choice can be Great',()=>{
  const row=classifyStockfishMove({
    beforeCp:100,afterCp:98,ply:15,played:'e4e5',best:'e4e5',
    secondBestCp:-80,legalMoveCount:30,isBook:false
  });
  assert.equal(row.label,'Great');
  assert.ok(row.onlyGapPct>=12);
});

test('move accuracy declines monotonically with Win% loss',()=>{
  assert.ok(moveAccuracyFromLoss(1)>moveAccuracyFromLoss(10));
  assert.ok(moveAccuracyFromLoss(10)>moveAccuracyFromLoss(30));
});
