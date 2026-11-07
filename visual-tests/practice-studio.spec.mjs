import {test,expect} from '@playwright/test';
import {seedPracticeStudio,seedComparableReviews} from './fixtures/practice-studio-fixtures.mjs';
import {seedTacticalMotifs} from './fixtures/tactical-motif-fixtures.mjs';
import {auditFeedback} from './fixtures/feedback-fixtures.mjs';
const widget=page=>page.locator('chess-practice-progress');

test('Lit studio preserves legacy totals without inventing dated history or starting an engine',async({page},info)=>{
  const workers=[],errors=[],requests=[];page.on('worker',worker=>workers.push(worker));page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>requests.push(request.url()));
  await seedPracticeStudio(page,{rich:false});await expect(widget(page).locator('.empty strong')).toHaveText('Your next position starts the story.');
  await expect(widget(page).locator('.metric strong')).toHaveText(['0','0','0']);await expect(page.locator('#homeTrainingProgress')).toContainText('2 positions solved');
  expect(workers).toHaveLength(0);expect(errors).toEqual([]);expect(requests.some(url=>url.includes('/npm/lit'))).toBe(false);
  expect(await widget(page).locator('button').evaluateAll(buttons=>buttons.every(button=>{const bounds=button.getBoundingClientRect();return bounds.width>=44&&bounds.height>=44}))).toBe(true);
  await page.locator('.homeTrainingCard').evaluate(node=>node.scrollIntoView({block:'start'}));
  if(info.project.use.viewport.width>800){const heading=await page.locator('#homeTrainingTitle').boundingBox(),nav=await page.locator('.modernNav').boundingBox();expect(heading.y).toBeGreaterThan(nav.y+nav.height);}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);await page.screenshot({path:info.outputPath('studio-empty.png'),animations:'disabled'});
});

test('recorded activity is interactive and comparisons match positions rather than inflated retry totals',async({page},info)=>{
  await seedPracticeStudio(page);await expect(page.locator('#homeTrainingProgress')).toContainText('7 positions solved · 18 attempts');await expect(widget(page).locator('.metric strong')).toHaveText(['6','4','1']);await expect(widget(page).locator('.chartHeading')).toContainText('7 tries');
  expect(await widget(page).evaluate(host=>[...host.shadowRoot.querySelectorAll('.activity rect')].every(rect=>rect instanceof SVGRectElement))).toBe(true);
  await widget(page).locator('summary').click();await expect(widget(page).locator('.comparisonNumbers')).toContainText('40%');await expect(widget(page).locator('.comparisonNumbers')).toContainText('60%');await expect(widget(page).locator('.comparison')).toContainText('same 5 positions');
  const range=widget(page).getByRole('slider');await range.focus();await range.press('Home');const first=await widget(page).locator('.readout').textContent();await range.press('ArrowRight');await expect(widget(page).locator('.readout')).not.toHaveText(first);
  await widget(page).getByRole('button',{name:'30d',exact:true}).click();await expect(widget(page).locator('.chartHeading')).toContainText('12 tries');
  await widget(page).getByRole('button',{name:'7d',exact:true}).click();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-practice-history:alpha')).events.length)).toBe(13);
  await page.locator('.homeTrainingCard').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('studio-recorded.png'),animations:'disabled'});
});

test('reviewed-game changes use existing bounded evidence and do not imply practice caused improvement',async({page})=>{
  await seedPracticeStudio(page);await seedComparableReviews(page);const workers=[];page.on('worker',worker=>workers.push(worker));
  await widget(page).getByRole('button',{name:'Reviewed games',exact:true}).click();await expect(widget(page).locator('.empty')).toContainText('More reviewed evidence');
  await widget(page).getByRole('button',{name:'Check saved reviews'}).click();await expect(widget(page).locator('.trends')).toContainText('Improving · -60 percentage points');
  await expect(widget(page).locator('.trends')).toContainText('5 recent / 5 previous eligible reviews');await expect(widget(page).locator('.trendHeading')).toContainText('rapid');await expect(widget(page).locator('.gameIntro')).toContainText('do not establish that practice caused a change');
  await expect(widget(page).locator('.evidenceFooter')).toContainText('10 eligible / 60 checked');expect(workers).toHaveLength(0);
});

test('native Stockfish practice records one retry and assisted solve, ignores replays and survives reload',async({page})=>{
  test.setTimeout(60000);await page.addInitScript(()=>{window.practiceAudit=[];addEventListener('personalTrainingAttempt',event=>practiceAudit.push(structuredClone(event.detail)))});
  await seedTacticalMotifs(page,{realEngine:true});await page.locator('#weeklyCoachCheck').click();await page.locator('#weeklyCoachActions article').filter({hasText:'Practise a checking knight fork'}).locator('[data-coach-go]').click();
  await expect(page.locator('#boardLabView')).toBeVisible();await page.locator('#labBoard [data-square="c4"]').click();await page.locator('#labBoard [data-square="b6"]').click();await expect(page.locator('#labSource')).toContainText('try again');
  await page.locator('#labPracticeRetry').click();await page.locator('#labPracticeReveal').click();await page.locator('#labBoard [data-square="c4"]').click();await page.locator('#labBoard [data-square="d6"]').click();await expect(page.locator('#labSource')).toContainText('solved');
  await page.evaluate(()=>dispatchEvent(new CustomEvent('personalTrainingAttempt',{detail:practiceAudit.at(-1)})));
  const state=await page.evaluate(()=>({log:JSON.parse(localStorage.getItem('chess-practice-history:alpha')),progress:Object.values(JSON.parse(localStorage.getItem('chess-personal-training:alpha')))}));
  expect(state.log.events).toHaveLength(2);expect(state.log.events.map(event=>event.correct)).toEqual([false,true]);expect(state.log.events[1].revealed).toBe(true);expect(state.log.events[1].theme).toBe('knight-fork');expect(state.log.events[1].pool).toBe('rapid');expect(state.progress[0].attempts).toBe(2);
  await page.locator('#homeDashboardTab').click();await expect(widget(page).locator('.metric strong')).toHaveText(['1','0','1']);await page.reload();await expect(widget(page).locator('.chartHeading')).toContainText('2 tries');
  await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('chess-practice-history:'))throw new DOMException('Full','QuotaExceededError');return original.call(this,key,value)}});
  await page.locator('#homeFindTraining').click();await page.locator('.homePracticeCard').filter({hasText:'Checking knight fork'}).click();await expect(page.locator('#boardLabView')).toBeVisible();await page.locator('#labBoard [data-square="c4"]').click();await page.locator('#labBoard [data-square="d6"]').click();await page.locator('#homeDashboardTab').click();
  await expect(page.locator('#homeTrainingProgress')).toContainText('Dated history could not be saved');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-practice-history:alpha')).events.length)).toBe(2);await expect(page.locator('#homeMetrics strong').first()).toHaveText('7');
});

test('account isolation, future storage formats, offline charts and reduced motion preserve existing data',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await seedPracticeStudio(page);await page.context().setOffline(true);await widget(page).getByRole('button',{name:'30d',exact:true}).click();await expect(widget(page).locator('.chartHeading')).toContainText('12 tries');
  await page.evaluate(()=>{localStorage.setItem('chess-username','stranger');dispatchEvent(new Event('chessImportFinished'))});await expect(widget(page).locator('.metric strong')).toHaveText(['0','0','0']);
  await page.evaluate(()=>{localStorage.setItem('chess-username','alpha');dispatchEvent(new Event('chessImportFinished'))});await expect(widget(page).locator('.metric strong')).toHaveText(['6','4','1']);
  await page.evaluate(()=>{localStorage.setItem('chess-practice-history:alpha','{"version":2,"keep":"future"}');dispatchEvent(new CustomEvent('practiceHistoryChanged',{detail:{user:'alpha'}}))});await expect(widget(page).locator('.empty')).toContainText('couldn’t be loaded');
  const raw=await page.evaluate(async()=>{const {savePracticeAttempt}=await import('/js/practice-history-store.js');savePracticeAttempt('alpha',{id:'bad',at:Date.now()});return localStorage.getItem('chess-practice-history:alpha')});expect(raw).toBe('{"version":2,"keep":"future"}');await expect(page.locator('#homeTrainingProgress')).toContainText('7 positions solved');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
});

test('shadow controls respect existing UI sound preferences without duplicate feedback or practice events',async({page})=>{
  await auditFeedback(page);await seedPracticeStudio(page);await widget(page).getByRole('button',{name:'30d',exact:true}).click();expect(await page.evaluate(()=>feedbackAudit.contexts)).toBe(0);
  await page.locator('#settingsNav').click();await page.locator('#uiSoundMode').check();await page.locator('#homeDashboardTab').click();const before=await page.evaluate(()=>feedbackAudit.starts.length);
  await widget(page).getByRole('button',{name:'7d',exact:true}).click();await expect.poll(()=>page.evaluate(()=>feedbackAudit.starts.length)).toBe(before+1);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-practice-history:alpha')).events.length)).toBe(13);
});

test.describe('shared lazy review scan',()=>{
  test.use({serviceWorkers:'block'});
  test('Studio cancels the existing review controller without publishing late evidence',async({page})=>{
    await seedPracticeStudio(page);let release;const gate=new Promise(resolve=>{release=resolve});await page.route('**/js/weakness-reviews.js',async route=>{await gate;await route.continue().catch(()=>{})});
    await widget(page).getByRole('button',{name:'Reviewed games',exact:true}).click();await widget(page).getByRole('button',{name:'Check saved reviews'}).click();await widget(page).getByRole('button',{name:'Cancel',exact:true}).click();
    release();await expect(page.locator('#homeWeaknessStatus')).toContainText('paused');await expect(widget(page).locator('[role=status]')).toContainText('paused');await expect(widget(page).locator('.trends')).toHaveCount(0);await expect(widget(page).getByRole('button',{name:'Check saved reviews'})).toBeEnabled();
  });
  test('a failed shared scan is visible in Studio and a fresh connected visit recovers',async({page})=>{
    await seedPracticeStudio(page);await page.route('**/js/weakness-reviews.js',route=>route.abort('failed'));
    await widget(page).getByRole('button',{name:'Reviewed games',exact:true}).click();await widget(page).getByRole('button',{name:'Check saved reviews'}).click();
    await expect(widget(page).locator('[role=status]')).toContainText('Saved reviews could not be checked');await expect(widget(page).getByRole('button',{name:'Check saved reviews'})).toBeEnabled();await expect(page.locator('#homeTrainingProgress')).toContainText('7 positions solved');
    await page.unroute('**/js/weakness-reviews.js');await page.reload();await widget(page).getByRole('button',{name:'Reviewed games',exact:true}).click();await widget(page).getByRole('button',{name:'Check saved reviews'}).click();
    await expect(widget(page).locator('.evidenceFooter')).toContainText('0 eligible / 60 checked');await expect(widget(page).locator('[role=status]')).not.toContainText('could not be checked');
  });
});
