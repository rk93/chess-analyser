import {test,expect} from '@playwright/test';
test('review exit restores all bottom tabs without refresh',async({page},info)=>{
 await page.goto('/');
 const nav=page.locator('.homeTabs.modernNav');
 await expect(page.locator('#homeView')).toBeVisible();
 await page.locator('#gamesTab').click();
 await page.evaluate(()=>{
  const view=document.getElementById('analysisView');
  view.hidden=false;view.style.display='block';
  document.getElementById('libraryView').hidden=true;
  document.body.classList.add('review-guided-active');
  document.querySelector('.homeTabs').classList.add('reviewHidden');
  document.querySelector('.homeTabs').style.display='none';
 });
 await expect(nav).toBeHidden();
 await page.locator('#back').click();
 await expect(page.locator('#libraryView')).toBeVisible();
 await expect(nav).toBeVisible();
 for(const id of ['homeDashboardTab','gamesTab','boardLabTab','analyticsTab','topPlayersTab']){
  await page.locator('#'+id).click();
  await expect(nav).toBeVisible();
 }
 await page.locator('#homeDashboardTab').click();
 for(const id of ['explorerTab','puzzlesTab'])await expect(page.locator('#'+id)).toBeVisible();
 await page.screenshot({path:info.outputPath('nav-restored-after-review.png'),fullPage:false});
});
test('Android browser back from review restores tabs',async({page},info)=>{
 await page.goto('/');
 await page.locator('#gamesTab').click();
 await page.evaluate(()=>{
  const a=document.getElementById('analysisView');
  a.hidden=false;a.style.display='block';
  document.getElementById('libraryView').hidden=true;
  document.body.classList.add('review-guided-active');
  history.pushState({chessNav:true,screen:'analysis'},'');
 });
 await expect(page.locator('.modernNav')).toBeHidden();
 await page.goBack();
 await expect(page.locator('.modernNav')).toBeVisible();
 await expect(page.locator('#libraryView')).toBeVisible();
 await page.screenshot({path:info.outputPath('nav-browser-back.png'),fullPage:false});
});