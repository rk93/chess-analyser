import { test, expect } from '@playwright/test';
import { mockPublicPlayers, seedComparison } from './fixtures/comparison-fixtures.mjs';

async function chooseOpponent(page,user='beta'){
 await page.locator('#comparePlayerSearch').fill(user);
 await page.locator('#comparePlayerSearch').press('Enter');
 await expect(page.locator('#playerProfileCards [data-player="'+user+'"]')).toBeVisible();
 await expect(page.locator('#comparisonFormats [data-format]')).toHaveCount(4);
}
test('configured profile and recent opponents populate immediately, with all four formats and no form wall',async({page},info)=>{
 const requests=[],workers=[];page.on('worker',worker=>workers.push(worker));
 await mockPublicPlayers(page,requests);await seedComparison(page);
 await expect(page.locator('#playerProfileCards [data-player="alpha"]')).toContainText('You');
 await expect(page.locator('[data-discover="beta"]')).toContainText('Recent opponent');
 const before=requests.length;
 await page.locator('[data-discover="beta"]').click();
 await expect(page.locator('#comparisonFormats [data-format]')).toHaveCount(4);
 for(const format of ['bullet','blitz','rapid','daily'])await expect(page.locator(`[data-format="${format}"]`)).toContainText('10 games');
 await expect(page.locator('#comparisonSummary')).toContainText('Same last 60 days');
 await expect(page.locator('.pcHeadToHead')).toContainText('40 encounters');
 await expect(page.locator('.playerComparison table')).toHaveCount(0);
 expect(requests.length).toBe(before);expect(workers).toHaveLength(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:info.outputPath('friends-discovery-after.png'),fullPage:true,animations:'disabled'});
});

test('autocomplete works with keyboard, favourites and recent searches survive reload and stay account scoped',async({page})=>{
 await mockPublicPlayers(page);await seedComparison(page);
 const search=page.locator('#comparePlayerSearch');
 await search.fill('be');await search.press('ArrowDown');
 await expect(search).toHaveAttribute('aria-activedescendant','playerOption0');
 await search.press('Enter');await expect(page.locator('#playerProfileCards [data-player="beta"]')).toBeVisible();
 await page.getByRole('button',{name:'Save beta as favourite'}).press('Space');
 await expect(page.getByRole('button',{name:'Remove beta from favourite'})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('button',{name:'Remove beta from favourite'})).toBeFocused();
 await page.reload();await page.locator('#analyticsTab').click();await page.locator('#friendsAnalyticsTab').click();
 await expect(page.locator('[data-discover="beta"]')).toContainText('Favourite');
 await search.fill('be');await expect(page.locator('#playerSearchOptions')).toContainText('Recent search');await search.press('Escape');
 await expect(search).toHaveAttribute('aria-expanded','false');
 await page.evaluate(()=>{localStorage.setItem('chess-username','other-account');window.dispatchEvent(new Event('chessImportFinished'))});
 await expect(page.locator('[data-player="other-account"]')).toBeVisible();
 await expect(page.locator('#playerDiscoveryChips [data-discover="beta"]')).toHaveCount(0);
});

test('public profiles, lifetime statistics and recent samples remain separate and use bounded cached requests',async({page},info)=>{
 const requests=[];await mockPublicPlayers(page,requests);await seedComparison(page);await chooseOpponent(page);
 await page.locator('[data-source="public"]').click();
 await expect(page.locator('#playerCompareStatus')).toHaveText('Public data loaded.');
 await expect(page.locator('#playerProfileCards [data-player="alpha"]')).toContainText('1800');
 await expect(page.locator('#playerProfileCards .pcAvatar img')).toHaveCount(2);
 await expect(page.locator('#comparisonScope')).toContainText('3 public monthly archives');
 expect(requests.filter(url=>url.includes('/games/'))).toHaveLength(8);
 const count=requests.length;
 await page.locator('[data-source="lifetime"]').click();
 await expect(page.locator('#playerCompareStatus')).toHaveText('Public data loaded.');
 await expect(page.locator('[data-format="bullet"]')).toContainText('400 games');
 await expect(page.locator('#comparisonSummary')).toContainText('Lifetime records');
 await expect(page.locator('#comparisonOpenings')).toContainText('do not include opening histories');
 await page.locator('[data-source="public"]').click();
 await expect(page.locator('#playerCompareStatus')).toHaveText('Public data loaded.');
 expect(requests).toHaveLength(count);
 const saved=await page.evaluate(async()=>{
  const db=await new Promise(resolve=>{const r=indexedDB.open('rk93-chess-analyser',1);r.onsuccess=()=>resolve(r.result)});
  const count=await new Promise(resolve=>{const r=db.transaction('games','readonly').objectStore('games').count();r.onsuccess=()=>resolve(r.result)});db.close();return count;
 });expect(saved).toBe(40);
 await page.locator('[data-source="local"]').click();await expect(page.locator('[data-format="rapid"]')).toContainText('10 games');
 await page.locator('[data-pool="rapid"]').click();
 await expect(page.locator('.pcSparkline')).toHaveCount(2);
 await expect(page.locator('#comparisonFormats [data-format]')).toHaveCount(1);
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:info.outputPath('friends-profile-comparison-after.png'),fullPage:true,animations:'disabled'});
});

test('opening evidence has sample sizes and replays real moves on the existing board without engine work',async({page})=>{
 const workers=[];page.on('worker',worker=>workers.push(worker));
 await mockPublicPlayers(page);await seedComparison(page);await chooseOpponent(page);
 await expect(page.locator('#comparisonOpenings')).toContainText('5 games');
 await expect(page.locator('#comparisonOpenings')).toContainText('Game-history evidence');
 await page.locator('#comparisonOpenings [data-opening]').first().click();
 await expect(page.locator('#boardLabView')).toBeVisible();
 await expect(page.locator('#labSource')).toContainText('Opening study');
 await expect(page.locator('#labForward')).toBeEnabled();
 const first=await page.locator('#labBoard').innerHTML();
 await page.locator('#labForward').click();expect(await page.locator('#labBoard').innerHTML()).not.toBe(first);
 await page.locator('#labBack').click();await expect(page.locator('#labBack')).toBeDisabled();
 expect(workers).toHaveLength(0);
 await page.goBack();await expect(page.locator('#friendsAnalyticsPanel')).toBeVisible();await expect(page.locator('.modernNav')).toBeVisible();
 await page.locator('.pcEncounter').first().click();await expect(page.locator('#labSource')).toContainText('Game study');
});

test('empty selections and unknown players have useful states and do not invent a rivalry',async({page})=>{
 await mockPublicPlayers(page);await seedComparison(page);await chooseOpponent(page,'new-player');
 await expect(page.locator('.pcHeadToHead')).toContainText('No head-to-head games found in the available selection');
 await expect(page.locator('#comparisonOpenings')).toContainText('No opening metadata');
 await page.locator('[data-pool="daily"]').click();
 await expect(page.locator('[data-format="daily"] .pcFormatNumbers strong').nth(1)).toHaveText('—');
 // The configured player still has ten games; the other side has no sample.
 await expect(page.locator('[data-format="daily"]')).toContainText('0 games');
 await expect(page.locator('#playerCompareStatus')).not.toContainText('stronger player');
});

test('rate limits stop repeated requests and errors preserve local data and navigation',async({page})=>{
 await mockPublicPlayers(page);await seedComparison(page);await chooseOpponent(page);
 let calls=0;
 await page.route('https://api.chess.com/**',route=>{calls++;return route.fulfill({status:429,headers:{'Retry-After':'60'},body:'{}'})});
 await page.locator('[data-source="public"]').click();
 await expect(page.locator('#playerCompareStatus')).toContainText('rate limit');expect(calls).toBe(1);
 await page.locator('#loadPublicPlayers').click();await expect(page.locator('#playerCompareStatus')).toContainText('rate limit');expect(calls).toBe(1);
 await page.locator('[data-source="local"]').click();await expect(page.locator('[data-format="rapid"]')).toContainText('10 games');
 await page.locator('#homeDashboardTab').click();await expect(page.locator('#homeMetrics strong').first()).toHaveText('40');
});

test('public loads can be cancelled and switching accounts cannot reveal late results',async({page})=>{
 await mockPublicPlayers(page);await seedComparison(page);await chooseOpponent(page);
 let release;const gate=new Promise(resolve=>{release=resolve});
 await page.route('https://api.chess.com/pub/player/alpha',async route=>{await gate;await route.fulfill({status:200,body:'{"username":"alpha"}',contentType:'application/json'}).catch(()=>{})});
 await page.locator('[data-source="public"]').click();await expect(page.locator('#cancelPlayerLoad')).toBeVisible();
 await page.locator('#cancelPlayerLoad').click();await expect(page.locator('#playerCompareStatus')).toContainText('cancelled');
 await page.evaluate(()=>{localStorage.setItem('chess-username','new-account');window.dispatchEvent(new Event('chessImportFinished'))});
 release();await expect(page.locator('[data-player="new-account"]')).toBeVisible();
 await expect(page.locator('[data-player="beta"]')).toHaveCount(0);await expect(page.locator('#playerCompareResults')).toBeHidden();
});

test('comparison controls have touch targets, no overflow and reduced-motion support',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await mockPublicPlayers(page);await seedComparison(page);await chooseOpponent(page);
 const sizes=await page.locator('.pcSourceTabs button:visible,.pcPoolTabs button:visible,.pcDiscoveryChip:visible').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().height));
 expect(sizes.every(height=>height>=44)).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
 if(page.viewportSize().width<=430){
  await page.evaluate(()=>window.scrollTo(0,0));
  const profiles=await page.locator('#playerProfileCards').boundingBox(),nav=await page.locator('.modernNav').boundingBox();
  expect(profiles.y+profiles.height).toBeLessThanOrEqual(nav.y);
 }
 await expect(page.locator('#friendsAnalyticsTab')).toHaveAttribute('aria-selected','true');
});
