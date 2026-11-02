import test from 'node:test';
import assert from 'node:assert/strict';
import { verifiedPracticeCandidates, recordTrainingAttempt } from '../js/personal-training-core.js';
const moves = [
  { color: 'w', from: 'a2', to: 'a3', san: 'a3', before: 'start w KQkq - 0 1' },
  { color: 'b', from: 'e7', to: 'e5', san: 'e5', before: 'after b KQkq - 0 1' },
];
const review = () => ({ verifiedReviewVersion: 1, labels: ['Mistake', 'Blunder'], evals: [20, -100, 0],
  bestMoves: ['e2e4', 'g8f6'], moveVerified: [true, true], positionExact: [true, true, true], localDepths: [12, 12, 12] });
test('only the selected side gets practice exercises, with promotion-safe UCI and source FEN', () => {
  const candidates = verifiedPracticeCandidates(moves, review(), true);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].bestMove, 'e2e4');
  assert.equal(candidates[0].fen, moves[0].before);
  assert.equal(verifiedPracticeCandidates(moves, review(), false)[0].bestMove, 'g8f6');
});
test('estimated, incomplete, low-depth, unknown-version or malformed reviews cannot generate training', () => {
  for (const change of [
    { verifiedReviewVersion: 0 }, { labels: ['Mistake'] }, { evals: [0] }, { evals: [0, NaN, 0] },
    { positionExact: [true, false, true] }, { moveVerified: [false, false] },
    { localDepths: [7, 7, 7] }, { localDepths: [] }, { bestMoves: ['bad', 'bad'] }, { bestMoves: ['a2a3', 'e7e5'] },
  ]) assert.deepEqual(verifiedPracticeCandidates(moves, { ...review(), ...change }, true), []);
});
test('progress tracks attempts, successful and assisted practice without mutating prior records', () => {
  const first = recordTrainingAttempt(null, { correct: false }, 100);
  const second = recordTrainingAttempt(first, { correct: true, revealed: true }, 200);
  assert.equal(first.attempts, 1);
  assert.equal(first.correct, 0);
  assert.deepEqual(second, { attempts: 2, correct: 1, assisted: 1, solvedAt: 200, updated: 200 });
  assert.equal(recordTrainingAttempt({ attempts: -5, correct: 'bad' }, { correct: true }, 300).attempts, 1);
});

test('underpromotion exercises wait until the practice board supports choosing a piece', () => {
  assert.deepEqual(verifiedPracticeCandidates(moves, { ...review(), bestMoves: ['a7a8n','g8f6'] }, true), []);
});
