import {test,expect} from '@playwright/test';
import {auditFeedback,seedFeedbackReview} from './fixtures/feedback-fixtures.mjs';
import {seedPendingReview} from './fixtures/review-wait-fixtures.mjs';
import {assertNavigationUsable} from './fixtures/navigation-fixtures.mjs';

test('delayed cached review restoration cannot hide tabs or reopen dialogs after either Back path',async({page},info)=>{
  // The natural race was reproduced on unmodified main without instrumentation.
  // Slow its 120ms restore timer to model a slow device deterministically. Do not
  // change classes, visibility, history or engine results to simulate navigation.
  await page.addInitScript(()=>{
    const schedule=window.setTimeout.bind(window);
    window.setTimeout=(callback,delay,...args)=>schedule(callback,delay===120?700:delay,...args);
  });
  await auditFeedback(page,{sound:null});await page.goto('/');await seedFeedbackReview(page);
  for(const method of ['button','browser']){
    await page.locator('#homeDashboardTab').click();await page.locator('#gamesTab').click();await page.locator('.gameWithAvatar').click();
    if(method==='button')await page.locator('#back').click();else await page.goBack();
    await expect(page.locator('#libraryView')).toBeVisible();await page.waitForTimeout(900);
    // Cross the actual delayed callback, not just the immediate exit frame.
    await assertNavigationUsable(page);expect(await page.locator('#reviewGuideCard').evaluate(card=>card.hidden)).toBe(true);
    await expect(page.locator('#reviewDepthPrompt')).toHaveCount(0);
    await page.screenshot({path:info.outputPath('after-delayed-cache-'+method+'.png'),animations:'disabled'});
  }
  if(page.viewportSize().width<=800){
    await seedPendingReview(page);await page.locator('#gamesTab').click();await page.locator('.gameWithAvatar').click();await expect(page.locator('#reviewDepthPrompt')).toBeVisible();
    await page.goBack();await expect(page.locator('#libraryView')).toBeVisible();await page.waitForTimeout(900);await assertNavigationUsable(page);await expect(page.locator('#reviewDepthPrompt')).toHaveCount(0);
  }
});
