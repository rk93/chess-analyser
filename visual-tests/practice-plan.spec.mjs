import {test,expect} from '@playwright/test';
import {seedPracticePlan,FORK_POSITION} from './fixtures/practice-plan-fixtures.mjs';
import {holdReviewEngine} from './fixtures/review-wait-fixtures.mjs';
const widget=page=>page.locator('chess-practice-progress');
const fork=page=>widget(page).locator('.revisit').filter({hasText:'Checking knight fork'});
const history=page=>page.evaluate(()=>localStorage.getItem('chess-practice-history:alpha'));

test('a bounded personal plan shows real due dates and clear scheduling rules without starting engines',async({page},info)=>{
  const workers=[],errors=[];page.on('worker',worker=>workers.push(worker));page.on('pageerror',error=>errors.push(error.message));
  await seedPracticePlan(page);await expect(widget(page).locator('.readyCount')).toHaveText('2 ready');await expect(widget(page).locator('.revisit')).toHaveCount(2);await expect(fork(page)).toContainText('Rapid game');await expect(fork(page)).toContainText('Another look can help');
  await widget(page).getByRole('button',{name:'How revisits work'}).click();await expect(widget(page).locator('.planExplanation')).toContainText('1, 3, 7, then 14 days');await expect(widget(page).locator('.planExplanation')).toContainText('not a measure of playing strength');
  expect(await widget(page).locator('.plan button').evaluateAll(buttons=>buttons.every(button=>{const rect=button.getBoundingClientRect();return rect.width>=44&&rect.height>=44}))).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);expect(workers).toHaveLength(0);expect(errors).toEqual([]);
  await widget(page).locator('.plan').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('practice-plan-ready.png'),animations:'disabled'});
});

test('a fresh solve offers a future revisit and empty histories invent neither dates nor obligations',async({page})=>{
  await seedPracticePlan(page,{mode:'upcoming'});await expect(widget(page).locator('.nextRevisit')).toContainText('1-day interval');await expect(widget(page).locator('.revisit')).toHaveCount(0);await expect(widget(page).locator('.plan')).toContainText('Come back fresh');
  await page.evaluate(()=>{localStorage.removeItem('chess-practice-history:alpha');dispatchEvent(new CustomEvent('practiceHistoryChanged',{detail:{user:'alpha'}}))});await expect(widget(page).locator('.plan')).toHaveCount(0);await expect(widget(page).locator('.empty')).toContainText('Your next position starts');
});

test('native Stockfish resume preserves a reveal across reload without inventing attempts and clears after solving',async({page})=>{
  test.setTimeout(60000);await seedPracticePlan(page,{mode:'empty',realEngine:true});
  await page.locator('#homeFindTraining').click();await page.locator('.homePracticeCard').filter({hasText:'Checking knight fork'}).click();await expect(page.locator('#boardLabView')).toBeVisible();
  await page.locator('#labPracticeReveal').click();await page.locator('#homeDashboardTab').click();await expect(widget(page).locator('.resume')).toContainText('answer previously revealed');expect(await history(page)).toBe(null);
  await page.reload();await widget(page).getByRole('button',{name:'Resume practice'}).click();await expect(page.locator('#boardLabView')).toBeVisible();
  await page.locator('#labBoard [data-square="c4"]').click();await page.locator('#labBoard [data-square="d6"]').click();await expect(page.locator('#labSource')).toContainText('solved');
  expect(await page.evaluate(()=>localStorage.getItem('chess-practice-resume:alpha'))).toBe(null);
  await page.locator('#labPracticeRetry').click();await page.locator('#labBoard [data-square="c4"]').click();await page.locator('#labBoard [data-square="b6"]').click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-practice-resume:alpha')).revealed)).toBe(true);
  await page.locator('#labPracticeRetry').click();await page.locator('#labBoard [data-square="c4"]').click();await page.locator('#labBoard [data-square="d6"]').click();await page.locator('#homeDashboardTab').click();
  await expect(widget(page).locator('.resume')).toHaveCount(0);await expect(widget(page).locator('.nextRevisit')).toContainText('1-day interval');await expect(widget(page).locator('.metric strong')).toHaveText(['1','0','1']);
  const state=await page.evaluate(()=>({events:JSON.parse(localStorage.getItem('chess-practice-history:alpha')).events,resume:localStorage.getItem('chess-practice-resume:alpha'),progress:Object.values(JSON.parse(localStorage.getItem('chess-personal-training:alpha')))}));
  expect(state.events).toHaveLength(3);expect(state.events[0].correct).toBe(true);expect(state.events[0].revealed).toBe(true);expect(state.resume).toBe(null);expect(state.progress[0].assisted).toBe(2);await expect(page.locator('#homeMetrics strong').first()).toHaveText('7');await expect(page.locator('#gamesTab')).toBeVisible();
});

test('existing discovery prioritises a due previously solved position ahead of new exercises',async({page})=>{
  await seedPracticePlan(page,{mode:'only-ready'});await page.locator('#homeFindTraining').click();await expect(page.locator('.homePracticeCard').first()).toContainText('Checking knight fork');await expect(page.locator('.homePracticeCard').first()).toContainText('solved');
  expect(await page.locator('.homePracticeCard').count()).toBeLessThanOrEqual(8);
});

test('missing saved evidence gives a useful error and dismissing a resume preserves dated history',async({page})=>{
  await seedPracticePlan(page,{resume:true});const original=await history(page),workers=[];page.on('worker',worker=>workers.push(worker));
  await page.evaluate(async()=>{const db=await new Promise(resolve=>{const req=indexedDB.open('rk93-chess-analyser',1);req.onsuccess=()=>resolve(req.result)});await new Promise(resolve=>{const tx=db.transaction('games','readwrite');for(let i=0;i<3;i++)tx.objectStore('games').delete('motif-game-'+i);tx.oncomplete=resolve});db.close();dispatchEvent(new Event('chessGamesImported'))});
  await expect(page.locator('#homeMetrics strong').first()).toHaveText('4');await widget(page).getByRole('button',{name:'Resume practice'}).click();await expect(widget(page).locator('.planStatus')).toContainText('not in the latest 60 games');await expect(widget(page).getByRole('button',{name:'Resume practice'})).toBeEnabled();
  await widget(page).getByRole('button',{name:'Dismiss unfinished position'}).click();await expect(widget(page).locator('.resume')).toHaveCount(0);expect(await history(page)).toBe(original);expect(workers).toHaveLength(0);await expect(page.locator('#boardLabView')).toBeHidden();
});

test('future resume formats and quota failures preserve data and leave ordinary verified practice usable',async({page})=>{
  test.setTimeout(60000);await seedPracticePlan(page,{mode:'empty'});
  await page.evaluate(()=>{localStorage.setItem('chess-practice-resume:alpha','{"version":2,"keep":"future"}');dispatchEvent(new CustomEvent('practiceResumeChanged',{detail:{user:'alpha'}}))});await expect(widget(page).locator('.planWarning')).toContainText('couldn’t be loaded');
  await page.locator('#homeFindTraining').click();await page.locator('.homePracticeCard').filter({hasText:'Checking knight fork'}).click();await expect(page.locator('#boardLabView')).toBeVisible();await expect(page.locator('#labPracticeCoachDock')).toContainText('Resume couldn’t be saved');await page.locator('#labBoard [data-square="c4"]').click();await page.locator('#labBoard [data-square="d6"]').click();await page.locator('#homeDashboardTab').click();
  expect(await page.evaluate(()=>localStorage.getItem('chess-practice-resume:alpha'))).toBe('{"version":2,"keep":"future"}');
  await page.evaluate(()=>{localStorage.removeItem('chess-practice-resume:alpha');const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('chess-practice-resume:'))throw new DOMException('Full','QuotaExceededError');return set.call(this,key,value)}});
  await page.locator('#homeFindTraining').click();await page.locator('.homePracticeCard').filter({hasText:'Checking knight fork'}).click();await expect(page.locator('#boardLabView')).toBeVisible();await expect(page.locator('#labPracticeCoachDock')).toContainText('Resume couldn’t be saved');await page.locator('#labBoard [data-square="c4"]').click();await page.locator('#labBoard [data-square="d6"]').click();await page.locator('#homeDashboardTab').click();
  await expect(page.locator('#homeTrainingProgress')).toContainText('2 attempts');expect(JSON.parse(await history(page)).events).toHaveLength(2);await expect(page.locator('#homeMetrics strong').first()).toHaveText('7');
});

test('cancel, navigation and account changes drain the real worker and cannot reopen a stale planned position',async({page})=>{
  test.setTimeout(60000);await holdReviewEngine(page,0);await seedPracticePlan(page,{mode:'only-ready'});
  await fork(page).click();await expect.poll(()=>page.evaluate(()=>reviewEngineAudit.go)).toBe(1);await widget(page).getByRole('button',{name:'Cancel practice check'}).click();await expect.poll(()=>page.evaluate(()=>reviewEngineAudit.stop)).toBe(1);await expect(widget(page).locator('.planStatus')).toContainText('paused');
  await fork(page).click();await expect.poll(()=>page.evaluate(()=>reviewEngineAudit.go)).toBe(2);await widget(page).getByRole('button',{name:'Reviewed games',exact:true}).click();await expect.poll(()=>page.evaluate(()=>reviewEngineAudit.stop)).toBe(2);await widget(page).getByRole('button',{name:'Practice',exact:true}).click();
  await fork(page).click();await expect.poll(()=>page.evaluate(()=>reviewEngineAudit.go)).toBe(3);await page.locator('#gamesTab').click();await expect.poll(()=>page.evaluate(()=>reviewEngineAudit.stop)).toBe(3);await expect(page.locator('#libraryView')).toBeVisible();await page.locator('#homeDashboardTab').click();
  await fork(page).click();await expect.poll(()=>page.evaluate(()=>reviewEngineAudit.go)).toBe(4);await page.evaluate(()=>{localStorage.setItem('chess-username','stranger');dispatchEvent(new Event('chessImportFinished'))});await expect.poll(()=>page.evaluate(()=>reviewEngineAudit.stop)).toBe(4);await expect(widget(page).locator('.plan')).toHaveCount(0);await expect(page.locator('#boardLabView')).toBeHidden();
  await page.evaluate(()=>{holdEngineAfter=Number.MAX_SAFE_INTEGER;localStorage.setItem('chess-username','alpha');dispatchEvent(new Event('chessImportFinished'))});await fork(page).click();await expect(page.locator('#boardLabView')).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-practice-resume:alpha')).position)).toBe(FORK_POSITION);expect(await page.evaluate(()=>localStorage.getItem('chess-practice-resume:stranger'))).toBe(null);
  await page.locator('#homeDashboardTab').click();await expect(page.locator('#gamesTab')).toBeVisible();await page.locator('#gamesTab').click();await expect(page.locator('#libraryView')).toBeVisible();
});

test('cached plans, keyboard dismissal and account isolation work offline with reduced motion',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await seedPracticePlan(page,{resume:true});const before=await history(page);await page.context().setOffline(true);
  const dismiss=widget(page).getByRole('button',{name:'Dismiss unfinished position'});await dismiss.focus();await dismiss.press('Space');await expect(widget(page).locator('.resume')).toHaveCount(0);expect(await history(page)).toBe(before);
  await widget(page).getByRole('button',{name:'How revisits work'}).click();await expect(widget(page).locator('.planExplanation')).toBeVisible();
  await page.evaluate(()=>{localStorage.setItem('chess-username','stranger');dispatchEvent(new Event('chessImportFinished'))});await expect(widget(page).locator('.plan')).toHaveCount(0);
  await page.evaluate(()=>{localStorage.setItem('chess-username','alpha');dispatchEvent(new Event('chessImportFinished'))});await expect(widget(page).locator('.readyCount')).toHaveText('2 ready');await expect(widget(page).locator('.resume')).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
});

test.describe('delayed saved evidence',()=>{
  test.use({serviceWorkers:'block'});
  test('a late saved review cannot contaminate a new account discovery while both reads are pending',async({page})=>{
    await page.addInitScript(()=>{window.pauseSavedRead=false;window.savedReadWaiters=[];window.finishedSavedReads=0;});
    await page.route('**/js/saved-review.js',async route=>{
      const response=await route.fetch(),original=await response.text();
      const needle="return { moves, data:await cacheGet('review', key) };";expect(original).toContain(needle);
      const body=original.replace(needle,"if(globalThis.pauseSavedRead)await new Promise(resolve=>globalThis.savedReadWaiters.push(resolve));const result={moves,data:await cacheGet('review',key)};globalThis.finishedSavedReads++;return result;");
      await route.fulfill({response,body,contentType:'text/javascript'});
    });
    await seedPracticePlan(page,{mode:'only-ready'});await page.evaluate(()=>pauseSavedRead=true);await fork(page).click();await expect.poll(()=>page.evaluate(()=>savedReadWaiters.length)).toBe(1);
    await page.evaluate(()=>{localStorage.setItem('chess-username','motif-source-3');dispatchEvent(new Event('chessImportFinished'))});await expect(page.locator('#homeMetrics strong').first()).toHaveText('1');
    await page.locator('#homeFindTraining').click();await expect.poll(()=>page.evaluate(()=>savedReadWaiters.length)).toBe(2);
    await page.evaluate(()=>savedReadWaiters.shift()());await expect.poll(()=>page.evaluate(()=>finishedSavedReads)).toBe(1);
    await page.evaluate(()=>{pauseSavedRead=false;savedReadWaiters.shift()()});await expect(page.locator('#homeFindTraining')).toBeEnabled();
    await expect(page.locator('.homePracticeCard')).toHaveCount(0);await expect(page.locator('#homeTrainingStatus')).toContainText('0 distinct verified practice positions');
    await expect(page.locator('#boardLabView')).toBeHidden();expect(await page.evaluate(()=>localStorage.getItem('chess-practice-resume:motif-source-3'))).toBe(null);
  });
});
