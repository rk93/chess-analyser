import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTacticalVerificationPlan, planIndexes } from '../js/review-tactics.js';
import { classifyReviewedMove } from '../js/review-scoring.js';

const PGN=`[Site "Chess.com"]
[Date "2026-09-16"]
[White "rk93"]
[Black "brilliancyorblunder123"]
[Result "1-0"]
[WhiteElo "1383"]
[BlackElo "1373"]
[TimeControl "600"]
1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Bc4 h6 5. c3 dxc3 6. Nxc3 Bb4 7. Qb3 Nf6 8.
Bxf7+ Kf8 9. O-O d6 10. Bc4 Bg4 11. Nd5 Nxe4 12. h3 Bxf3 13. Qxf3+ Nf6 14. a3
Nd4 15. Qe4 Bc5 16. b4 Bb6 17. Nxb6 Nxe4 18. Nxa8 Qxa8 19. Bb2 Nc6 20. Rfe1 Nf6
21. Re6 Ne5 22. Bxe5 dxe5 23. Rxe5 Qc8 24. Rae1 a6 25. Re7 Qf5 26. Rf7+ Kg8 27.
Rxf6+ 1-0`;

function sansFromPgn(pgn){
  return pgn
    .replace(/^\s*\[[^\]]+\]\s*$/gm,' ')
    .replace(/\{[^}]*\}/g,' ')
    .replace(/\d+\.(?:\.\.)?/g,' ')
    .replace(/\b(?:1-0|0-1|1\/2-1\/2|\*)\b/g,' ')
    .trim().split(/\s+/).filter(Boolean);
}

test('tactical pass deep-verifies the repeated hanging-queen sequence in regression PGN',()=>{
  const sans=sansFromPgn(PGN);
  assert.equal(sans[28],'Qe4');
  assert.equal(sans[29],'Bc5');
  assert.equal(sans[30],'b4');
  assert.equal(sans[31],'Bb6');
  assert.equal(sans[32],'Nxb6');
  assert.equal(sans[33],'Nxe4');

  const positions=Array.from({length:sans.length+1},(_,i)=>({fen:`p${i}`,ply:i}));
  const queenCapturePositions=new Set([29,31,33]);
  const plan=buildTacticalVerificationPlan({
    positions,
    sans,
    evals:new Array(positions.length).fill(0),
    positionExact:new Array(positions.length).fill(false),
    legalMoves:fen=>queenCapturePositions.has(Number(fen.slice(1)))?[{captured:'q',from:'f6',to:'e4'}]:[]
  });
  const indexes=new Set(planIndexes(plan));
  for(let i=28;i<=34;i++) assert.ok(indexes.has(i),`expected position ${i} to be deep verified`);
});

test('15.Qe4 in the regression PGN cannot be downgraded below blunder when the engine confirms Nxe4 wins the queen',()=>{
  const sans=sansFromPgn(PGN);
  assert.equal(sans[28],'Qe4');
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
