import {test,expect} from '@playwright/test';
import {seedFeedbackReview} from './fixtures/feedback-fixtures.mjs';
import {holdReviewEngine,startPendingReview,waitForReviewEngineStart} from './fixtures/review-wait-fixtures.mjs';

test.describe('fresh review startup',()=>{
 test.use({serviceWorkers:'block'});
 for(const startupDelay of [0,9000])test(`local review starts without extra taps even when public preview requests never resolve (${startupDelay?'nine-second startup':'normal'})`,async({page},info)=>{
  await holdReviewEngine(page,2,{startupDelay});await page.goto('/');await seedFeedbackReview(page);
  await page.evaluate(async()=>{
   const {cacheSet,simpleHash}=await import('/js/analysis-store.js');await cacheSet('review',simpleHash('alpha 1400 — beta 1400|e4 e5 Nf3 Nc6 Bc4 Bc5'),null);
  });
  let release;const gate=new Promise(resolve=>release=resolve),requests=[];
  for(const pattern of ['https://lichess.org/api/cloud-eval**','https://chess-api.com/**'])await page.route(pattern,async route=>{requests.push(route.request().url());await gate;await route.abort().catch(()=>{});});
  try{
   await startPendingReview(page);
   await waitForReviewEngineStart(page);
   await expect(page.locator('#reviewWaitCount')).toContainText('2 / 7 positions analysed',{timeout:8000});
   expect(requests).toHaveLength(0);
   await page.screenshot({path:info.outputPath('review-starts-without-tip.png'),animations:'disabled'});
  }finally{release();}
 });
 test('a game-open action can start review immediately without a later title reset invalidating it',async({page},info)=>{
  await holdReviewEngine(page,2);await page.goto('/');await seedFeedbackReview(page);
  await page.evaluate(async()=>{
   const {cacheSet,simpleHash}=await import('/js/analysis-store.js');await cacheSet('review',simpleHash('alpha 1400 — beta 1400|e4 e5 Nf3 Nc6 Bc4 Bc5'),null);
   // Exercise the app's real game-open lifecycle, as an immediate start action
   // would: the game card and existing Review button still own every change.
   addEventListener('savedGameOpened',()=>document.getElementById('runReview').click(),{once:true});
  });
  await page.locator('#gamesTab').click();await page.locator('.gameWithAvatar').click();
  await waitForReviewEngineStart(page);await expect(page.locator('#reviewWaitCount')).toContainText('2 / 7 positions analysed',{timeout:8000});
  await expect(page.locator('#reviewDepthPrompt')).toHaveCount(0);await expect(page.locator('#runReview')).toBeDisabled();
  await page.screenshot({path:info.outputPath('immediate-game-open-review.png'),animations:'disabled'});
 });
 test('a cold native review completes and starts playback without a tip click',async({page},info)=>{
  test.setTimeout(60000);await page.addInitScript(()=>{window.nativeReadyNotices=0;addEventListener('gameReviewReady',e=>{if(e.detail?.verificationComplete)nativeReadyNotices++;});});await holdReviewEngine(page,Number.MAX_SAFE_INTEGER);await page.goto('/');await seedFeedbackReview(page);
  await page.evaluate(async()=>{const {cacheSet,simpleHash}=await import('/js/analysis-store.js');await cacheSet('review',simpleHash('alpha 1400 — beta 1400|e4 e5 Nf3 Nc6 Bc4 Bc5'),null);});
  await startPendingReview(page);await expect.poll(()=>page.evaluate(()=>reviewEngineAudit.verified),{timeout:30000}).toBe(1);
  await expect(page.locator('#reviewWaitPanel')).toBeHidden();await expect.poll(()=>page.evaluate(()=>nativeReadyNotices)).toBe(1);await expect(page.locator('#reviewGuideMove')).not.toHaveText('Game review');
  if(page.viewportSize().width<=800)await expect.poll(async()=>Number((await page.locator('#reviewPlaybackProgress').textContent()).split(' / ')[0])).toBeGreaterThanOrEqual(2);
  await page.screenshot({path:info.outputPath('review-completes-without-tip.png'),animations:'disabled'});
 });
 test('slow worker startup advances automatically and changing tips does not duplicate verification',async({page})=>{
  await holdReviewEngine(page,2);await page.goto('/');await seedFeedbackReview(page);
  await page.evaluate(async()=>{const {cacheSet,simpleHash}=await import('/js/analysis-store.js');await cacheSet('review',simpleHash('alpha 1400 — beta 1400|e4 e5 Nf3 Nc6 Bc4 Bc5'),null);});
  let release;const gate=new Promise(resolve=>release=resolve);await page.route('**/engine/stockfish-19-lite-single.js',async route=>{await gate;await route.continue().catch(()=>{});});
  await startPendingReview(page);await expect(page.locator('#reviewWaitTitle')).toHaveText('Getting Stockfish ready');release();
  await expect(page.locator('#reviewWaitCount')).toContainText('2 / 7 positions analysed',{timeout:20000});
  const before=await page.evaluate(()=>reviewEngineAudit.go);const tip=await page.locator('#reviewWaitTip').textContent();await page.locator('#reviewWaitNextTip').click();await expect(page.locator('#reviewWaitTip')).not.toHaveText(tip);expect(await page.evaluate(()=>reviewEngineAudit.go)).toBe(before);
  await page.locator('#reviewWaitCancel').click();await expect.poll(()=>page.evaluate(()=>reviewEngineAudit.stop)).toBe(1);
 });
 test('a failed engine startup offers retry and then completes without tip interaction',async({page})=>{
  test.setTimeout(60000);await holdReviewEngine(page,Number.MAX_SAFE_INTEGER);await page.goto('/');await seedFeedbackReview(page);
  await page.evaluate(async()=>{const {cacheSet,simpleHash}=await import('/js/analysis-store.js');await cacheSet('review',simpleHash('alpha 1400 — beta 1400|e4 e5 Nf3 Nc6 Bc4 Bc5'),null);});
  await page.route('**/engine/stockfish-19-lite-single.js',route=>route.abort());await startPendingReview(page);
  await expect(page.locator('#reviewWaitTitle')).toHaveText('This review needs another try',{timeout:20000});await expect(page.locator('#reviewWaitRetry')).toBeVisible();
  await page.unroute('**/engine/stockfish-19-lite-single.js');await page.locator('#reviewWaitRetry').click();await expect.poll(()=>page.evaluate(()=>reviewEngineAudit.verified),{timeout:30000}).toBe(1);await expect(page.locator('#reviewWaitPanel')).toBeHidden();
 });

});
