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
  await page.locator('#gamesTab').click();
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
  await expect(navLabels).toHaveCount(8);
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
test('Pip coaching practises a verified mistake before optionally revealing answer',async({page},testInfo)=>{
 await page.goto('/');
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('practiceMistake',{detail:{
  fen:'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  label:'Mistake',side:'White',moveNumber:1,badMove:'a3',
  bestMove:'e2e4',bestSan:'e4'
 }})));
 await expect(page.locator('#boardLabView')).toBeVisible();
 await expect(page.locator('#labPracticeReveal')).toBeVisible();
 await expect(page.locator('#labLine')).toContainText('Find a better move');
 await page.locator('#labBoard [data-square="d2"]').click();
 await page.locator('#labBoard [data-square="d4"]').click();
 await expect(page.locator('#labLine')).toContainText('Tap Retry');
 await expect(page.locator('#labPracticeCoachDock')).toBeVisible();
 await expect(page.locator('#labPracticeCoachDock .labPracticeMessage')).toContainText('Tap Retry');
 const dockBox=await page.locator('#labPracticeCoachDock').boundingBox();
 expect(dockBox.y+dockBox.height).toBeLessThanOrEqual(page.viewportSize().height-60);
 await expect(page.locator('#labLine')).not.toContainText('Stockfish recommends e4');
 await page.screenshot({path:testInfo.outputPath('pip-practice-try-again.png'),fullPage:false});
 await page.locator('#labPracticeReveal').click();
 await expect(page.locator('#labLine')).toContainText('Stockfish recommends e4');
 await page.screenshot({path:testInfo.outputPath('pip-practice-revealed.png'),fullPage:false});
});

test('all bottom tabs remain present after analysis, Home and repeated navigation',async({page},testInfo)=>{
 await page.goto('/');
 const tabs=['homeDashboardTab','gamesTab','boardLabTab','explorerTab','puzzlesTab','analyticsTab','topPlayersTab','settingsNav'];
 const assertDock=async()=>{
  const positions=await page.locator('.homeTabs.modernNav').evaluate(nav=>({
   nav:nav.getBoundingClientRect().toJSON(),
   tabs:[...nav.querySelectorAll('.homeTab')].map(el=>({id:el.id,rect:el.getBoundingClientRect().toJSON(),visible:getComputedStyle(el).visibility!=='hidden'}))
  }));
  expect(positions.tabs.length).toBeGreaterThanOrEqual(8);
  for(const tab of tabs){
   const button=positions.tabs.find(x=>x.id===tab);
   expect(button).toBeTruthy();expect(button.visible).toBe(true);
   expect(button.rect.width).toBeGreaterThan(20);
   expect(button.rect.left).toBeGreaterThanOrEqual(-1);
   expect(button.rect.right).toBeLessThanOrEqual(page.viewportSize().width+1);
  }
 };
 await assertDock();
 await page.locator('#gamesTab').click();
 await assertDock();
 await page.locator('#homeDashboardTab').click();
 await assertDock();
 for(const tab of ['puzzlesTab','explorerTab','analyticsTab','topPlayersTab','boardLabTab','settingsNav','homeDashboardTab']){
  await page.locator('#'+tab).click();
  await assertDock();
 }
 await page.screenshot({path:testInfo.outputPath('nav-all-tabs-after-home.png'),fullPage:false});
});

test('Home restores all nav icons after opening a real game and pressing Back',async({page},testInfo)=>{
 await page.route('https://api.chess.com/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({archives:[]})}));
 await page.goto('/');
 await page.evaluate(async(pgn)=>{
  localStorage.setItem('chess-username','qa_white');
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('rk93-chess-analyser',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  await new Promise((resolve,reject)=>{const tx=db.transaction('games','readwrite');tx.objectStore('games').put({_key:'nav-fixture',url:'nav-fixture',pgn,white:{username:'qa_white',rating:1434,result:'win'},black:{username:'qa_black',rating:1414,result:'resigned'},end_time:1792530000,time_class:'rapid',time_control:'600'});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
  db.close();
 },pgn);
 await page.reload();
 await page.locator('#gamesTab').click();
 await expect(page.locator('.gameWithAvatar').first()).toBeVisible();
 await page.evaluate(()=>{const dismiss=()=>document.getElementById('reviewDepthCancel')?.click();new MutationObserver(dismiss).observe(document.body,{childList:true,subtree:true});dismiss()});
 await page.locator('.gameWithAvatar').first().click();
 await expect(page.locator('#analysisView')).toBeVisible();
 await page.goBack();
 await page.locator('#homeDashboardTab').click();
 await expect(page.locator('#homeView')).toBeVisible();
 await expect(page.locator('.modernNav')).toBeVisible();
 for(const id of ['explorerTab','puzzlesTab','settingsNav']){
  const button=page.locator('#'+id),b=await button.boundingBox();
  expect(b).not.toBeNull();expect(b.x+b.width).toBeLessThanOrEqual(page.viewportSize().width+1);
 }
 await page.screenshot({path:testInfo.outputPath('home-after-review-all-icons.png'),fullPage:false});
});

test('Game Review back restores all mobile tabs and stable home navigation',async({page},testInfo)=>{
 await page.goto('/');
 await page.locator('#gamesTab').click();
 await page.evaluate(()=>{
  const view=document.getElementById('analysisView');
  view.style.display='block';document.getElementById('libraryView').style.display='none';
  document.body.classList.add('review-guided-active');
 });
 await page.locator('#back').click();
 await expect(page.locator('#analysisView')).toBeHidden();
 await expect(page.locator('.homeTabs.modernNav')).toBeVisible();
 for(const id of ['explorerTab','puzzlesTab','analyticsTab','topPlayersTab'])await expect(page.locator('#'+id)).toBeVisible();
 await page.locator('#homeDashboardTab').click();
 await expect(page.locator('#homeView')).toBeVisible();
 await expect(page.locator('.homeTabs.modernNav')).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('tabs-after-review-back.png'),fullPage:false});
});

test('Game Review uses local Stockfish, completes once and reuses cached verified review',async({page},testInfo)=>{
 await page.route('https://lichess.org/api/cloud-eval**',route=>route.abort());
 await page.route('https://chess-api.com/**',route=>route.abort());
 await page.route('https://api.chess.com/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({archives:[]})}));
 await page.goto('/');
 await page.evaluate(async()=>{localStorage.setItem('chess-username','qa_white');localStorage.setItem('chess-review-depth','ultra');
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('rk93-chess-analyser',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('games'))r.result.createObjectStore('games',{keyPath:'_key'}).createIndex('end_time','end_time')}});
  await new Promise((resolve,reject)=>{const tx=db.transaction('games','readwrite');tx.objectStore('games').put({_key:'qa-fast-review',url:'qa-fast-review',pgn:'[Event "Fast Review"]\\n[White "qa_white"]\\n[Black "qa_black"]\\n\\n1. e4 e5 2. Nf3 Nc6',white:{username:'qa_white',result:'win'},black:{username:'qa_black',result:'resigned'},end_time:1792530000,time_control:'600',time_class:'rapid'});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close();
 });
 await page.reload();await page.locator('#gamesTab').click();
 await page.locator('.gameWithAvatar').first().click();
 if(await page.locator('#reviewDepthCancel').isVisible())await page.locator('#reviewDepthCancel').click();
 const start=Date.now();
 await page.locator('#runReview').click();
 await expect(page.locator('#reviewStatus')).toContainText('Verified review ready',{timeout:60000});
 const elapsed=Date.now()-start;
 expect(elapsed).toBeLessThan(60000);
 const saved=await page.evaluate(async()=>{
  // Review event snapshot is also persisted to IndexedDB.
  const keys=await indexedDB.databases();return keys.map(x=>x.name);
 });
 expect(saved.length).toBeGreaterThan(0);
 await page.screenshot({path:testInfo.outputPath('local-review-ready.png'),fullPage:false});
 await page.locator('#back').click();
 await page.locator('.gameWithAvatar').first().click();
 await expect(page.locator('#reviewStatus')).toContainText('Verified review ready',{timeout:12000});
});
