import {test,expect} from '@playwright/test';
import {auditFeedback,seedFeedbackReview} from './fixtures/feedback-fixtures.mjs';
import {holdReviewEngine,seedPendingReview,reviewEngineState,waitForReviewEngineStart} from './fixtures/review-wait-fixtures.mjs';
import {NAV_TABS,assertNavigationUsable,waitForReviewExit} from './fixtures/navigation-fixtures.mjs';

// Data fixtures only: every transition uses a real saved-game click, app Back,
// browser history or a visible tab. Never simulate routing with DOM/CSS writes.
test('twenty cached review exits keep every tab visible, positioned and clickable across ten full journeys',async({page},info)=>{
  test.setTimeout(120000);await auditFeedback(page,{sound:null});await page.goto('/');await seedFeedbackReview(page);
  for(let cycle=0;cycle<10;cycle++){
    for(let visit=0;visit<2;visit++){
      await page.locator('#homeDashboardTab').click();await page.locator('#gamesTab').click();await page.locator('.gameWithAvatar').click();await expect(page.locator('#analysisView')).toBeVisible();
      if(page.viewportSize().width<=800)await expect(page.locator('.modernNav')).toBeHidden();
      if((cycle+visit)%2)await page.goBack();else await page.locator('#back').click();
      await waitForReviewExit(page);
      if(cycle===0&&visit===0)await page.screenshot({path:info.outputPath('after-first-cache-exit.png'),animations:'disabled'});
      await page.locator('#homeDashboardTab').click();await expect(page.locator('#homeView')).toBeVisible();await assertNavigationUsable(page);
    }
    // Actually activate all eight destinations, beyond actionability/DOM tests.
    for(const [tab,view] of NAV_TABS){await page.locator('#'+tab).click();await expect(page.locator('#'+view)).toBeVisible();await assertNavigationUsable(page);}
  }
  await page.locator('#homeDashboardTab').click();await page.screenshot({path:info.outputPath('after-ten-navigation-journeys.png'),animations:'disabled'});
});

for(const [scenario,engineOptions] of [['normal',{}],['six-second startup',{startupDelay:6000}],['unresponsive stop',{stopMode:'drop'}],['worker crash on stop',{stopMode:'crash'}]])test(`review cancellation, native Stockfish completion, reopening and browser Back preserve navigation (${scenario})`,async({page},info)=>{
  test.setTimeout(120000);await auditFeedback(page,{sound:null});await holdReviewEngine(page,0,engineOptions);await page.goto('/');await seedPendingReview(page);
  try{
  const open=async()=>{await page.locator('#gamesTab').click();await page.locator('.gameWithAvatar').click();await expect(page.locator('#analysisView')).toBeVisible();};
  const start=async()=>{if(page.viewportSize().width<=800){await expect(page.locator('#reviewDepthStart')).toBeVisible();await page.locator('#reviewOpenDepth').selectOption('fast');await page.locator('#reviewDepthStart').click();}else await page.locator('#runReview').click();};
  // Stockfish owns a ten-second startup deadline. Five seconds failed valid
  // cold starts; include polling overhead, without extending verification.
  await open();await start();await waitForReviewEngineStart(page);
  await page.locator('#reviewWaitCancel').click();await expect.poll(()=>page.evaluate(()=>reviewEngineAudit.stop)).toBeGreaterThan(0);
  await page.locator('#back').click();await waitForReviewExit(page);await page.screenshot({path:info.outputPath('after-cancelled-review.png'),animations:'disabled'});
  await page.evaluate(()=>{window.holdEngineAfter=Infinity});await open();await start();
  await expect.poll(async()=>{const state=await reviewEngineState(page);return state.verified?'verified':JSON.stringify(state);},{timeout:60000}).toBe('verified');await expect(page.locator('#reviewStatus')).toContainText(/(?:Verified review ready|Stockfish Review v2 ready)/);
  if(engineOptions.stopMode)expect((await reviewEngineState(page)).audit).toMatchObject({workers:2,terminated:1});
  await page.goBack();await waitForReviewExit(page);await page.screenshot({path:info.outputPath('after-completed-review.png'),animations:'disabled'});
  await open();await expect(page.locator('#reviewGuideCard')).toBeVisible();await page.waitForTimeout(180);
  const cache=await page.evaluate(async()=>{const {cacheGet,simpleHash}=await import('/js/analysis-store.js');const d=await cacheGet('review',simpleHash('alpha 1400 — beta 1400|e4 e5 Nf3 Nc6 Bc4 Bc5'));return{version:d?.version,verified:d?.verifiedReviewVersion,stockfish:d?.localStockfishVersion,preset:d?.reviewDepthKey,base:d?.reviewBaseDepth,critical:d?.reviewCriticalDepth,depths:d?.localDepths,best:d?.bestMoves,exact:d?.positionExact,prompt:!!document.getElementById('reviewDepthPrompt')}});
  expect(cache.verified).toBe(1);expect(cache.stockfish).toBe(21);expect(cache.preset).toBe('fast');expect(cache.prompt).toBe(false);await info.attach('reopened-review-cache',{body:JSON.stringify(cache,null,2),contentType:'application/json'});
  await page.locator('#back').click({timeout:5000});await waitForReviewExit(page);
  await page.goForward();await expect(page.locator('#analysisView')).toBeVisible();await page.goBack();await waitForReviewExit(page);
  }finally{if(!page.isClosed())await info.attach('review-engine-lifecycle',{body:JSON.stringify(await reviewEngineState(page),null,2),contentType:'application/json'});}
});

test('ten Home recent-game exits restore Home through app and browser Back without late dialogs',async({page},info)=>{
  test.setTimeout(120000);await auditFeedback(page,{sound:null});await page.goto('/');await seedFeedbackReview(page);
  for(let cycle=0;cycle<10;cycle++){
    await page.locator('#homeDashboardTab').click();await page.locator('.homeRecentCard').first().click();await expect(page.locator('#analysisView')).toBeVisible();
    if(cycle%2)await page.goBack();else await page.locator('#back').click();await waitForReviewExit(page,'homeView');
    await expect(page.locator('#reviewDepthPrompt')).toHaveCount(0);await expect(page.locator('#reviewSummaryScreen')).toBeHidden();
  }
  await page.screenshot({path:info.outputPath('after-ten-home-review-exits.png'),animations:'disabled'});
});
