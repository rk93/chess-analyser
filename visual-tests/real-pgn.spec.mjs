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
  await page.locator('.gameWithAvatar').first().click();
  await expect(page.locator('#analysisView')).toBeVisible();
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
  await page.screenshot({path:testInfo.outputPath('real-pgn-after-flip.png'),fullPage:true});
});
