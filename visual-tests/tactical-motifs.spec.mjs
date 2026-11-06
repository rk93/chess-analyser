import {test,expect} from '@playwright/test';
import {seedTacticalMotifs,FORK_FEN} from './fixtures/tactical-motif-fixtures.mjs';

test('complete saved reviews create sourced fork and pin patterns without starting an engine',async({page},info)=>{
  await seedTacticalMotifs(page);const workers=[],errors=[];page.on('worker',worker=>workers.push(worker));page.on('pageerror',error=>errors.push(error.message));
  await expect(page.locator('#homeGrowthList')).not.toContainText('Checking knight forks');
  await page.locator('#homeCheckWeaknesses').click();await expect(page.locator('#homeWeaknessStatus')).toContainText('7 eligible saved Stockfish reviews / 7 games checked');
  const fork=page.locator('.homeGrowthCard').filter({hasText:'Checking knight forks to practise'}),pin=page.locator('.homeGrowthCard').filter({hasText:'Absolute pins to practise'});
  await expect(fork).toContainText('3 supporting / 7 eligible games');await expect(pin).toContainText('3 supporting / 7 eligible games');
  await expect(page.locator('#weeklyCoachActions')).toContainText('Practise a checking knight fork');
  await fork.locator('summary').click();await expect(fork.locator('.homeMotifExplanation').first()).toContainText('knight on d6');await expect(fork).toContainText('Every legal reply');
  await expect(fork.locator('.homeMotifExplanation')).toHaveCount(1);
  await pin.locator('summary').click();await expect(pin.locator('.homeMotifExplanation').first()).toContainText('knight on e7');await expect(pin).toContainText('not a forced material win');
  await fork.locator('[data-evidence-position]').first().click();await expect(page.locator('#boardLabView')).toBeVisible();await expect(page.locator('#labBoard [data-square="c4"] .piece')).toHaveCount(1);
  await expect(page.locator('#labBoard [data-square="d6"] .piece')).toHaveCount(0);await page.goBack();await expect(page.locator('#homeView')).toBeVisible();
  expect(workers).toHaveLength(0);expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
  await fork.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('tactical-evidence.png'),animations:'disabled'});
});

test('an ineligible review cannot complete the three-game minimum and stale evidence clears on account change',async({page})=>{
  await seedTacticalMotifs(page,{invalidFork:true});await page.locator('#homeCheckWeaknesses').click();
  await expect(page.locator('#homeWeaknessStatus')).toContainText('6 eligible saved Stockfish reviews / 7 games checked');await expect(page.locator('#homeGrowthList')).not.toContainText('Checking knight forks to practise');
  await expect(page.locator('#homeGrowthList')).toContainText('Absolute pins to practise');
  await page.evaluate(()=>{localStorage.setItem('chess-username','stranger');window.dispatchEvent(new Event('chessImportFinished'))});
  await expect(page.locator('#homeGrowthList')).not.toContainText('Saved Stockfish evidence');await expect(page.locator('#homeMetrics strong').first()).toHaveText('0');
});

test('practice discovery requires complete engine metadata and positive loss before adding a named motif',async({page})=>{
  await seedTacticalMotifs(page,{partial:true});await page.locator('#homeFindTraining').click();await expect(page.locator('#homeFindTraining')).toBeEnabled();
  await expect(page.locator('#homeTrainingList')).not.toContainText('Checking knight fork');await expect(page.locator('#homeTrainingList')).toContainText('Absolute pin');
  await seedTacticalMotifs(page,{nonImproving:true});await page.locator('#homeFindTraining').click();await expect(page.locator('#homeFindTraining')).toBeEnabled();
  await expect(page.locator('#homeTrainingList')).not.toContainText('Checking knight fork');await expect(page.locator('#homeTrainingList')).toContainText('Absolute pin');
});

test('actual Stockfish fork exercise solves, explains its legal geometry and preserves assisted progress',async({page},info)=>{
  test.setTimeout(60000);const data=await seedTacticalMotifs(page,{realEngine:true});expect(data.bestMoves[0]).toBe('c4d6');expect(data.evals[0]).toBeGreaterThan(data.evals[1]);
  await page.locator('#weeklyCoachCheck').click();const exercise=page.locator('#weeklyCoachActions article').filter({hasText:'Practise a checking knight fork'});await expect(exercise).toHaveCount(1);await exercise.locator('[data-coach-go]').click();
  await expect(page.locator('#boardLabView')).toBeVisible({timeout:20000});await expect(page.locator('#labPracticeMotif')).toBeHidden();
  await page.locator('#labPracticeReveal').click();await expect(page.locator('#labPracticeMotif')).toBeVisible();await page.locator('#labPracticeMotif summary').click();await expect(page.locator('#labPracticeMotif p')).toContainText('queen on c8');
  await page.locator('#labPracticeRetry').click();await expect(page.locator('#labPracticeMotif')).toBeHidden();
  await page.locator('#labBoard [data-square="c4"]').click();await page.locator('#labBoard [data-square="d6"]').click();await expect(page.locator('#labSource')).toContainText('solved');
  await expect(page.locator('#labPracticeMotif')).toBeVisible();await page.locator('#labPracticeMotif summary').click();await expect(page.locator('#labPracticeMotif')).toContainText('not a forced game win');
  const record=await page.evaluate(id=>JSON.parse(localStorage.getItem('chess-personal-training:alpha'))[id],FORK_FEN+'|c4d6');expect(record.correct).toBe(1);expect(record.assisted).toBe(1);
  await page.locator('#labPracticeMotif').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('tactical-practice-lesson.png'),animations:'disabled'});
  await page.locator('#homeDashboardTab').click();await expect(page.locator('#labPracticeMotif')).toBeHidden();await expect(page.locator('#weeklyCoachActions')).toContainText('Previously solved with help');await page.reload();await expect(page.locator('#homeTrainingProgress')).toContainText('1 position solved');
});

test('cached motif checks work offline with reduced motion and source review navigation stays usable',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await seedTacticalMotifs(page);await page.locator('#homeCheckWeaknesses').click();
  await page.context().setOffline(true);await page.locator('#homeCheckWeaknesses').click();const fork=page.locator('.homeGrowthCard').filter({hasText:'Checking knight forks to practise'});await expect(fork).toContainText('3 supporting');
  await page.context().setOffline(false);await fork.locator('summary').click();
  await page.evaluate(()=>{const dismiss=()=>document.getElementById('reviewDepthCancel')?.click();new MutationObserver(dismiss).observe(document.body,{childList:true,subtree:true});dismiss()});
  await fork.locator('[data-evidence-game]').first().click();await expect(page.locator('#analysisView')).toBeVisible();await expect(page.locator('#gameTitle')).toContainText('motif-source-');
  await page.goBack();await expect(page.locator('#homeView')).toBeVisible();await expect(page.locator('.modernNav')).toBeVisible();
  const heights=await page.locator('#homeGrowthList summary,.homeEvidenceGame').evaluateAll(nodes=>nodes.filter(node=>node.getClientRects().length).map(node=>node.getBoundingClientRect().height));expect(heights.every(h=>h>=44)).toBe(true);
});
