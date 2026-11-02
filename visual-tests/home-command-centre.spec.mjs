import {test,expect} from '@playwright/test';
import {seedHomeCommandCentre,seedHomeEngineReviews,homeCommandGames} from './fixtures/home-command-fixtures.mjs';

test('Home pulse is interactive, format-specific and personalised without fetching or engine work',async({page},info)=>{
  const workers=[],errors=[];page.on('worker',worker=>workers.push(worker));page.on('pageerror',error=>errors.push(error.message));
  await seedHomeCommandCentre(page);
  await expect(page.locator('#homePulsePools button')).toHaveCount(4);
  await expect(page.locator('#homePulseChart svg')).toBeVisible();
  await expect(page.locator('#homePulseDelta')).toContainText('7 days: -8 points');
  const latest=await page.locator('#homePulseReadout').textContent();
  await page.locator('#homePulseCursor').focus();await page.locator('#homePulseCursor').press('Home');
  await expect(page.locator('#homePulseReadout')).not.toHaveText(latest);
  await expect(page.locator('#homePulseReadout')).toContainText('observation 1/');
  await page.locator('[data-pulse-format="bullet"]').click();await expect(page.locator('#homePulseDelta')).toContainText('Bullet');
  await expect(page.locator('[data-pulse-format="bullet"]')).toBeFocused();
  await page.locator('[data-chart-days="7"]').click();await expect(page.locator('#homePulseChart svg')).toHaveAttribute('aria-label','Bullet saved ratings over 7 days');
  await expect(page.locator('#homeInsightText')).toContainText('Italian Game');
  await expect(page.locator('.homeGrowthCard')).toHaveCount(3);
  await expect(page.locator('.homeGrowthCard').first()).toContainText('Game-history observation');
  await expect(page.locator('#homeWeaknessStatus')).toContainText('has not been checked');
  await expect(page.locator('#homeMilestoneList')).toContainText('Rapid personal best');
  await expect(page.locator('#homeRecentScroller .homeRecentOpening')).toHaveCount(5);
  expect(workers).toHaveLength(0);expect(errors).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:info.outputPath('home-command-centre-after.png'),fullPage:true,animations:'disabled'});
});
test('result patterns cannot become engine findings and unchecked games are not considered clean',async({page})=>{
  await seedHomeCommandCentre(page);const workers=[];page.on('worker',worker=>workers.push(worker));
  await expect(page.locator('#homeGrowthList')).not.toContainText('Saved Stockfish evidence');
  await page.locator('#homeCheckWeaknesses').click();
  await expect(page.locator('#homeWeaknessStatus')).toContainText('0 eligible saved Stockfish reviews / 60 games checked');
  await expect(page.locator('#homeGrowthList')).not.toContainText('Saved Stockfish evidence');
  await expect(page.locator('#homeWeaknessStatus')).toContainText('unchecked games are not treated as mistake-free');expect(workers).toHaveLength(0);
});
test('a shallow saved review cannot satisfy the three-game engine evidence threshold',async({page})=>{
  await seedHomeCommandCentre(page);await seedHomeEngineReviews(page);
  await page.evaluate(async()=>{
    const {cacheGet,cacheSet,simpleHash}=await import('/js/analysis-store.js');
    const key=simpleHash('alpha 1500 — engine-source-0 1520|f3 e5 g4 Qh4#'),data=await cacheGet('review',key);
    data.localDepths[0]=4;await cacheSet('review',key,data);
  });
  await page.locator('#homeCheckWeaknesses').click();await expect(page.locator('#homeWeaknessStatus')).toContainText('2 eligible saved Stockfish reviews / 60 games checked');
  await expect(page.locator('#homeGrowthList')).not.toContainText('Saved Stockfish evidence');
  await expect(page.locator('.homeVerifiedBadge')).toHaveCount(2);
  await page.evaluate(()=>window.dispatchEvent(new Event('gameReviewUpdated')));
  await expect(page.locator('.homeVerifiedBadge')).toHaveCount(0);
  await expect(page.locator('#homeWeaknessStatus')).toContainText('evidence changed');
});
test('real Stockfish saved positions produce recurring evidence and link to the exact board and source game',async({page})=>{
  await seedHomeCommandCentre(page);await seedHomeEngineReviews(page,{realEngine:true});
  await expect(page.locator('#homeMetrics strong').first()).toHaveText('83');
  const workers=[];page.on('worker',worker=>workers.push(worker));
  await page.locator('#homeCheckWeaknesses').click();
  await expect(page.locator('#homeWeaknessStatus')).toContainText('3 eligible saved Stockfish reviews / 60 games checked');
  const finding=page.locator('.homeGrowthCard').filter({hasText:'Repeated verified blunders'});await expect(finding).toContainText('3 supporting / 3 eligible games');
  await expect(finding).toContainText('depth ≥8');await finding.locator('summary').click();
  await finding.locator('[data-evidence-position]').first().click();await expect(page.locator('#boardLabView')).toBeVisible();
  await expect(page.locator('#labBoard [data-square="g2"] .labPiece')).toHaveCount(1);
  await expect(page.locator('#labBoard [data-square="g4"] .labPiece')).toHaveCount(0);
  await expect(page.locator('#labBoard [data-square="f3"] .labPiece')).toHaveCount(1);
  await expect(page.locator('#labLine')).toContainText('Custom position loaded');
  await page.goBack();await expect(page.locator('#homeView')).toBeVisible();
  await page.evaluate(()=>{const dismiss=()=>document.getElementById('reviewDepthCancel')?.click();new MutationObserver(dismiss).observe(document.body,{childList:true,subtree:true});dismiss()});
  await finding.locator('[data-evidence-game]').first().click();await expect(page.locator('#analysisView')).toBeVisible();
  await expect(page.locator('#gameTitle')).toContainText('engine-source-0');
  await expect(page.locator('#moves .move.active')).toContainText('e5');
  expect(workers).toHaveLength(0);
});
test('resume returns to a real saved move, survives reload and stays scoped to its account',async({page})=>{
  await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{const dismiss=()=>document.getElementById('reviewDepthCancel')?.click();new MutationObserver(dismiss).observe(document.body,{childList:true,subtree:true});dismiss()}));
  await seedHomeCommandCentre(page);
  await page.evaluate(()=>{const dismiss=()=>document.getElementById('reviewDepthCancel')?.click();new MutationObserver(dismiss).observe(document.body,{childList:true,subtree:true});dismiss()});
  await page.locator('.homeRecentCard').first().click();await expect(page.locator('#analysisView')).toBeVisible();
  await page.locator('#next').click();await page.locator('#next').click();
  await page.goBack();await expect(page.locator('#homeResumeReview')).toBeVisible();
  await page.reload();await page.locator('#homeResumeReview').click();await expect(page.locator('#moves .move.active')).toContainText('e5');
  await page.goBack();
  await page.evaluate(()=>{localStorage.setItem('chess-username','other-account');window.dispatchEvent(new Event('chessImportFinished'))});
  await expect(page.locator('#homeMetrics strong').first()).toHaveText('0');await expect(page.locator('#homeResumeReview')).toBeHidden();
  await expect(page.locator('#homeMilestoneList')).not.toContainText('1500');await expect(page.locator('#homeGrowthList')).not.toContainText('Italian Game');
});
test('opening and practice shortcuts reuse existing flows and navigation',async({page})=>{
  await seedHomeCommandCentre(page);
  await page.locator('#homeContinueOpening').click();await expect(page.locator('#boardLabView')).toBeVisible();await expect(page.locator('#labSource')).toContainText('Opening study');
  await page.goBack();await expect(page.locator('#homeView')).toBeVisible();
  await page.locator('#homeContinuePractice').click();await expect(page.locator('#homeTrainingStatus')).toContainText('0 distinct verified practice positions');
  await page.locator('#homeAnalyticsLink').click();await expect(page.locator('#analyticsView')).toBeVisible();
  await page.goBack();await expect(page.locator('#homeView')).toBeVisible();
});
test.describe('controlled lazy review timing',()=>{
  test.use({serviceWorkers:'block'});
  test('cancel, retry and account changes cannot reveal late review evidence',async({page})=>{
    await seedHomeCommandCentre(page);await seedHomeEngineReviews(page);
    let release;const gate=new Promise(resolve=>{release=resolve});
    await page.route('**/js/weakness-reviews.js',async route=>{await gate;await route.continue().catch(()=>{})});
    await page.locator('#homeCheckWeaknesses').click();await expect(page.locator('#homeCancelWeaknesses')).toBeVisible();
    await page.locator('#homeCancelWeaknesses').click();await expect(page.locator('#homeWeaknessStatus')).toContainText('paused');
    release();await page.locator('#homeCheckWeaknesses').click();await expect(page.locator('#homeGrowthList')).toContainText('Saved Stockfish evidence');
    await page.evaluate(()=>{localStorage.setItem('chess-username','other-account');window.dispatchEvent(new Event('chessImportFinished'))});
    await expect(page.locator('#homeGrowthList')).not.toContainText('Saved Stockfish evidence');await expect(page.locator('#homeMetrics strong').first()).toHaveText('0');
  });
  test('navigation cancels pending scans and old account completions stay hidden',async({page})=>{
    await seedHomeCommandCentre(page);await seedHomeEngineReviews(page);
    let release;const gate=new Promise(resolve=>{release=resolve});
    await page.route('**/js/weakness-reviews.js',async route=>{await gate;await route.continue().catch(()=>{})});
    await page.locator('#homeCheckWeaknesses').click();await page.locator('#gamesTab').click();await page.locator('#homeDashboardTab').click();
    await expect(page.locator('#homeWeaknessStatus')).toContainText('paused');
    await page.evaluate(()=>{localStorage.setItem('chess-username','new-account');window.dispatchEvent(new Event('chessGamesImported'))});
    const response=page.waitForResponse(response=>response.url().endsWith('/js/weakness-reviews.js'));release();await response;
    await expect(page.locator('#homeMetrics strong').first()).toHaveText('0');await expect(page.locator('#homeGrowthList')).not.toContainText('Saved Stockfish evidence');
  });
});
test('empty and corrupt data offer useful states, accessible targets and reduced motion',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await seedHomeCommandCentre(page);
  const heights=await page.locator('.homePulsePools button,.homeChartPeriods button,#homeCheckWeaknesses,#homeContinuePractice').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().height));expect(heights.every(h=>h>=44)).toBe(true);
  await page.evaluate(()=>{localStorage.setItem('chess-username','no-games');localStorage.setItem('chess-home-review:no-games','{bad');window.dispatchEvent(new Event('chessImportFinished'))});
  await expect(page.locator('#homeMetrics strong').first()).toHaveText('0');await expect(page.locator('#homeGrowthList')).toContainText('No pattern meets the evidence minimum');
  await expect(page.locator('#homePulseChart')).toContainText('Two dated rated observations');await expect(page.locator('#homeResumeReview')).toBeHidden();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
});
