import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile('js/game-review.js','utf8');
const css=await readFile('review-experience.css','utf8');
test('wide review docks card before the analysis shell',()=>{
  const fn=source.split('function positionReviewCard(){')[1].split('function ensureGuideCard(){')[0];
  assert.match(fn,/min-width: 1100px/);
  assert.match(fn,/layout\.prepend\(card\)/);
  assert.match(fn,/layout\.append\(shell\)/);
});
test('review wrapper persists across breakpoints',()=>{
  const fn=source.split('function positionReviewCard(){')[1].split('function ensureGuideCard(){')[0];
  assert.match(fn,/layout\.prepend\(card\)/);
  assert.match(fn,/layout\.append\(shell\)/);
  assert.match(source,/addEventListener\('resize',positionReviewCard/);
});
test('desktop layout limits coach height and retains room for chessboard',()=>{
  assert.match(css,/@media\(min-width:1100px\)/);
  assert.match(css,/grid-template-columns:minmax\(255px,300px\) minmax\(0,1fr\)/);
  assert.match(css,/max-height:calc\(100dvh - 24px\)/);
  assert.match(css,/:has\(> #reviewGuideCard\[hidden\]\)/);
});

test('review evaluations use side to move rather than fixed White perspective',async()=>{
 const source=await readFile('js/game-review.js','utf8');
 assert.match(source,/function reviewSideToMove\(ply\)/);
 assert.match(source,/fen\.split\(' '\)\[1\]/);
 assert.match(source,/scoreLabel\(side==='w'\?cp:-\(Number\(cp\)\|\|0\)\)/);
 assert.match(source,/showReviewPerspective\(after,ply\)/);
});

test('Game Review progress never fetches position statistics',async()=>{
 const source=await readFile('js/game-review.js','utf8');
 const styles=await readFile('ux-shell.css','utf8');
 assert.equal(source.includes('prefetchPositionStats')||source.includes('fetchPositionStats')||source.includes('explorer.lichess.org/masters'),false);
 assert.match(source,/function showReviewProgress\\(ply\\)/);
 assert.match(source,/showReviewProgress\\(ply\\)/);
 assert.match(source,/aria-valuenow/);
 assert.match(styles,/reviewMoveProgressTrack/);
});
