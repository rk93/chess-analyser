import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const main=await readFile('js/game-review.js','utf8');
const css=await readFile('review-experience.css','utf8');
test('mobile auto flow waits for saved cache lookup before prompting',()=>{
 assert.match(main,/gameReviewCacheChecked',handleAutoReviewCache/);
 assert.match(main,/gameReviewVerified',handleVerifiedAutoReview/);
 assert.match(main,/if\(complete\)return/);
 assert.match(main,/showDepthPrompt\(key\)/);
});
test('review mode is depth aware and does not trigger stale automatic upgrades',()=>{
 assert.match(main,/reviewDepthIsCurrent\(data,getReviewDepthPreset\(\)\)/);
 assert.match(main,/dispatchReady:!mobileReview\(\)\|\|complete/);
 assert.match(main,/reviewDepthIsCurrent\(saved,getReviewDepthPreset\(\)\)/);
});
test('autoplay starts only after game-identity verified completion',()=>{
 assert.match(main,/function handleVerifiedAutoReview/);
 assert.match(main,/key!==reviewKey\(\)/);
 assert.match(main,/startGuidedReview\(\)/);
 assert.match(main,/if\(btn&&!autoPlaying\)btn\.click\(\)/);
});
test('depth dialog supports accessible cancellation and saved preference',()=>{
 assert.match(main,/role="dialog" aria-modal="true"/);
 assert.match(main,/reviewDepthCancel/);
 assert.match(main,/REVIEW_DEPTH_SETTING,input\.value/);
 assert.match(css,/\.reviewDepthOverlay/);
 assert.match(css,/max-height:calc\(100dvh - 36px\)/);
});
test('switching games resets any modal and pending autoplay identity',()=>{
 assert.match(main,/function resetReviewUI\(\)\{resetAutoReviewFlow\(\);stopAutoPlay\(\)/);
});
