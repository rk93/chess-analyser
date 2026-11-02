import { test, expect } from '@playwright/test';

async function seed(page) {
  await page.route('https://api.chess.com/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"archives":[]}' }));
  await page.goto('/');
  await page.evaluate(async () => {
    const user = 'insight-player', now = Math.floor(Date.now() / 1000);
    localStorage.setItem('chess-username', user);
    localStorage.setItem(`chess-sync-meta:${user}`, JSON.stringify({ archives: [], lastSync: Date.now() }));
    const games = [];
    for (let i = 0; i < 16; i++) {
      const white = i < 8 || i >= 14, pool = i >= 14 ? 'blitz' : 'rapid';
      const me = { username: user, rating: pool === 'rapid' ? 1400 + i : 800 + i, result: i < 5 ? 'resigned' : 'win' };
      const opponent = { username: `Opponent-${i}`, rating: 1430, result: i < 5 ? 'win' : 'resigned' };
      games.push({ _key: `personal-${i}`, url: `personal-${i}`, white: white ? me : opponent, black: white ? opponent : me,
        end_time: now - 3600 - i * 3600, rated: true, rules: 'chess', time_class: pool, time_control: pool === 'rapid' ? '600' : '180',
        pgn: `[Opening "${white ? 'Italian Game' : 'Caro-Kann Defense'}"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 1-0` });
    }
    games.push({ ...games[0], _key: 'foreign', white: { username: 'unrelated', rating: 3000, result: 'win' }, black: { username: 'stranger', rating: 3000, result: 'resigned' }, end_time: now });
    games.push({ ...games[0], _key: 'variant', rules: 'chess960', end_time: now });
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('rk93-chess-analyser', 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    await new Promise((resolve, reject) => { const tx = db.transaction('games', 'readwrite'); for (const game of games) tx.objectStore('games').put(game); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
    db.close();
  });
  await page.reload();
  await expect(page.locator('#homeMetrics')).toContainText('16');
}

test('personal Home shows truthful weekly, colour, opening and separate rating-pool insights', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await seed(page);
  await expect(page.locator('#homeWeekSummary')).toContainText('16 games · 11W / 0D / 5L');
  await expect(page.locator('#homeRecentScroller')).not.toContainText('stranger');
  await expect(page.locator('#homeRatingTrends')).toContainText('Rapid · 1400');
  await expect(page.locator('#homeRatingTrends')).toContainText('Blitz · 814');
  await expect(page.locator('#homeOpeningInsights')).toContainText('Caro-Kann Defense');
  await expect(page.locator('#homeOpeningInsights')).toContainText('White · Rapid · 8 games · 38% score');
  await expect(page.locator('#homeInsightText')).toContainText('Italian Game');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('personal-home-mobile.png'), fullPage: true });
  await page.locator('#homeTimeClass').selectOption('blitz');
  await expect(page.locator('#homeDnaScope')).toContainText('2 saved standard-chess games · Blitz');
  await expect(page.locator('#homeOpeningInsights')).toContainText('at least five');
  await expect(page.locator('#homeRatingTrends')).not.toContainText('Rapid');
  expect(errors).toEqual([]);
});

test('Home opens the correct saved game even when Games filters hide it, and Back returns Home', async ({ page }) => {
  await seed(page);
  await page.locator('#gamesTab').click();
  await page.locator('#gameSpeedFilter').selectOption('blitz');
  await page.locator('#homeDashboardTab').click();
  await page.evaluate(() => {
    const dismiss = () => document.getElementById('reviewDepthCancel')?.click();
    new MutationObserver(dismiss).observe(document.body, { childList: true, subtree: true }); dismiss();
  });
  await page.locator('#homeRecentScroller .homeRecentCard').nth(2).click();
  await expect(page.locator('#analysisView')).toBeVisible();
  await expect(page.locator('#gameTitle')).toContainText('Opponent-2');
  await expect(page.locator('#homeView')).toBeHidden();
  await page.goBack();
  await expect(page.locator('#homeView')).toBeVisible();
  await expect(page.locator('.modernNav')).toBeVisible();
});

test('account switching and import events refresh Home without leaking previous player data', async ({ page }) => {
  await seed(page);
  await page.evaluate(() => { localStorage.setItem('chess-username', 'no-saved-games'); window.dispatchEvent(new Event('chessImportFinished')); });
  await expect(page.locator('#homeMetrics strong').first()).toHaveText('0');
  await expect(page.locator('#homeRecentScroller .homeRecentCard')).toHaveCount(0);
  await expect(page.locator('#homeRatingTrends')).not.toContainText('1400');
  await expect(page.locator('#homeOpeningInsights')).not.toContainText('Caro-Kann');
  await page.evaluate(() => { localStorage.setItem('chess-username', 'insight-player'); window.dispatchEvent(new Event('chessGamesImported')); });
  await expect(page.locator('#homeMetrics strong').first()).toHaveText('16');
});

test('personal dashboard is readable on desktop with no horizontal overflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await seed(page);
  await expect(page.locator('#homeDnaTitle')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('personal-home-desktop.png'), fullPage: true });
});

test('personal training checks a saved solution with real Stockfish and persists player-specific attempts', async ({ page }, testInfo) => {
  await seed(page);
  const best = await page.evaluate(async () => {
    const { Chess } = await import('https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm');
    const { getLocalStockfish } = await import('/js/local-stockfish.js');
    const { cacheSet, simpleHash } = await import('/js/analysis-store.js');
    const pgn = '1. f3 e5 2. g4 Qh4#', board = new Chess(); board.loadPgn(pgn);
    const moves = board.history({ verbose: true });
    const result = await getLocalStockfish().analyse(moves[2].before, { depth: 12, multipv: 1, clearHash: true });
    const game = { _key: 'training-fools-mate', url: 'training-fools-mate', pgn, end_time: Math.floor(Date.now()/1000), rated: true, rules: 'chess', time_class: 'rapid', time_control: '600',
      white: { username: 'insight-player', rating: 1400, result: 'checkmated' }, black: { username: 'training-opponent', rating: 1430, result: 'win' } };
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('rk93-chess-analyser', 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    await new Promise((resolve, reject) => { const tx = db.transaction('games', 'readwrite'); tx.objectStore('games').put(game); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); db.close();
    const key = simpleHash('insight-player 1400 — training-opponent 1430|' + moves.map(move => move.san).join(' '));
    // Only the known g4 blunder is marked as trainable in this saved-review fixture.
    await cacheSet('review', key, { verifiedReviewVersion: 1, labels: ['Good','Good','Blunder','Best'], evals: [0,0,result.cp,-100000,-100000],
      bestMoves: ['', '', result.best, 'd8h4', ''], positionExact: [true,true,true,true,true], moveVerified: [true,true,true,true], localDepths: [12,12,result.depth,12,99] });
    window.dispatchEvent(new Event('chessImportFinished'));
    return result.best;
  });
  await expect(page.locator('#homeMetrics strong').first()).toHaveText('17');
  await page.locator('#homeFindTraining').click();
  await expect(page.locator('#homeTrainingList .homePracticeCard')).toHaveCount(1);
  await expect(page.locator('#homeTrainingStatus')).toContainText('1 distinct verified practice position');
  await page.locator('#homeTrainingList').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('personal-training-library.png'), fullPage: false });
  await page.locator('.homePracticeCard').click();
  await expect(page.locator('#boardLabView')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('#labLine')).toContainText('Find a better move');
  // A review finishing in the background refreshes the library, but must not
  // discard progress for the exercise the player is currently practising.
  await page.evaluate(() => window.dispatchEvent(new Event('gameReviewUpdated')));
  await page.locator('#labBoard [data-square="g2"]').click();
  await page.locator('#labBoard [data-square="g4"]').click();
  await expect(page.locator('#labSource')).toContainText('try again');
  await page.locator('#labPracticeRetry').click();
  await page.locator(`#labBoard [data-square="${best.slice(0,2)}"]`).click();
  await page.locator(`#labBoard [data-square="${best.slice(2,4)}"]`).click();
  await expect(page.locator('#labSource')).toContainText('solved');
  await page.locator('#homeDashboardTab').click();
  await expect(page.locator('#homeTrainingProgress')).toContainText('1 position solved · 2 attempts');
  await page.reload();
  await expect(page.locator('#homeTrainingProgress')).toContainText('1 position solved · 2 attempts');
  await page.evaluate(() => { localStorage.setItem('chess-username', 'other-player'); window.dispatchEvent(new Event('chessImportFinished')); });
  await expect(page.locator('#homeTrainingProgress')).not.toContainText('2 attempts');
});

test('unreviewed games cannot create personal training exercises', async ({ page }) => {
  await seed(page);
  await page.locator('#homeFindTraining').click();
  await expect(page.locator('#homeTrainingStatus')).toContainText('0 distinct verified practice positions');
  await expect(page.locator('#homeTrainingList .homePracticeCard')).toHaveCount(0);
  await expect(page.locator('#homeTrainingStatus')).toContainText('Run a complete Game Review');
});
