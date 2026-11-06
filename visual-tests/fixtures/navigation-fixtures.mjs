import {expect} from '@playwright/test';
export const NAV_TABS=[['homeDashboardTab','homeView'],['gamesTab','libraryView'],['boardLabTab','boardLabView'],['explorerTab','explorerView'],['puzzlesTab','puzzlesView'],['analyticsTab','analyticsView'],['topPlayersTab','topPlayersView'],['settingsNav','settingsView']];
export async function assertNavigationUsable(page){
  await expect(page.locator('.homeTabs.modernNav')).toBeVisible();
  const result=await page.locator('.homeTabs.modernNav').evaluate(nav=>{
    const rect=nav.getBoundingClientRect(),style=getComputedStyle(nav);
    return {nav:{top:rect.top,bottom:rect.bottom,left:rect.left,right:rect.right},visibility:style.visibility,opacity:style.opacity,
      buttons:[...nav.querySelectorAll('button')].map(button=>{const r=button.getBoundingClientRect(),top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return{id:button.id,left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,hit:top?.closest('button')===button}})};
  });
  const {width,height}=page.viewportSize();
  expect(result.visibility).toBe('visible');expect(Number(result.opacity)).toBe(1);
  expect(result.nav.left).toBeGreaterThanOrEqual(0);expect(result.nav.right).toBeLessThanOrEqual(width);expect(result.nav.bottom).toBeLessThanOrEqual(height);
  if(width<=800)expect(result.nav.top).toBeGreaterThan(height-150);
  for(const [id] of NAV_TABS){const b=result.buttons.find(button=>button.id===id);expect(b,id).toBeTruthy();expect(b.width,id).toBeGreaterThanOrEqual(36);expect(b.height,id).toBeGreaterThanOrEqual(44);expect(b.left,id).toBeGreaterThanOrEqual(0);expect(b.right,id).toBeLessThanOrEqual(width);expect(b.hit,id).toBe(true);}
}
export async function waitForReviewExit(page,view='libraryView'){
  await expect(page.locator('#'+view)).toBeVisible();await expect(page.locator('#analysisView')).toBeHidden();
  // The old cache restoration timer fires after 120ms. Immediate assertions
  // passed before that callback hid the navigation again. Cross that boundary.
  await page.waitForTimeout(350);await assertNavigationUsable(page);
}
