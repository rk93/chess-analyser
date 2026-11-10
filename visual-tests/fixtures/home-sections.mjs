import {expect} from '@playwright/test';
// Exercise the same visible shortcuts and topic tabs that a player uses.
export async function openHomeTopic(page,topic='overview') {
  if(await page.locator('#homeStats').isVisible()) {
    const tab=page.locator('#homeTopic-'+topic);
    if(await tab.getAttribute('aria-selected')!=='true')await tab.click();
  } else {
    await page.locator(topic==='overview'?'#homeAnalyticsLink':'#homeOpen-'+topic).click();
  }
  await expect(page.locator('#homePanel-'+topic)).toBeVisible();
}
