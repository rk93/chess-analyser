import {openHomeTopic} from './fixtures/home-sections.mjs';
import {test,expect} from '@playwright/test';
import {auditFeedback} from './fixtures/feedback-fixtures.mjs';
import {seedHomeCommandCentre} from './fixtures/home-command-fixtures.mjs';
import {holdReviewEngine,seedPendingReview,startPendingReview} from './fixtures/review-wait-fixtures.mjs';
const sounds=page=>page.evaluate(()=>feedbackAudit.starts.length);

test('Pip welcome is explicit, uses the shared context once, persists and cancels on navigation',async({page},info)=>{
  await auditFeedback(page,{sound:null});await page.goto('/');await expect(page.locator('#homeWelcome')).toBeVisible();
  expect(await sounds(page)).toBe(0);expect(await page.evaluate(()=>feedbackAudit.contexts)).toBe(0);
  await page.screenshot({path:info.outputPath('pip-welcome-after.png'),animations:'disabled'});
  await page.locator('#homeWelcomeSound').click();await expect.poll(()=>sounds(page)).toBe(1);await expect(page.locator('#homeWelcome')).toHaveCount(0);
  expect(await page.evaluate(()=>feedbackAudit.starts[0].duration)).toBeCloseTo(4.3);expect(await page.evaluate(()=>feedbackAudit.gains[0])).toBeCloseTo(.14*.35);
  await page.locator('#settingsNav').click();expect(await page.evaluate(()=>feedbackAudit.stops)).toBeGreaterThan(0);await expect(page.locator('#soundMode')).toHaveValue('on');
  await page.reload();await expect(page.locator('#homeWelcome')).toHaveCount(0);expect(await sounds(page)).toBe(0);
});
test('silent welcome respects existing mute and existing enabled sound preferences',async({page})=>{
  await auditFeedback(page,{sound:'off'});await page.goto('/');await expect(page.locator('#homeWelcomeSound')).toBeDisabled();
  await page.locator('#homeWelcomeSilent').click();expect(await sounds(page)).toBe(0);expect(await page.evaluate(()=>localStorage.getItem('chess-analyser-pref:sound'))).toBe('off');
  await page.evaluate(()=>{localStorage.removeItem('chess-pip-welcome-v1');localStorage.setItem('chess-analyser-pref:sound','on')});await page.reload();
  await page.locator('#homeWelcomeSilent').click();expect(await sounds(page)).toBe(0);expect(await page.evaluate(()=>localStorage.getItem('chess-analyser-pref:sound'))).toBe('on');
});
test('welcome works with reduced motion and unavailable audio or haptic hardware',async({page})=>{
  await auditFeedback(page,{sound:null,unavailable:true});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
  await page.locator('#homeWelcomeSound').click();await expect(page.locator('#homeWelcome')).toHaveCount(0);expect(await sounds(page)).toBe(0);expect(await page.evaluate(()=>feedbackAudit.errors)).toEqual([]);
  expect(await page.evaluate(()=>feedbackAudit.animations.length)).toBe(0);await page.locator('#gamesTab').click();await expect(page.locator('#libraryView')).toBeVisible();
});
test('Home rating slider has throttled haptics and separately opt-in audio without background ticks',async({page})=>{
  await auditFeedback(page,{sound:'off'});await seedHomeCommandCentre(page);await page.locator('[data-pulse-format="rapid"]').click();const slider=page.locator('#homePulseCursor');
  await slider.focus();await page.waitForTimeout(130);const before=await page.evaluate(()=>feedbackAudit.vibrations.length);await slider.press('ArrowLeft');
  await expect(page.locator('#homePulseReadout')).toContainText('observation');expect(await page.evaluate(()=>feedbackAudit.vibrations.length)).toBeGreaterThan(before);expect(await sounds(page)).toBe(0);
  await page.evaluate(()=>{localStorage.setItem('chess-analyser-pref:sound','on');localStorage.setItem('chess-analyser-pref:uiSounds','on');window.dispatchEvent(new CustomEvent('chessPreference',{detail:{key:'sound',value:'on'}}));});
  await page.waitForTimeout(130);await slider.press('ArrowLeft');await expect.poll(()=>sounds(page)).toBe(1);
  const quiet=await sounds(page);await page.evaluate(()=>{const slider=document.getElementById('homePulseCursor');slider.value='0';slider.dispatchEvent(new Event('input',{bubbles:true}));});expect(await sounds(page)).toBe(quiet);
});
test('recent-game carousel responds to user scrolling and leaves programmatic layout quiet',async({page})=>{
  await auditFeedback(page,{sound:'off'});await seedHomeCommandCentre(page);await page.locator('#homeWelcomeSilent').click();const scroller=page.locator('#homeRecentScroller');await scroller.scrollIntoViewIfNeeded();
  const before=await page.evaluate(()=>feedbackAudit.vibrations.length);await scroller.evaluate(node=>node.scrollLeft=100);await page.waitForTimeout(200);expect(await page.evaluate(()=>feedbackAudit.vibrations.length)).toBe(before);
  const initial=await scroller.evaluate(node=>({left:node.scrollLeft,card:node.firstElementChild.getBoundingClientRect().width}));
  await scroller.hover();await page.mouse.wheel(380,0);await page.waitForTimeout(250);
  const moved=Math.abs(await scroller.evaluate(node=>node.scrollLeft)-initial.left);
  if(page.viewportSize().width<800)expect(moved).toBeGreaterThan(initial.card*.5);
  if(moved>initial.card*.5)await expect.poll(()=>page.evaluate(()=>feedbackAudit.vibrations.length)).toBeGreaterThan(before);
  else {await page.waitForTimeout(200);expect(await page.evaluate(()=>feedbackAudit.vibrations.length)).toBe(before);}
  expect(await sounds(page)).toBe(0);
});
test('real review progress, study tips, engine stop, retry and completion form one working flow',async({page},info)=>{
  test.setTimeout(60000);await auditFeedback(page);await holdReviewEngine(page);await page.goto('/');await seedPendingReview(page);await startPendingReview(page);
  await expect(page.locator('#reviewWaitCount')).toHaveText('2 / 7 positions analysed · depth 8',{timeout:20000});
  await expect(page.locator('#reviewWaitProgress')).toHaveAttribute('value','29');const count=await sounds(page);expect(count).toBe(1);
  await expect(page.locator('#reviewWaitRetry')).toBeHidden();await expect(page.locator('#reviewGuideCard')).toBeHidden();
  await expect(page.locator('#runReview')).toBeDisabled();
  expect((await page.locator('#board').boundingBox()).width).toBeGreaterThan(page.viewportSize().width>800?350:240);
  const tip=await page.locator('#reviewWaitTip').textContent();await page.locator('#reviewWaitNextTip').click();await expect(page.locator('#reviewWaitTip')).not.toHaveText(tip);
  await page.waitForTimeout(150);expect(await sounds(page)).toBe(count);
  await page.locator('#reviewWaitPanel').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('review-wait-after.png'),animations:'disabled'});
  await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('html')).toHaveAttribute('data-reduced-animations','true');
  await expect(page.locator('#reviewWaitCount')).toHaveText('2 / 7 positions analysed · depth 8');expect(await page.evaluate(()=>reviewEngineAudit.stop)).toBe(0);
  await page.locator('#reviewWaitCancel').click();await expect(page.locator('#reviewWaitTitle')).toHaveText('Review stopped');
  await expect(page.locator('#accuracyCards')).toBeHidden();await expect(page.locator('#moves .moveTag')).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>reviewEngineAudit.stop)).toBe(1);await page.waitForTimeout(200);expect(await page.evaluate(()=>reviewEngineAudit.verified)).toBe(0);
  await page.evaluate(()=>window.holdEngineAfter=Infinity);await page.locator('#reviewWaitRetry').click();
  await expect.poll(()=>page.evaluate(()=>reviewEngineAudit.verified),{timeout:30000}).toBe(1);await expect(page.locator('#reviewWaitPanel')).toBeHidden();
  await expect.poll(()=>sounds(page)).toBe(3);expect(await page.evaluate(()=>reviewEngineAudit.progress.some(p=>p.phase==='positions'&&p.done===7))).toBe(true);
  expect(await page.evaluate(()=>reviewEngineAudit.progress.some(p=>p.phase==='critical'))).toBe(true);
  expect(await page.evaluate(()=>feedbackAudit.errors)).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
});
test('leaving an active engine review stops work and late progress cannot appear on Home',async({page})=>{
  await auditFeedback(page);await holdReviewEngine(page);await page.goto('/');await seedPendingReview(page);await startPendingReview(page);
  await expect(page.locator('#reviewWaitCount')).toContainText('2 / 7',{timeout:20000});await page.locator('#back').click();await expect(page.locator('#libraryView')).toBeVisible();
  const count=await sounds(page);await expect.poll(()=>page.evaluate(()=>reviewEngineAudit.stop)).toBe(1);await page.waitForTimeout(250);expect(await sounds(page)).toBe(count);expect(await page.evaluate(()=>reviewEngineAudit.verified)).toBe(0);
  await page.locator('#homeDashboardTab').click();await page.evaluate(()=>window.dispatchEvent(new CustomEvent('reviewAnalysisProgress',{detail:{key:'stale-game',phase:'positions',done:3,total:7}})));
  await expect(page.locator('#reviewWaitPanel')).toBeHidden();await expect(page.locator('#homeView')).toBeVisible();
});
