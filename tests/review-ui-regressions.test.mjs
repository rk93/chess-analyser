import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('the reliability layer never overwrites prefetched MultiPV display',async()=>{
  const src=await readFile('js/review-reliability.js','utf8');
  const section=src.split('function renderPreparedBest(i){')[1]?.split('async function showBest()')[0]||'';
  assert.match(section,/game-review\.js owns/);
  assert.doesNotMatch(section,/\.innerHTML\s*=/);
  assert.doesNotMatch(section,/drawWhenReady\(/);
});

test('flipping or changing piece theme refreshes review arrows and badges',async()=>{
  const app=await readFile('js/app.js','utf8');
  const review=await readFile('js/game-review.js','utf8');
  assert.match(app,/function rerenderAppearance\(\).*reviewBoardRedrawn/);
  assert.match(app,/\$\('flip'\)\.onclick=.*reviewBoardRedrawn/);
  assert.match(review,/addEventListener\('reviewBoardRedrawn',\(\)=>\{lastRenderedPly=-1;scheduleCurrentMove\(\)\}/);
});
