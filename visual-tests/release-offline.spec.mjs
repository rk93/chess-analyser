import {test,expect} from '@playwright/test';

test('offline banner does not move the Games board layout or navigation',async({page,context},testInfo)=>{
 await page.goto('/');
 await expect(page.locator('#gamesTab')).toBeVisible();
 const before=await page.locator('.modernNav').boundingBox();
 await context.setOffline(true);
 await expect(page.locator('#appConnectivity')).toBeVisible();
 await expect(page.locator('#appConnectivity')).toContainText('Offline');
 const after=await page.locator('.modernNav').boundingBox();
 expect(Math.abs(before.y-after.y)).toBeLessThanOrEqual(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBeTruthy();
 await page.screenshot({path:testInfo.outputPath('offline-banner.png'),fullPage:false});
 await context.setOffline(false);
 await expect(page.locator('#appConnectivity')).toBeHidden();
});
test('cached app shell remains reachable after service worker has activated',async({page,context})=>{
 await page.goto('/');
 await page.evaluate(async()=>{
  if(!('serviceWorker' in navigator))return;
  await navigator.serviceWorker.ready;
 });
 await page.reload();
 await expect(page.locator('#gamesTab')).toBeVisible();
 await context.setOffline(true);
 await page.reload();
 await expect(page.locator('#gamesTab')).toBeVisible({timeout:12000});
 await context.setOffline(false);
});
