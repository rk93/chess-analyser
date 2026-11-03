import {test,expect} from '@playwright/test';
import {auditFeedback,loadFeedbackPosition,boardMove,seedFeedbackReview} from './fixtures/feedback-fixtures.mjs';
const count=page=>page.evaluate(()=>feedbackAudit.starts.length);
test('new settings are opt-in, preserve legacy preferences and never allocate audio on page load',async({page},info)=>{
  await auditFeedback(page,{sound:null});await page.goto('/');
  await expect(page.locator('#homeView')).toBeVisible();expect(await page.evaluate(()=>feedbackAudit.contexts)).toBe(0);
  await page.locator('#settingsNav').click();await expect(page.locator('#soundMode')).toHaveValue('off');await expect(page.locator('#soundVolume')).toHaveValue('35');
  await expect(page.locator('#soundTheme')).toHaveValue('classic');await expect(page.locator('#hapticMode')).toBeChecked();await expect(page.locator('#uiSoundMode')).not.toBeChecked();
  await page.locator('#feedbackPreview').click();await expect(page.locator('#feedbackSettingsStatus')).toContainText('Enable chess sounds');expect(await count(page)).toBe(0);
  await page.locator('#soundMode').selectOption('on');await page.locator('#soundTheme').selectOption('soft');await page.locator('#soundVolume').fill('27');
  await page.locator('#hapticMode').uncheck();await page.locator('#feedbackPreview').click();await expect.poll(()=>count(page)).toBe(1);
  expect(await page.evaluate(()=>feedbackAudit.gains.at(-1))).toBeCloseTo(.14*.27);
  await page.reload();await page.locator('#settingsNav').click();await expect(page.locator('#soundMode')).toHaveValue('on');await expect(page.locator('#soundTheme')).toHaveValue('soft');await expect(page.locator('#soundVolume')).toHaveValue('27');await expect(page.locator('#hapticMode')).not.toBeChecked();expect(await count(page)).toBe(0);
  await page.locator('.feedbackSettings').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('feedback-settings-after.png'),fullPage:true,animations:'disabled'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
});
test('synthetic navigation and moves cannot unlock sound before a trusted interaction',async({page})=>{
  await auditFeedback(page);await page.goto('/');
  await page.evaluate(()=>{document.getElementById('boardLabTab').click();document.querySelector('#labBoard [data-square="e2"]').click();document.querySelector('#labBoard [data-square="e4"]').click()});
  expect(await count(page)).toBe(0);expect(await page.evaluate(()=>feedbackAudit.vibrations)).toEqual([]);
  await page.locator('#labFlip').click();await loadFeedbackPosition(page,'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');await boardMove(page,'e2','e4');await expect.poll(()=>count(page)).toBe(1);
});
test('legal moves reuse one real context, distinguish all board events and animate correctly after flipping',async({page},info)=>{
  await auditFeedback(page);await page.goto('/');await page.locator('#boardLabTab').click();
  await page.locator('#labBoard [data-square="e2"]').click();await expect(page.locator('#labBoard [data-square="e4"]')).toHaveClass(/feedbackLegalTarget/);
  expect(await page.evaluate(()=>feedbackAudit.contexts)).toBe(0);
  await page.locator('#labBoard [data-square="e4"]').click();await expect.poll(()=>count(page)).toBe(1);
  const scenarios=[['k7/8/8/8/8/8/4p3/4R1K1 w - - 0 1','e1','e2'],['4k3/8/8/8/8/8/8/3R2K1 w - - 0 1','d1','d8'],['r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1','e1','g1'],['7k/P7/8/8/8/8/8/7K w - - 0 1','a7','a8'],['7k/8/5KQ1/8/8/8/8/8 w - - 0 1','g6','g7']];
  for(const [index,[fen,from,to]]of scenarios.entries()){
    await page.locator('#labFlip').click();await loadFeedbackPosition(page,fen);await boardMove(page,from,to);await expect.poll(()=>count(page)).toBe(index+2);
  }
  expect(await page.evaluate(()=>new Set(feedbackAudit.starts.map(value=>value.signature)).size)).toBe(6);expect(await page.evaluate(()=>feedbackAudit.contexts)).toBe(1);
  const movements=await page.evaluate(()=>feedbackAudit.animations.filter(value=>value.frames[0].transform));expect(movements.length).toBeGreaterThanOrEqual(7);expect(movements.every(value=>value.options.duration<=150)).toBe(true);
  await page.locator('#labFlip').click();await page.screenshot({path:info.outputPath('feedback-board-after.png'),animations:'disabled'});
  expect(await page.evaluate(()=>feedbackAudit.errors)).toEqual([]);
});
test('muting or zero volume stops audio without changing moves or independent haptics',async({page})=>{
  await auditFeedback(page);await page.goto('/');await page.locator('#settingsNav').click();await page.locator('#feedbackPreview').click();await expect.poll(()=>count(page)).toBe(1);
  await page.locator('#soundMode').selectOption('off');await page.locator('#boardLabTab').click();await boardMove(page,'e2','e4');expect(await count(page)).toBe(1);await expect(page.locator('#labBoard [data-square="e4"] .piece')).toHaveCount(1);
  await page.locator('#settingsNav').click();await page.locator('#soundMode').selectOption('on');await page.locator('#soundVolume').fill('0');await page.locator('#feedbackPreview').click();expect(await count(page)).toBe(1);
  expect(await page.evaluate(()=>feedbackAudit.vibrations.some(value=>value===6))).toBe(true);
});
test('incorrect, solved and milestone puzzles produce one outcome and keep solved state idempotent',async({page})=>{
  await auditFeedback(page);await page.route('https://lichess.org/api/puzzle/batch/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({puzzles:Array.from({length:6},(_,i)=>({game:{pgn:'1. e4 e5 2. Nf3 Nc6'},puzzle:{id:'feedback-'+i,initialPly:2,solution:['g1f3'],rating:1100}}))})}));
  await page.goto('/');await page.locator('#puzzlesTab').click();await expect(page.locator('#puzzleStatus')).toContainText('Your move');
  await boardMove(page,'d2','d3','puzzleBoard');await expect.poll(()=>count(page)).toBe(1);await expect(page.locator('#puzzleStatus')).toContainText('Not quite');
  await page.locator('#puzzleReset').click();await boardMove(page,'g1','f3','puzzleBoard');await expect(page.locator('#puzzleSolvedOverlay')).toBeVisible();await expect.poll(()=>count(page)).toBe(2);
  await page.locator('#puzzleReset').click();expect(await count(page)).toBe(2);
  for(let i=0;i<4;i++){await page.locator('#puzzleNext').click();await expect(page.locator('#puzzleStatus')).toContainText('Your move');await boardMove(page,'g1','f3','puzzleBoard');await expect(page.locator('#puzzleSolvedOverlay')).toBeVisible();}
  await expect(page.locator('#puzzleSolvedOverlay')).toContainText('Tactics Explorer');expect(await count(page)).toBe(6);
  expect(await page.evaluate(()=>feedbackAudit.vibrations.filter(Array.isArray).length)).toBeGreaterThan(0);
});
test('training feedback is one correct or incorrect event, with legal movement preserved',async({page})=>{
  await auditFeedback(page);await page.goto('/');await page.locator('#boardLabTab').click();
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('practiceMistake',{detail:{fen:'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',bestMove:'e2e4',bestSan:'e4',side:'White',moveNumber:1,badMove:'e3',label:'Mistake'}})));
  await boardMove(page,'e2','e3');await expect(page.locator('#labSource')).toContainText('try again');await expect.poll(()=>count(page)).toBe(1);
  await page.locator('#labPracticeRetry').click();await boardMove(page,'e2','e4');await expect(page.locator('#labSource')).toContainText('solved');await expect.poll(()=>count(page)).toBe(2);
});
test('rapid autoplay is silent, relaxed autoplay can sound and navigation cancels its pending feedback',async({page})=>{
  await auditFeedback(page);await page.goto('/');await seedFeedbackReview(page);await page.locator('#gamesTab').click();await expect(page.locator('.gameWithAvatar')).toHaveCount(1);await page.locator('.gameWithAvatar').click();
  await expect(page.locator('#reviewAutoPlay')).toBeVisible();await page.evaluate(()=>{feedbackAudit.vibrations=[]});if(page.viewportSize().width>800)await page.locator('#reviewAutoPlay').click();await expect(page.locator('#reviewAutoPlay')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#reviewAutoPlay')).toHaveAttribute('aria-pressed','false',{timeout:10000});expect(await count(page)).toBe(0);
  expect(await page.evaluate(()=>feedbackAudit.vibrations)).toEqual([]);
  await page.locator('#reviewAutoPlay').click();await expect(page.locator('#reviewAutoPlay')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#reviewAutoPlay')).toHaveAttribute('aria-pressed','false',{timeout:10000});expect(await count(page)).toBe(0);
  await page.evaluate(()=>{localStorage.setItem('chess-review-autoplay-ms','1000');window.dispatchEvent(new Event('reviewAutoPlaySpeedChanged'))});
  const before=await count(page);await page.locator('#reviewAutoPlay').click();await expect(page.locator('#reviewPlaybackProgress')).toHaveText('1 / 6 moves');await expect.poll(()=>count(page),{timeout:5000}).toBeGreaterThan(before);
  await page.goBack();await expect(page.locator('#libraryView')).toBeVisible();const after=await count(page);await page.waitForTimeout(1100);expect(await count(page)).toBe(after);
});
test('fresh review completion deduplicates, cached and off-screen completions remain quiet',async({page})=>{
  await auditFeedback(page);await page.goto('/');await seedFeedbackReview(page);await page.locator('#gamesTab').click();await page.locator('.gameWithAvatar').click();await expect(page.locator('#board')).toBeVisible();
  await page.evaluate(()=>{for(let i=0;i<2;i++)window.dispatchEvent(new CustomEvent('gameReviewVerified',{detail:{key:'feedback-result',cached:false}}))});await expect.poll(()=>count(page)).toBe(1);
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('gameReviewVerified',{detail:{key:'cached-result',cached:true}})));expect(await count(page)).toBe(1);
  await page.goBack();await page.evaluate(()=>window.dispatchEvent(new CustomEvent('gameReviewVerified',{detail:{key:'late-result',cached:false}})));expect(await count(page)).toBe(1);
});
test('ordinary navigation stops a manual sound even when autoplay was never active',async({page})=>{
  await auditFeedback(page);await page.goto('/');await page.locator('#boardLabTab').click();
  const stopped=await page.evaluate(async()=>{
    const {playFeedback}=await import('/js/feedback.js');
    await playFeedback('capture',{context:'labBoard'});
    const before=feedbackAudit.stops;
    document.getElementById('gamesTab').click();
    return feedbackAudit.stops-before;
  });
  expect(stopped).toBe(1);await expect(page.locator('#libraryView')).toBeVisible();
  expect(await count(page)).toBe(1);await page.locator('#boardLabTab').click();await page.waitForTimeout(80);
  const settingsStopped=await page.evaluate(async()=>{
    const {playFeedback}=await import('/js/feedback.js');await playFeedback('capture',{context:'labBoard'});
    const before=feedbackAudit.stops;window.dispatchEvent(new Event('requestOpenSettingsPage'));return feedbackAudit.stops-before;
  });
  expect(settingsStopped).toBe(1);await expect(page.locator('#settingsView')).toBeVisible();
  expect(await count(page)).toBe(2);expect(await page.evaluate(()=>feedbackAudit.errors)).toEqual([]);
});
test('UI taps are separately opt-in across navigation while unsupported hardware stays safe',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));await auditFeedback(page,{unavailable:true});await page.goto('/');await page.locator('#settingsNav').click();await page.locator('#uiSoundMode').check();await page.locator('#feedbackPreview').click();await page.locator('#boardLabTab').click();await boardMove(page,'e2','e4');await expect(page.locator('#labBoard [data-square="e4"] .piece')).toHaveCount(1);expect(errors).toEqual([]);expect(await page.evaluate(()=>feedbackAudit.errors)).toEqual([]);
});
test('system and app reduced-motion preferences disable motion while keeping immediate selection and legal targets',async({page})=>{
  await auditFeedback(page,{sound:'off'});await page.goto('/');await page.locator('#settingsNav').click();await page.locator('#reducedAnimations').check();await expect(page.locator('html')).toHaveAttribute('data-reduced-animations','true');
  await page.locator('#boardLabTab').click();const before=await page.evaluate(()=>feedbackAudit.animations.length);await boardMove(page,'e2','e4');expect(await page.evaluate(()=>feedbackAudit.animations.length)).toBe(before);
  await page.locator('#labBoard [data-square="e7"]').click();await expect(page.locator('#labBoard [data-square="e5"]')).toHaveClass(/feedbackLegalTarget/);
  await page.locator('#settingsNav').click();await page.locator('#reducedAnimations').uncheck();await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('#reducedAnimations')).toBeChecked();await expect(page.locator('#reducedAnimations')).toBeDisabled();await expect(page.locator('html')).toHaveAttribute('data-reduced-animations','true');
});
test('optional UI taps work across routes and switching them off restores quiet navigation',async({page})=>{
  await auditFeedback(page);await page.goto('/');await page.locator('#settingsNav').click();expect(await count(page)).toBe(0);
  await page.locator('#uiSoundMode').check();await page.locator('#homeDashboardTab').click();await expect.poll(()=>count(page)).toBe(1);
  for(const [tab,view] of [['gamesTab','libraryView'],['analyticsTab','analyticsView'],['topPlayersTab','topPlayersView'],['settingsNav','settingsView']]){await page.locator('#'+tab).click();await expect(page.locator('#'+view)).toBeVisible();}
  await page.locator('#uiSoundMode').uncheck();const quiet=await count(page);await page.locator('#homeDashboardTab').click();await page.locator('#analyticsTab').click();expect(await count(page)).toBe(quiet);expect(await page.evaluate(()=>feedbackAudit.contexts)).toBe(1);
});
test('navigation cancels a pending puzzle reply and returning resumes it silently',async({page})=>{
  await auditFeedback(page);await page.route('https://lichess.org/api/puzzle/batch/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({puzzles:[{game:{pgn:'1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5'},puzzle:{id:'reply-test',initialPly:2,solution:['g1f3','b8c6','f1c4'],rating:1100}}]})}));
  await page.goto('/');await page.locator('#puzzlesTab').click();await expect(page.locator('#puzzleStatus')).toContainText('Your move');await boardMove(page,'g1','f3','puzzleBoard');await expect.poll(()=>count(page)).toBe(1);
  await page.locator('#homeDashboardTab').click();const before=await count(page);await page.waitForTimeout(400);expect(await count(page)).toBe(before);await expect(page.locator('#puzzleBoard [data-square="b8"] .piece')).toHaveCount(1);
  await page.locator('#puzzlesTab').click();await expect(page.locator('#puzzleBoard [data-square="c6"] .piece')).toHaveCount(1);expect(await count(page)).toBe(before);
  await boardMove(page,'f1','c4','puzzleBoard');await expect(page.locator('#puzzleSolvedOverlay')).toBeVisible();await expect.poll(()=>count(page)).toBe(before+1);
});
test('illegal attempts keep the position intact and haptics can be disabled independently',async({page},info)=>{
  await auditFeedback(page);await page.goto('/');await page.locator('#boardLabTab').click();await boardMove(page,'e2','e5');await expect.poll(()=>count(page)).toBe(1);
  await expect(page.locator('#labBoard [data-square="e2"] .piece')).toHaveCount(1);await expect(page.locator('#labBoard [data-square="e5"] .piece')).toHaveCount(0);await expect(page.locator('#labBoard .selected')).toHaveCount(0);
  expect(await page.evaluate(()=>feedbackAudit.vibrations.includes(7))).toBe(true);
  await page.locator('#settingsNav').click();await page.locator('#hapticMode').uncheck();const vibrationCount=await page.evaluate(()=>feedbackAudit.vibrations.length);await page.locator('#boardLabTab').click();await boardMove(page,'e2','e4');await expect.poll(()=>count(page)).toBe(2);expect(await page.evaluate(()=>feedbackAudit.vibrations.length)).toBe(vibrationCount);
  await page.evaluate(()=>{const animation=window.feedbackAnimations.findLast(animation=>animation.effect?.target?.closest('[data-square]')?.dataset.square==='e4');if(animation){animation.pause();animation.currentTime=60;}});
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:info.outputPath('piece-motion-midpoint.png')});
  await page.evaluate(()=>{for(const animation of window.feedbackAnimations)try{animation.finish()}catch{}});
});
