import {test,expect} from '@playwright/test';
import {seedHomeCommandCentre,seedHomeEngineReviews} from './fixtures/home-command-fixtures.mjs';
import {auditFeedback} from './fixtures/feedback-fixtures.mjs';
import {openHomeTopic} from './fixtures/home-sections.mjs';
import {assertNavigationUsable,waitForReviewExit} from './fixtures/navigation-fixtures.mjs';

async function dismissWelcome(page){if(await page.locator('#homeWelcomeSilent').isVisible())await page.locator('#homeWelcomeSilent').click();}

test('Home is a compact daily destination with real boards and focused drilldowns',async({page},info)=>{
  const errors=[],workers=[];page.on('pageerror',e=>errors.push(e.message));page.on('worker',worker=>workers.push(worker));
  await seedHomeCommandCentre(page);await dismissWelcome(page);
  await expect(page.locator('#homeSummary')).toBeVisible();await expect(page.locator('#homeStats')).toBeHidden();
  await expect(page.locator('#homePulsePools button')).toHaveCount(4);
  await expect(page.locator('#homeSummary .homeContinueAction:visible')).toHaveCount(1);
  await expect(page.locator('#homeSummary .homeRecentCard')).toHaveCount(5);
  await expect(page.locator('#homeSummary .homeMiniSquare')).toHaveCount(320);
  expect(await page.locator('#homeView').evaluate(node=>node.getBoundingClientRect().height)).toBeLessThan(1150);
  for(const selector of ['.homeGrowth','.homeWeekCard','.homeTrainingCard','.homeDnaCard','#homePulseChart'])await expect(page.locator(selector)).toBeHidden();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
  await assertNavigationUsable(page);
  await page.screenshot({path:info.outputPath('compact-home.png'),fullPage:true,animations:'disabled'});
  await page.locator('#homeRecentScroller').scrollIntoViewIfNeeded();await assertNavigationUsable(page);
  expect(workers).toHaveLength(0);expect(errors).toEqual([]);
});

test('rating taps and topic tabs share one accurate format selection without mixing ratings',async({page},info)=>{
  await seedHomeCommandCentre(page);await dismissWelcome(page);
  await page.locator('[data-pulse-format="rapid"]').click();await expect(page.locator('#homeTimeClass')).toHaveValue('rapid');
  await expect(page.locator('#homeMetrics strong')).toHaveText(['20','50%','1502']);
  await expect(page.locator('#homeResultsScope')).toContainText('20 saved standard-chess games · Rapid');
  await page.locator('[data-chart-days="7"]').click();await expect(page.locator('#homePulseChart svg')).toHaveAttribute('aria-label','Rapid saved ratings over 7 days');
  await page.screenshot({path:info.outputPath('stats-overview.png'),fullPage:true,animations:'disabled'});
  await openHomeTopic(page,'openings');await expect(page.locator('#homeOpeningInsights')).toContainText('Rapid');await expect(page.locator('#homePanel-overview')).toBeHidden();
  await page.locator('#homeTimeClass').selectOption('daily');await expect(page.locator('#homeDnaScope')).toContainText('20 saved standard-chess games · Daily');
  await expect(page.locator('#homeOpeningCount')).toContainText('Daily');if(await page.locator('#homeContinueOpening').isVisible())await expect(page.locator('#homeContinueOpening small')).toContainText('daily');await expect(page.locator('#homeOpeningInsights')).not.toContainText('Rapid');
  await page.screenshot({path:info.outputPath('stats-openings.png'),fullPage:true,animations:'disabled'});
  await openHomeTopic(page,'overview');await expect(page.locator('[data-chart-days="7"]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#homePulseChart')).toContainText('Two dated rated observations');await page.locator('[data-chart-days="30"]').click();await expect(page.locator('#homePulseChart svg')).toHaveAttribute('aria-label','Daily saved ratings over 30 days');
  await page.locator('#homeTimeClass').selectOption('all');await expect(page.locator('#homePulseChart svg')).toHaveCount(0);await expect(page.locator('#homePulseChart')).toContainText('separate scales');
  await expect(page.locator('#homeMetrics strong').first()).toHaveText('80');
});

test('keyboard topics, native Back, Forward and the on-screen Back preserve the destination',async({page})=>{
  await seedHomeCommandCentre(page);await dismissWelcome(page);
  const baseline=await page.evaluate(()=>history.length);
  await page.locator('[data-pulse-format="rapid"]').focus();await page.locator('[data-pulse-format="rapid"]').press('Enter');
  await expect(page.locator('#homeStatsTitle')).toBeFocused();
  await page.locator('#homeTopic-overview').focus();await page.keyboard.press('ArrowRight');await expect(page.locator('#homeTopic-openings')).toBeFocused();
  await expect(page.locator('#homeTopic-openings')).toHaveAttribute('aria-selected','true');await expect(page.locator('#homePanel-openings')).toBeVisible();
  await page.locator('#homeTimeClass').selectOption('blitz');await page.locator('#homeTopic-openings').focus();await page.keyboard.press('End');await expect(page.locator('#homeTopic-training')).toBeFocused();
  await expect(page.locator('#homeStatsFormat')).toBeHidden();await expect(page.locator('.homeTrainingCard')).toBeVisible();
  expect(await page.evaluate(()=>history.length)).toBe(baseline+1);
  const heights=await page.locator('.homeTopicTabs button,#homeStatsBack').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().height));expect(heights.every(height=>height>=44)).toBe(true);
  await page.goBack();await expect(page.locator('#homeSummary')).toBeVisible();await expect(page.locator('[data-pulse-format="rapid"]')).toBeFocused();
  await page.goForward();await expect(page.locator('#homePanel-training')).toBeVisible();await expect(page.locator('#homeTimeClass')).toHaveValue('blitz');
  await page.locator('#homeStatsBack').click();await expect(page.locator('#homeSummary')).toBeVisible();await assertNavigationUsable(page);
});

test('source reviews return to their topic and repeated exits keep mobile navigation usable',async({page},info)=>{
  test.setTimeout(90000);await seedHomeCommandCentre(page);await seedHomeEngineReviews(page);await dismissWelcome(page);
  await page.evaluate(()=>{const dismiss=()=>document.getElementById('reviewDepthCancel')?.click();new MutationObserver(dismiss).observe(document.body,{childList:true,subtree:true});dismiss();});
  await openHomeTopic(page,'growth');await page.locator('#homeCheckWeaknesses').click();await expect(page.locator('#homeWeaknessStatus')).toContainText('3 eligible saved Stockfish reviews');
  const finding=page.locator('.homeGrowthCard').filter({hasText:'Repeated verified blunders'});await finding.locator('summary').click();
  for(let cycle=0;cycle<10;cycle++){
    await finding.locator('[data-evidence-game]').first().click();await expect(page.locator('#analysisView')).toBeVisible();
    if(cycle%2)await page.goBack();else await page.locator('#back').click();
    await waitForReviewExit(page,'homeView');await expect(page.locator('#homePanel-growth')).toBeVisible();await assertNavigationUsable(page);
    await page.locator('#homeStatsBack').click();await expect(page.locator('#homeSummary')).toBeVisible();await assertNavigationUsable(page);
    await openHomeTopic(page,'growth');
  }
  await page.locator('#homeStatsBack').click();await expect(page.locator('#homeSummary')).toBeVisible();
  await page.screenshot({path:info.outputPath('home-after-ten-topic-review-exits.png'),animations:'disabled'});
});

test.describe('topic lifecycle',()=>{
  test.use({serviceWorkers:'block'});
  test('leaving a topic cancels its lazy review and offline tabs preserve account isolation',async({page})=>{
    await page.emulateMedia({reducedMotion:'reduce'});await seedHomeCommandCentre(page);await seedHomeEngineReviews(page);
    let release;const gate=new Promise(resolve=>release=resolve);
    await page.route('**/js/weakness-reviews.js',async route=>{await gate;await route.continue().catch(()=>{});});
    await openHomeTopic(page,'growth');await page.locator('#homeCheckWeaknesses').click();await expect(page.locator('#homeCancelWeaknesses')).toBeVisible();
    await openHomeTopic(page,'openings');release();await openHomeTopic(page,'growth');await expect(page.locator('#homeWeaknessStatus')).toContainText('paused');await expect(page.locator('#homeGrowthList')).not.toContainText('Saved Stockfish evidence');
    await page.context().setOffline(true);await openHomeTopic(page,'overview');await page.locator('#homeTimeClass').selectOption('daily');await expect(page.locator('#homePulseChart svg')).toBeVisible();
    await page.evaluate(()=>{localStorage.setItem('chess-username','no-games');dispatchEvent(new Event('chessImportFinished'));});
    await expect(page.locator('#homeMetrics strong').first()).toHaveText('0');await expect(page.locator('#homePulseChart')).toContainText('Two dated rated observations');
    await openHomeTopic(page,'openings');await expect(page.locator('#homeOpeningInsights')).not.toContainText('Italian Game');
    await page.locator('#homeStatsBack').click();await expect(page.locator('#homeSummary')).toBeVisible();await expect(page.locator('#homePulsePools')).not.toContainText('1502');
    await assertNavigationUsable(page);
  });
});


test('reloading a detail starts at Home and the next rating tap still has a Home return entry',async({page})=>{
  await seedHomeCommandCentre(page);await dismissWelcome(page);await page.locator('[data-pulse-format="rapid"]').click();
  await expect(page.locator('#homeStats')).toBeVisible();await page.reload();await expect(page.locator('#homeSummary')).toBeVisible();
  expect(await page.evaluate(()=>history.state.homeSection)).toBeUndefined();
  const baseline=await page.evaluate(()=>history.length);await page.locator('[data-pulse-format="blitz"]').click();await expect(page.locator('#homeTimeClass')).toHaveValue('blitz');
  expect(await page.evaluate(()=>history.length)).toBe(baseline+1);await page.locator('#homeStatsBack').click();await expect(page.locator('#homeSummary')).toBeVisible();await assertNavigationUsable(page);
});


test('opening personal stats stops the explicit welcome through the shared feedback controller',async({page})=>{
  await auditFeedback(page,{sound:null});await page.goto('/');await page.locator('#homeWelcomeSound').click();
  await expect.poll(()=>page.evaluate(()=>feedbackAudit.starts.length)).toBe(1);
  const stopped=await page.evaluate(()=>feedbackAudit.stops);await page.locator('[data-pulse-format="rapid"]').click();await expect(page.locator('#homeStats')).toBeVisible();
  expect(await page.evaluate(()=>feedbackAudit.stops)).toBeGreaterThan(stopped);expect(await page.evaluate(()=>feedbackAudit.contexts)).toBe(1);expect(await page.evaluate(()=>feedbackAudit.starts.length)).toBe(1);
});
