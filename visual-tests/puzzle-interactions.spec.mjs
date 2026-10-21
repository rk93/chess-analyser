import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});

test('puzzle highlights legal targets and supports settings on mobile',async({page},testInfo)=>{
 await page.route('https://lichess.org/api/puzzle/batch/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({puzzles:[{game:{pgn:'1. e4 e5 2. Nf3 Nc6 3. Bb5 a6'},puzzle:{initialPly:2,solution:['g1f3'],rating:1100,plays:120,themes:['development']}}]})}));
 await page.goto('/');
 await page.locator('#puzzlesTab').click();
 await expect(page.locator('#puzzleTurn')).toHaveText(/White to move/);
 await expect(page.locator('#puzzleCoachAvatar')).toBeVisible();
 await expect(page.locator('#puzzleBoard .piece')).toHaveCount(32);
 await expect(page.locator('#puzzleStatus')).toContainText('Your move');
 const selectable=page.locator('#puzzleBoard [data-square="a2"]');
 await expect(selectable.locator('img.piece')).toBeVisible();
 await selectable.click();
 await expect(selectable).toHaveClass(/selected/);
 await expect(page.locator('#puzzleBoard .puzzleLegalTarget').first()).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('puzzle-selected.png'),fullPage:false});
 await page.locator('#puzzleSettingsToggle').click();
 await expect(page.locator('#puzzleSettingsPanel')).toBeVisible();
 await expect(page.locator('#puzzleDifficulty')).toBeVisible();
 await expect(page.locator('#puzzleTheme')).toBeVisible();
 await expect(page.locator('#puzzleRewardVoice')).not.toBeChecked();
 await expect(page.locator('#puzzleRewardEffects')).toBeChecked();
 await page.locator('#puzzleHighlightMoves').uncheck();
 await expect(page.locator('#puzzleBoard .puzzleLegalTarget')).toHaveCount(0);
 await page.screenshot({path:testInfo.outputPath('puzzle-settings.png'),fullPage:false});
 await page.locator('#puzzleSettingsClose').click();
 await expect(page.locator('#puzzleSettingsPanel')).toBeHidden();
 await expect(page.locator('#puzzlesView .puzzleToolbar')).toBeHidden();
 const before=await page.evaluate(()=>window.scrollY);
 await page.locator('#puzzleBoard [data-square="g1"]').click();
 await page.locator('#puzzleBoard [data-square="f3"]').click();
 await expect(page.locator('#puzzleSolvedOverlay')).toBeVisible();
 await expect(page.locator('#puzzleSolvedOverlay strong')).toHaveText('Puzzle solved!');
 await expect(page.locator('#puzzleSolvedOverlay strong')).toHaveCSS('font-weight','950');
 await expect(page.locator('.puzzleActions')).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('puzzle-solved.png'),fullPage:false});
 expect(await page.evaluate(()=>window.scrollY)).toBe(before);
});

test('five consecutive puzzle completions grant a single reward without scrolling',async({page},testInfo)=>{
 await page.route('https://lichess.org/api/puzzle/batch/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({puzzles:Array.from({length:12},(_,i)=>({game:{pgn:'1. e4 e5 2. Nf3 Nc6 3. Bb5 a6'},puzzle:{id:'milestone-'+i,initialPly:2,solution:['g1f3'],rating:1100,plays:120,themes:['development']}}))})}));
 await page.goto('/');
 await page.locator('#puzzlesTab').click();
 for(let i=0;i<5;i++){
  await expect(page.locator('#puzzleStatus')).toContainText('Your move');
  await page.locator('#puzzleBoard [data-square="g1"]').click();
  await page.locator('#puzzleBoard [data-square="f3"]').click();
  await expect(page.locator('#puzzleSolvedOverlay')).toBeVisible();
  if(i<4)await page.locator('#puzzleNext').click();
 }
 await expect(page.locator('#puzzleSolvedOverlay')).toContainText('Tactics Explorer');
 await expect(page.locator('#puzzleSolvedOverlay')).toContainText('5 consecutive');
 await expect(page.locator('#puzzleProgress')).toContainText('5');
 const y=await page.evaluate(()=>scrollY);
 await page.screenshot({path:testInfo.outputPath('puzzle-milestone-5.png'),fullPage:false});
 expect(await page.evaluate(()=>scrollY)).toBe(y);
 await page.locator('#puzzleNext').click();
 await expect(page.locator('#puzzleSolvedOverlay')).toBeHidden();
});
