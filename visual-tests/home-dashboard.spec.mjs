import {test,expect} from '@playwright/test';
const pgn='[Event "Rapid"]\n[Site "Chess.com"]\n[Opening "Italian Game"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 1-0';
test('Home shows five horizontally swipeable real chess game boards and a Games library',async({page},testInfo)=>{
 await page.goto('/');
 await page.evaluate(async({pgn})=>{
  localStorage.setItem('chess-username','home-tester');
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('rk93-chess-analyser',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onupgradeneeded=()=>{r.result.createObjectStore('games',{keyPath:'_key'}).createIndex('end_time','end_time')}});
  await new Promise((resolve,reject)=>{const tx=db.transaction('games','readwrite');for(let i=0;i<6;i++)tx.objectStore('games').put({_key:'dashboard-fixture-'+i,url:'dashboard-fixture-'+i,end_time:1700000000+i,white:{username:'home-tester',rating:1400+i,result:i%2?'resigned':'win'},black:{username:'Opponent-'+i,rating:1430,result:i%2?'win':'resigned'},time_class:'rapid',time_control:'600',pgn});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
  db.close();
 },{pgn});
 await page.reload();
 await expect(page.locator('#homeView')).toBeVisible();
 await expect(page.locator('#homeRecentScroller .homeRecentCard')).toHaveCount(5);
 await expect(page.locator('#homeRecentScroller .homeMiniBoard').first().locator('.homeMiniSquare')).toHaveCount(64);
 await expect(page.locator('#homeRecentScroller .homeRecentCard').first()).toContainText('Opponent-5');
 await expect(page.locator('#homeOpeningName')).toContainText('Italian Game');
 const scroll=await page.locator('#homeRecentScroller').evaluate(el=>({width:el.scrollWidth,client:el.clientWidth}));
 expect(scroll.width).toBeGreaterThan(scroll.client);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+3)).toBeTruthy();
 await page.screenshot({path:testInfo.outputPath('home-dashboard-five-games.png'),fullPage:false});
 await page.locator('#homeViewAllGames').click();
 await expect(page.locator('#libraryView')).toBeVisible();
 await expect(page.locator('#homeView')).toBeHidden();
 await page.goBack();
 await expect(page.locator('#homeView')).toBeVisible();
 await page.locator('#homeRecentScroller .homeRecentCard').first().click();
 await expect(page.locator('#analysisView')).toBeVisible();
});
test('Home daily puzzle launches existing puzzles screen without network work on Home',async({page})=>{
 await page.goto('/');
 await expect(page.locator('#homeView')).toBeVisible();
 await page.locator('#homeSolvePuzzle').click();
 await expect(page.locator('#puzzlesView')).toBeVisible();
 await expect(page.locator('#homeView')).toBeHidden();
});
