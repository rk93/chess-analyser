import { test, expect } from '@playwright/test';
import {auditFeedback,seedFeedbackReview} from './fixtures/feedback-fixtures.mjs';

test('saved review keeps board and move controls usable on mobile', async ({ page }, testInfo) => {
  await auditFeedback(page,{sound:null});await page.goto('/');await seedFeedbackReview(page);
  await page.locator('#gamesTab').click();await page.locator('.gameWithAvatar').click();await expect(page.locator('#reviewGuideCard')).toBeVisible();
  // Exercise the real cached-review/autoplay lifecycle, then select the first
  // move with the visible transport rather than constructing a fake board/UI.
  const play=page.locator('#reviewAutoPlay');await expect(play).toHaveAttribute('aria-pressed','true');await play.click();
  while(await page.locator('#reviewPrev').isEnabled()){await page.locator('#reviewPrev').click();await page.evaluate(()=>new Promise(requestAnimationFrame));}
  await page.locator('#reviewNext').click();await expect(page.locator('#reviewGuideEval')).toHaveAttribute('data-perspective','w');await page.locator('#reviewPrev').click();
  await expect(page.locator('#board .piece')).toHaveCount(32);
  const board=page.locator('#analysisView .boardStage');
  const next=page.locator('#reviewNext');
  await expect(board).toBeVisible();
  await expect(next).toBeVisible();
  await expect(page.locator('#reviewGuideEval')).toHaveAttribute('data-perspective','b');
  const b=await board.boundingBox(), n=await next.boundingBox();
  expect(b.width).toBeGreaterThan(150);
  expect(b.height).toBeGreaterThan(150);
  expect(b.y).toBeLessThan(250);
  const coach=await page.locator('#reviewGuideCard').boundingBox();
  expect(coach.y + coach.height).toBeLessThanOrEqual(b.y + 2);
  // Catch controls obscuring the board, not just whether each is visible.
  expect(n.y).toBeGreaterThanOrEqual(b.y + b.height - 2);
  await expect(page.locator('.modernNav')).toBeHidden();
  await expect(page.locator('#reviewPositionStats')).toBeVisible();
  await expect(page.locator('#reviewPositionStats [role="progressbar"]')).toHaveAttribute('aria-valuenow','17');
  const buttons=await Promise.all(['reviewPrev','reviewAutoPlay','reviewNext','reviewShowBest'].map(id=>page.locator('#'+id).boundingBox()));
  for(let i=1;i<buttons.length;i++)expect(buttons[i].x).toBeGreaterThanOrEqual(buttons[i-1].x+buttons[i-1].width-2);
  for(const btn of buttons){expect(btn.y).toBeGreaterThanOrEqual(b.y+b.height-2);expect(btn.x+btn.width).toBeLessThanOrEqual(page.viewportSize().width+2)}
  expect(n.y+n.height).toBeLessThan(800);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBeTruthy();
  await page.screenshot({path:testInfo.outputPath('mobile-review.png'),fullPage:true});
});
