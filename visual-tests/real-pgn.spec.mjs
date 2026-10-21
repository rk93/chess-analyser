import { test, expect } from '@playwright/test';

const pgn = '[Event "Mobile QA"]\n[Site "Chess.com"]\n[Date "2026.10.20"]\n[White "qa_white"]\n[Black "qa_black"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O 8. c3 d6 1-0';

test('real PGN renders pieces, advances moves and flips on mobile', async ({ page }, testInfo) => {
  await page.route('https://api.chess.com/**', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({archives:[]})}));
  await page.goto('/');
  await page.evaluate(async (game) => {
    localStorage.setItem('chess-username','qa_white');
    localStorage.setItem('chess-sync-meta:qa_white',JSON.stringify({archives:[],lastSync:Date.now()}));
    const db=await new Promise((resolve,reject)=>{
      const req=indexedDB.open('rk93-chess-analyser',1);
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('games'))req.result.createObjectStore('games',{keyPath:'_key'})};
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('games','readwrite');
      tx.objectStore('games').put(game);
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
    });db.close();
  }, {_key:'qa-mobile-fixture',url:'qa-mobile-fixture',pgn,white:{username:'qa_white',rating:1434,result:'win'},black:{username:'qa_black',rating:1414,result:'resigned'},time_control:'600',time_class:'rapid',end_time:1792530000,rated:true});
  await page.reload();
  await expect(page.locator('.gameWithAvatar').first()).toBeVisible({timeout:15000});
  await expect(page.locator('#libraryIntro .coachWelcome')).toBeVisible();
  const pipResponse=await page.request.get('/assets/pip-coach-atlas.svg');
  expect(pipResponse.ok()).toBeTruthy();
  expect(await pipResponse.text()).toContain('data:image/webp;base64');

  // Review prompt can reappear asynchronously after cached evaluation checks.
  // This test checks game navigation, so always choose Not now when prompted.
  await page.evaluate(() => {
    const dismiss=()=>document.getElementById('reviewDepthCancel')?.click();
    new MutationObserver(dismiss).observe(document.body,{childList:true,subtree:true});
    dismiss();
  });
  await page.locator('.gameWithAvatar').first().click();
  await expect(page.locator('#analysisView')).toBeVisible();
  if (await page.locator('#reviewDepthCancel').isVisible()) await page.locator('#reviewDepthCancel').click();
  await expect(page.locator('#board img.piece')).toHaveCount(32);
  const before=await page.locator('#board').innerHTML();
  await page.locator('#next').click();
  const after=await page.locator('#board').innerHTML();
  expect(after).not.toBe(before);
  await expect(page.locator('#board img.piece')).toHaveCount(32);
  await page.locator('#flip').click();
  const flipped=await page.locator('#board').innerHTML();
  expect(flipped).not.toBe(after);
  await page.locator('#next').click();
  await page.locator('#prev').click();
  const box=await page.locator('#analysisView .boardStage').boundingBox();
  expect(box.width).toBeGreaterThan(200);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+2)).toBeTruthy();
  await expect(page.locator('#analysisView .boardCoordinate.rankCoordinate')).toHaveCount(8);
  await expect(page.locator('#analysisView .boardCoordinate.fileCoordinate')).toHaveCount(8);
  await expect(page.locator('#mobileReviewMoves .mobileReviewMove').first()).toBeVisible();
  await expect(page.locator('#copyGamePgn')).toBeVisible();
  await expect(page.locator('#mobileReviewMoveList')).toBeVisible();
  const notationBefore=await page.locator('#mobileReviewMoveList').innerText();
  await page.locator('#next').click();
  const notationAfter=await page.locator('#mobileReviewMoveList').innerText();
  expect(notationAfter).not.toBe('');
  const activeMove=page.locator('#mobileReviewMoveList .mobileReviewMove.selected');
  await expect(activeMove).toHaveCount(1);
  await expect(activeMove).toHaveAttribute('aria-current','step');
  expect((await activeMove.innerText()).trim()).toContain('e5');
  expect(await page.locator('#mobileReviewMoveList').evaluate(e=>e.scrollWidth>=e.clientWidth)).toBeTruthy();
  await page.locator('#copyGamePgn').click();
  await expect(page.locator('#copyGamePgn')).toContainText(/Copied|Copy failed/);
    await page.screenshot({path:testInfo.outputPath('real-pgn-after-flip.png'),fullPage:true});
  await page.locator('#back').click();
  await expect(page.locator('#libraryView')).toBeVisible();
  await expect(page.locator('.modernNav')).toBeVisible();
  const navLabels=page.locator('.modernNav .homeTab');
  await expect(navLabels).toHaveCount(7);
  const navBoxes=await navLabels.evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return{left:r.left,right:r.right,width:r.width}}));
  for(let i=1;i<navBoxes.length;i++)expect(navBoxes[i].left).toBeGreaterThanOrEqual(navBoxes[i-1].right-2);
  await page.screenshot({path:testInfo.outputPath('back-to-games-navigation.png'),fullPage:false});
  await page.locator('#analyticsTab').click();
  await expect(page.locator('#analyticsView')).toBeVisible();
  await expect(page.locator('.modernNav')).toBeVisible();
  await page.locator('#boardLabTab').click();
  await expect(page.locator('#boardLabView')).toBeVisible();
  await expect(page.locator('.modernNav')).toBeVisible();
  // Cross-tab regression: every destination remains reachable after exiting a game.
  for(const [tab,view] of [
    ['explorerTab','explorerView'],
    ['puzzlesTab','puzzlesView'],
    ['topPlayersTab','topPlayersView'],
    ['settingsNav','settingsView'],
    ['gamesTab','libraryView']
  ]){
    await page.locator('#'+tab).click();
    await expect(page.locator('#'+view)).toBeVisible();
    await expect(page.locator('.modernNav')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBeTruthy();
    await page.screenshot({path:testInfo.outputPath('tab-'+tab+'.png'),fullPage:false});
  }

});


test('Explorer header returns directly to Games on mobile',async({page},testInfo)=>{
 await page.route('https://explorer.lichess.org/**',route=>route.abort());
 await page.goto('/');
 await page.locator('#explorerTab').click();
 await expect(page.locator('#explorerView')).toBeVisible();
 const back=page.locator('#explorerHome');
 await expect(back).toBeVisible();
 await expect(back).toContainText('Games');
 const rect=await back.boundingBox();
 expect(rect.y).toBeLessThan(160);
 await page.screenshot({path:testInfo.outputPath('explorer-back-button.png'),fullPage:false});
 await back.click();
 await expect(page.locator('#libraryView')).toBeVisible();
 await expect(page.locator('#explorerView')).toBeHidden();
 await expect(page.locator('#gamesTab')).toHaveClass(/active/);
 await page.screenshot({path:testInfo.outputPath('explorer-back-to-games.png'),fullPage:false});
});

test('Android/browser Back remains inside app for every tab and review',async({page})=>{
 await page.goto('/');
 for(const [tab,view] of [['explorerTab','explorerView'],['puzzlesTab','puzzlesView'],['analyticsTab','analyticsView'],['topPlayersTab','topPlayersView'],['settingsNav','settingsView'],['boardLabTab','boardLabView']]){
  await page.locator('#gamesTab').click();
  await page.locator('#'+tab).click();
  await expect(page.locator('#'+view)).toBeVisible();
  await page.goBack();
  await expect(page.locator('#libraryView')).toBeVisible();
  await expect(page.locator('#'+view)).toBeHidden();
  expect(new URL(page.url()).origin).toBe('http://127.0.0.1:8765');
 }
});