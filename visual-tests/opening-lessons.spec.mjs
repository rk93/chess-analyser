import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {Chess} from 'chess.js';
import {compileOpening} from '../js/opening-lesson-core.js';
import {assertNavigationUsable} from './fixtures/navigation-fixtures.mjs';
import {auditFeedback,boardMove} from './fixtures/feedback-fixtures.mjs';
import {holdReviewEngine} from './fixtures/review-wait-fixtures.mjs';
const data=JSON.parse(await readFile(new URL('../data/openings/catalog.json',import.meta.url),'utf8'));
const entry=name=>data.entries.find(item=>item.name===name),italian=entry('Italian Game: Giuoco Piano'),gambit=entry("King's Gambit Accepted");
async function init(page){
 await page.addInitScript(()=>{window.lessonFens=[];addEventListener('chessPositionChanged',event=>{if(event.detail.context==='lab')lessonFens.push(event.detail.fen);});});
 await page.goto('/');await page.locator('#boardLabTab').click();await page.locator('#labOpeningLessons>summary').click();await expect(page.locator('#labOpeningStatus')).toContainText('3,865');
}
async function select(page,line=italian,side='white'){
 await page.locator('#labOpeningSearch').fill(line.name);await page.locator('#labOpeningSide').selectOption(side);
 await page.locator(line.gambit?'#labGambitSelect':'#labOpeningSelect').selectOption(line.id);
 await expect(page.locator('#labOpeningPreview strong')).toContainText(line.name);
}
const fen=page=>page.evaluate(()=>lessonFens.at(-1));

test('the full local catalogue is searchable with bounded mobile pickers and no initial engine work',async({page},info)=>{
 const requests=[],workers=[],errors=[];page.context().on('request',r=>requests.push(r.url()));page.on('worker',w=>workers.push(w));page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.locator('#boardLabTab').click();expect(requests.some(url=>url.endsWith('catalog.json'))).toBe(false);
 await page.locator('#labOpeningLessons>summary').click();await expect(page.locator('#labOpeningStatus')).toContainText('3,865');
 expect(await page.locator('#labOpeningSelect option').count()).toBeLessThanOrEqual(101);await expect(page.locator('#labOpeningMatches')).toContainText('1,315');
 await select(page);await expect(page.locator('#labOpeningPreview')).toContainText(italian.pgn);await expect(page.locator('#labOpeningWatch')).toBeEnabled();
 await page.screenshot({path:info.outputPath('opening-selector.png'),fullPage:true,animations:'disabled'});
 await page.locator('#labOpeningSearch').fill('unfindablezzzz');await expect(page.locator('#labOpeningMatches')).toContainText('0 / 0');await expect(page.locator('#labOpeningWatch')).toBeDisabled();
 expect(workers).toHaveLength(0);expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
});

test('Watch full line plays every recorded ply quietly on the actual board',async({page},info)=>{
 await auditFeedback(page);await init(page);await select(page);const workers=[];page.on('worker',w=>workers.push(w));
 await page.locator('#labOpeningWatch').click();const feedback=await page.evaluate(()=>({sounds:feedbackAudit.starts.length,haptics:feedbackAudit.vibrations.length}));
 await expect(page.locator('#labOpeningProgress')).toContainText('6 / 6 plies · Recorded line complete',{timeout:15000});
 expect(await fen(page)).toBe(compileOpening(italian,Chess).end);expect(workers).toHaveLength(0);
 expect(await page.evaluate(()=>feedbackAudit.starts.length)).toBe(feedback.sounds);expect(await page.evaluate(()=>feedbackAudit.vibrations.length)).toBe(feedback.haptics);
 const board=await page.locator('#labBoard').boundingBox(),dock=await page.locator('#labOpeningDock').boundingBox();expect(dock.y).toBeGreaterThanOrEqual(0);expect(board.y+board.height).toBeLessThanOrEqual(page.viewportSize().height);await assertNavigationUsable(page);await page.screenshot({path:info.outputPath('opening-full-line.png'),animations:'disabled'});
 await page.locator('#labOpeningExit').click();await page.locator('#labBack').click();expect(await fen(page)).toBe(compileOpening(italian,Chess).moves.at(-1).before);
 const mate=entry("Barnes Opening: Fool's Mate");await select(page,mate);await page.locator('#labOpeningWatch').click();await expect(page.locator('#labOpeningProgress')).toContainText('4 / 4 plies · Recorded line complete',{timeout:15000});expect(new Chess(await fen(page)).isCheckmate()).toBe(true);await expect(page.locator('#labOpeningContinue')).toBeHidden();await expect(page.locator('#labOpeningPause')).toBeDisabled();
});

test('practice as White follows the entire book then a real Stockfish opponent continues legally',async({page})=>{
 await init(page);await select(page);await page.locator('#labOpeningPractise').click();
 for(const [from,to,replySquare] of [['e2','e4','e5'],['g1','f3','c6'],['f1','c4','c5']]){
  await boardMove(page,from,to);await expect(page.locator(`#labBoard [data-square="${replySquare}"] .piece`)).toHaveCount(1);
 }
 await expect(page.locator('#labOpeningProgress')).toContainText('Stockfish free play');expect(await fen(page)).toBe(compileOpening(italian,Chess).end);
 const workers=[];page.on('worker',w=>workers.push(w));await boardMove(page,'a2','a3');
 await expect.poll(async()=>new Chess(await fen(page)).turn(),{timeout:20000}).toBe('w');expect(workers).toHaveLength(1);
 const history=await page.evaluate(()=>lessonFens);expect(history).toContain(compileOpening(italian,Chess).end);await expect(page.locator('#labOpeningStatus')).toContainText('Stockfish played');
});

test('gambit practice as Black rejects deviations, keeps flipped hints accurate and reaches the gambit endpoint',async({page},info)=>{
 await init(page);await select(page,gambit,'black');await page.locator('#labOpeningPractise').click();
 await expect(page.locator('#labBoard .sq').first()).toHaveAttribute('data-square','h1');await expect(page.locator('#labBoard [data-square="e4"] .piece')).toHaveCount(1);
 const before=await fen(page);await boardMove(page,'c7','c5');expect(await fen(page)).toBe(before);await expect(page.locator('#labOpeningStatus')).toContainText('continues with e5');
 await page.locator('#labOpeningHint').click();await expect(page.locator('#labArrows line')).toHaveAttribute('x1','350');await page.locator('#labFlip').click();await expect(page.locator('#labArrows line')).toHaveAttribute('x1','450');
 await boardMove(page,'e7','e5');await expect(page.locator('#labBoard [data-square="f4"] .piece')).toHaveCount(1);await boardMove(page,'e5','f4');
 await expect(page.locator('#labOpeningProgress')).toContainText('4 / 4 plies');expect(await page.evaluate(()=>lessonFens)).toContain(compileOpening(gambit,Chess).end);
 await page.screenshot({path:info.outputPath('gambit-as-black.png'),animations:'disabled'});
});

test('pause, resume, restart and exit cancel scheduled moves without losing board history',async({page})=>{
 await init(page);await select(page);const anchor=new Date();await page.clock.install({time:anchor});await page.clock.pauseAt(new Date(anchor.getTime()+1000));
 await page.locator('#labOpeningWatch').click();await page.locator('#labOpeningPause').click();const initial=await fen(page);await page.clock.runFor(5000);expect(await fen(page)).toBe(initial);
 await page.locator('#labOpeningPause').click();await page.clock.runFor(4000);await expect(page.locator('#labOpeningProgress')).toContainText('Recorded line complete');
 await page.locator('#labOpeningRestart').click();await expect(page.locator('#labOpeningProgress')).toContainText('0 / 6');await page.locator('#labOpeningExit').click();const stopped=await fen(page);await page.clock.runFor(5000);expect(await fen(page)).toBe(stopped);await expect(page.locator('#labOpeningDock')).toBeHidden();
 await page.locator('#setupToggle').click();await expect(page.locator('#setupPanel')).toBeVisible();await expect(page.locator('#labAnalyse')).toBeDisabled();await page.locator('#setupCancel').click();await expect(page.locator('#labAnalyse')).toBeEnabled();
 await assertNavigationUsable(page);
});

test('leaving a pending engine continuation stops it and cannot play a late move after returning',async({page})=>{
 await holdReviewEngine(page,0);await init(page);const short=entry('Amar Opening');await select(page,short);await page.locator('#labOpeningPractise').click();await boardMove(page,'g1','h3');
 await expect.poll(()=>page.evaluate(()=>reviewEngineAudit.go)).toBe(1);const before=await fen(page);await page.locator('#homeDashboardTab').click();await expect.poll(()=>page.evaluate(()=>reviewEngineAudit.stop)).toBe(1);
 await page.locator('#boardLabTab').click();await page.waitForTimeout(450);expect(await fen(page)).toBe(before);await expect(page.locator('#labOpeningDock')).toBeHidden();await assertNavigationUsable(page);
});

test.describe('catalogue availability',()=>{
 test.use({serviceWorkers:'block'});
 test('catalogue errors can be retried; cached lines work offline with reduced motion and accessible controls',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.route('**/data/openings/catalog.json',route=>route.abort());
  await page.goto('/');await page.locator('#boardLabTab').click();await page.locator('#labOpeningLessons>summary').click();await expect(page.locator('#labOpeningRetry')).toBeVisible();
  await page.unroute('**/data/openings/catalog.json');await page.locator('#labOpeningRetry').click();await expect(page.locator('#labOpeningStatus')).toContainText('3,865');
  await select(page);await page.context().setOffline(true);await page.locator('#labOpeningWatch').click();await expect(page.locator('#labOpeningProgress')).toContainText('Recorded line complete',{timeout:15000});
  const heights=await page.locator('#labOpeningDock button').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).map(n=>n.getBoundingClientRect().height));expect(heights.every(height=>height>=44)).toBe(true);await assertNavigationUsable(page);
 });
 test('closing a loading selector offers a working retry without changing the board',async({page})=>{
  let release;const gate=new Promise(resolve=>release=resolve);await page.route('**/data/openings/catalog.json',async route=>{await gate;await route.continue().catch(()=>{});});
  await page.goto('/');await page.locator('#boardLabTab').click();await page.locator('#labOpeningLessons>summary').click();await expect(page.locator('#labOpeningStatus')).toContainText('Loading');
  await page.locator('#labOpeningLessons>summary').click();release();await page.unroute('**/data/openings/catalog.json');await page.locator('#labOpeningLessons>summary').click();
  if(await page.locator('#labOpeningRetry').isVisible())await page.locator('#labOpeningRetry').click();
  await expect(page.locator('#labOpeningStatus')).toContainText('3,865');await expect(page.locator('#labOpeningDock')).toBeHidden();await expect(page.locator('#labBoard .piece')).toHaveCount(32);
 });

});
