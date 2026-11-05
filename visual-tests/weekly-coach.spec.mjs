import {test,expect} from '@playwright/test';
import {seedWeeklyCoach,seedWeeklyReviews,weeklyGames} from './fixtures/weekly-coach-fixtures.mjs';
import {holdReviewEngine} from './fixtures/review-wait-fixtures.mjs';

test('weekly plan is local, format-specific and useful before any review evidence is checked',async({page},info)=>{
  const workers=[],errors=[];page.on('worker',worker=>workers.push(worker));page.on('pageerror',error=>errors.push(error.message));await seedWeeklyCoach(page);
  await expect(page.locator('#weeklyCoachPool')).toHaveValue('rapid');await expect(page.locator('.weeklyCoverage')).toContainText('0 inspected / 10 saved rapid games this week');
  await expect(page.locator('#weeklyCoach')).not.toContainText('Saved Stockfish evidence');await expect(page.locator('#weeklyCoachActions')).toContainText('Explore Italian Game');
  await expect(page.locator('#weeklyCoachComparison')).toContainText('needs 10 known results');expect(workers).toHaveLength(0);expect(errors).toEqual([]);
  await page.locator('#weeklyCoachPool').selectOption('blitz');await expect(page.locator('.weeklyCoverage')).toContainText('4 saved blitz games');await expect(page.locator('#weeklyCoachActions')).not.toContainText('Italian Game');
  await page.locator('#weeklyCoachPool').selectOption('rapid');await page.locator('.homeWeekCard').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('weekly-before-evidence.png'),animations:'disabled'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
});
test('shared saved-review scan creates three sourced actions and study marks survive reload without becoming improvement claims',async({page},info)=>{
  await seedWeeklyCoach(page);await seedWeeklyReviews(page);const workers=[];page.on('worker',worker=>workers.push(worker));
  await page.locator('#weeklyCoachCheck').click();await expect(page.locator('.weeklyCoverage')).toContainText('3 eligible reviews');await expect(page.locator('#weeklyCoachStatus')).toContainText('Saved review check complete');
  const actions=page.locator('#weeklyCoachActions article');await expect(actions).toHaveCount(3);await expect(actions.nth(0)).toContainText('Find the missed mate');await expect(actions.nth(0)).toContainText('3 supporting / 3 reviewed games');
  await expect(actions.nth(1)).toContainText('Explore Italian Game');await expect(actions.nth(2)).toContainText('Complete one game review');expect(workers).toHaveLength(0);
  const study=actions.nth(1).locator('input[type=checkbox]');await study.check();await expect(study).toBeChecked();await expect(page.locator('#weeklyCoach')).toContainText('Playing improvement needs further games');
  await page.locator('.homeWeekCard').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('weekly-coach-after.png'),animations:'disabled'});
  await page.reload();await expect(page.locator('#weeklyCoachActions').getByText('Explore Italian Game')).toBeVisible();await expect(page.locator('#weeklyCoachActions article').filter({hasText:'Explore Italian Game'}).locator('input')).toBeChecked();
  await expect(page.locator('#weeklyCoach')).not.toContainText('Saved Stockfish evidence');
});
test('partial, shallow and malformed cached reviews remain unavailable rather than clean games',async({page})=>{
  await seedWeeklyCoach(page);await seedWeeklyReviews(page,{invalid:true});await page.locator('#weeklyCoachCheck').click();
  await expect(page.locator('.weeklyCoverage')).toContainText('0 eligible reviews');await expect(page.locator('.weeklyCoverage')).toContainText('10 inspected / 10 saved rapid games');
  await expect(page.locator('#weeklyCoachActions')).not.toContainText('Saved Stockfish evidence');await expect(page.locator('#weeklyCoachEvidence')).toContainText('depth 8 or greater');
});
test('opening and source actions use existing board/review routes and return Home reliably',async({page})=>{
  await seedWeeklyCoach(page);const opening=page.locator('#weeklyCoachActions article').filter({hasText:'Explore Italian Game'});await opening.locator('[data-coach-go]').click();
  await expect(page.locator('#boardLabView')).toBeVisible();await expect(page.locator('#labSource')).toContainText('Opening study');await expect(page.locator('#labBoard .piece')).toHaveCount(32);
  await page.goBack();await expect(page.locator('#homeView')).toBeVisible();
  await page.evaluate(()=>{const dismiss=()=>document.getElementById('reviewDepthCancel')?.click();new MutationObserver(dismiss).observe(document.body,{childList:true,subtree:true});dismiss()});
  await opening.locator('summary').click();await opening.locator('[data-coach-source]').click();await expect(page.locator('#analysisView')).toBeVisible();await expect(page.locator('#gameTitle')).toContainText('weekly-opening-');
  await page.goBack();await expect(page.locator('#homeView')).toBeVisible();await expect(page.locator('.modernNav')).toBeVisible();
});
test('weekly practice revalidates the actual saved mate with Stockfish and uses the existing training progress',async({page})=>{
  test.setTimeout(60000);await seedWeeklyCoach(page);await seedWeeklyReviews(page,{realEngine:true});await page.locator('#weeklyCoachCheck').click();
  const action=page.locator('#weeklyCoachActions article').filter({hasText:'Find the missed mate'});await action.locator('[data-coach-go]').click();
  await expect(page.locator('#boardLabView')).toBeVisible({timeout:20000});await expect(page.locator('#labSource')).toContainText('Training');
  await page.locator('#labBoard [data-square="d8"]').click();await page.locator('#labBoard [data-square="h4"]').click();await expect(page.locator('#labSource')).toContainText('solved');
  expect(await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('chess-personal-training:alpha')||'{}')).some(row=>row.solvedAt&&row.correct===1))).toBe(true);
  await page.locator('#homeDashboardTab').click();await expect(page.locator('#weeklyCoachStatus')).toContainText('Solution checked');await expect(page.locator('#weeklyCoachActions')).toContainText('Previously solved without reveal');
});
test('cancelled weekly practice cannot open later, and the existing practice search remains usable',async({page})=>{
  await holdReviewEngine(page,0);await seedWeeklyCoach(page);await seedWeeklyReviews(page);await page.locator('#weeklyCoachCheck').click();
  const action=page.locator('#weeklyCoachActions article').filter({hasText:'Find the missed mate'});await action.locator('[data-coach-go]').click();await expect(page.locator('#weeklyPracticeCancel')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>reviewEngineAudit.go)).toBe(1);await page.locator('#homeFindTraining').click();
  await expect.poll(()=>page.evaluate(()=>reviewEngineAudit.stop)).toBe(1);await expect(page.locator('#homeFindTraining')).toBeEnabled();await expect(page.locator('#weeklyCoachStatus')).toContainText('paused');
  await page.waitForTimeout(200);await expect(page.locator('#homeView')).toBeVisible();await expect(page.locator('#boardLabView')).toBeHidden();
});
test('account changes and storage errors preserve games and isolate study marks and evidence',async({page})=>{
  await seedWeeklyCoach(page);await page.locator('#weeklyCoachActions input').first().check();
  await page.evaluate(()=>{localStorage.setItem('chess-username','stranger');window.dispatchEvent(new Event('chessImportFinished'))});
  await expect(page.locator('#weeklyCoachActions')).toContainText('No saved rapid games');await expect(page.locator('#weeklyCoachActions input')).toHaveCount(0);
  await page.evaluate(()=>{localStorage.setItem('chess-username','alpha');window.dispatchEvent(new Event('chessImportFinished'))});await expect(page.locator('#weeklyCoachActions input').first()).toBeChecked();
  await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('chess-weekly-coach:'))throw new DOMException('Full','QuotaExceededError');return original.call(this,key,value)}});
  await page.locator('#weeklyCoachActions input').first().uncheck();await expect(page.locator('#weeklyCoachStatus')).toContainText('could not be saved');await expect(page.locator('#homeMetrics strong').first()).toHaveText('24');
});
test('weekly evidence can be checked offline with reduced motion and accessible controls',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await seedWeeklyCoach(page);await seedWeeklyReviews(page);await page.locator('#weeklyCoachCheck').click();await expect(page.locator('.weeklyCoverage')).toContainText('3 eligible reviews');
  await page.context().setOffline(true);await page.locator('#weeklyCoachPool').selectOption('blitz');await page.locator('#weeklyCoachCheck').click();await expect(page.locator('.weeklyCoverage')).toContainText('0 eligible reviews');
  await page.locator('#weeklyCoachPool').selectOption('rapid');await page.locator('#weeklyCoachCheck').click();await expect(page.locator('.weeklyCoverage')).toContainText('3 eligible reviews');
  const sizes=await page.locator('#weeklyCoach button,#weeklyCoach select,.weeklyStudy,#weeklyCoach summary').evaluateAll(nodes=>nodes.filter(node=>node.getClientRects().length).map(node=>node.getBoundingClientRect().height));expect(sizes.every(height=>height>=44)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
});
test('weekly scan stays bounded and makes uninspected games explicit',async({page})=>{
  await seedWeeklyCoach(page);await seedWeeklyReviews(page);
  await page.evaluate(async template=>{
    const db=await new Promise(resolve=>{const r=indexedDB.open('rk93-chess-analyser',1);r.onsuccess=()=>resolve(r.result)});
    await new Promise(resolve=>{const tx=db.transaction('games','readwrite');for(let i=0;i<70;i++)tx.objectStore('games').put({...template,_key:'weekly-bulk-'+i,url:'weekly-bulk-'+i,end_time:Date.now()/1000-100-i,white:{...template.white,result:'win'},black:{...template.black,username:'bulk-'+i,result:'resigned'}});tx.oncomplete=resolve});db.close();window.dispatchEvent(new Event('chessGamesImported'));
  },weeklyGames()[0]);
  await expect(page.locator('#weeklyCoachPool')).toHaveValue('rapid');await page.locator('#weeklyCoachCheck').click();
  await expect(page.locator('.weeklyCoverage')).toContainText('60 inspected / 80 saved rapid games');await expect(page.locator('.weeklyCoverage')).toContainText('20 unchecked');await expect(page.locator('#weeklyCoachActions')).not.toContainText('Saved Stockfish evidence');
});
test.describe('controlled weekly scan timing',()=>{
  test.use({serviceWorkers:'block'});
  test('cancelled scans cannot publish to another account and can be retried',async({page})=>{
    await seedWeeklyCoach(page);await seedWeeklyReviews(page);let release;const gate=new Promise(resolve=>{release=resolve});
    await page.route('**/js/weakness-reviews.js',async route=>{await gate;await route.continue().catch(()=>{})});
    await page.locator('#weeklyCoachCheck').click();await expect(page.locator('#weeklyCoachCancel')).toBeVisible();await page.locator('#weeklyCoachCancel').click();await expect(page.locator('#weeklyCoachStatus')).toContainText('paused');
    await page.evaluate(()=>{localStorage.setItem('chess-username','stranger');window.dispatchEvent(new Event('chessImportFinished'))});await expect(page.locator('#weeklyCoachActions')).toContainText('No saved rapid games');
    const loaded=page.waitForResponse(response=>response.url().endsWith('/js/weakness-reviews.js'));release();await loaded;await expect(page.locator('#weeklyCoachActions')).not.toContainText('Saved Stockfish evidence');
    await page.evaluate(()=>{localStorage.setItem('chess-username','alpha');window.dispatchEvent(new Event('chessImportFinished'))});await page.locator('#weeklyCoachCheck').click();await expect(page.locator('.weeklyCoverage')).toContainText('3 eligible reviews');
  });
});
