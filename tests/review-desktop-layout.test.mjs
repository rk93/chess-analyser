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
 assert.ok(source.includes('function showReviewProgress(ply)'));
 assert.ok(source.includes('showReviewProgress(ply);'));
 assert.ok(source.includes('aria-valuenow'));
 assert.ok(styles.includes('reviewMoveProgressTrack'));
});

test('Pip Coach V2 only offers mistake practice with verified Stockfish evidence',async()=>{
 const review=await readFile('js/game-review.js','utf8');
 const lab=await readFile('js/lab.js','utf8');
 assert.ok(review.includes("verified&&(label==='Mistake'||label==='Blunder')"));
 assert.ok(review.includes("practice.textContent='Practise this mistake'"));
 assert.ok(review.includes("Stockfish's verified best move"));
 assert.ok(lab.includes('function ensurePracticeCoachActions()'));
 assert.ok(lab.includes("reveal.textContent='Reveal best move'"));
 assert.ok(lab.includes("That isn't Stockfish's top choice"));
 assert.ok(lab.includes("resetLab"));
});

test('Repeated verification cannot restart a review already playing',async()=>{
 const source=await readFile('js/game-review.js','utf8');
 assert.ok(source.includes("reviewPlaybackStartedKey===key"));
 assert.ok(source.includes("reviewPlaybackStartedKey=key"));
 assert.ok(source.includes("reviewPlaybackStartedKey=''"));
});
test('Mobile bottom tabs reappear after review closes',async()=>{
 const css=await readFile('ux-shell.css','utf8');
 const app=await readFile('js/app.js','utf8');
 assert.ok(css.includes('body:not(:has(#analysisView[style*="display: block"])) .homeTabs.modernNav'));
 assert.ok(app.includes("document.querySelector('.homeTabs')?.style.removeProperty('display')"));
});

test('Review uses bounded local Stockfish and saves a reusable verified result',async()=>{
 const source=await readFile('js/game-review.js','utf8');
 const run=source.slice(source.indexOf('async function runReview(){'),source.indexOf('function resetReviewUI(){'));
 assert.ok(run.includes('getLocalStockfish()'));
 assert.ok(run.includes('movetime:maxMs'));
 assert.ok(run.includes('clearHash:false'));
 assert.ok(run.includes('reviewDepthKey:preset.key'));
 assert.ok(run.includes('verifiedReviewVersion:VERIFIED_REVIEW_VERSION'));
 assert.ok(run.includes('localDepths,localPvs,localMultiLines'));
 assert.ok(!run.includes('await runCloudPass('));
 assert.ok(!run.includes('await deepLiveEval('));
 assert.ok(!run.includes('await liveEval('));
});
