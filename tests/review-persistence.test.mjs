import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const review=await readFile('js/game-review.js','utf8');
const verifier=await readFile('js/review-corrections.js','utf8');
test('restoration rechecks game identity and generation after IndexedDB await',()=>{
  assert.match(review,/generation!==reviewToken\|\|key!==reviewKey\(\)/);
  assert.match(review,/requestedToken!==reviewToken\|\|key!==reviewKey\(\)/);
});
test('cached completed reviews report readiness without reopening summary',()=>{
  assert.match(review,/gameReviewCacheChecked/);
  assert.match(review,/showSummary:!complete/);
  assert.match(review,/showSummary:false/);
});
test('verification rechecks game identity across async writes',()=>{
  assert.match(verifier,/detail\?\.key&&detail\.key!==originalKey/);
  assert.match(verifier,/if\(originalKey!==reviewKey\(\)\)return/);
  assert.match(verifier,/gameReviewVerified/);
});
