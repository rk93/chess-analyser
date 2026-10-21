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
 await page.locator('#puzzleHighlightMoves').uncheck();
 await expect(page.locator('#puzzleBoard .puzzleLegalTarget')).toHaveCount(0);
 await page.screenshot({path:testInfo.outputPath('puzzle-settings.png'),fullPage:false});
 await page.locator('#puzzleSettingsClose').click();
 await expect(page.locator('#puzzleSettingsPanel')).toBeHidden();
});
