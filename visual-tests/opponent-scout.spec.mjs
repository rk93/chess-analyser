import { test, expect } from '@playwright/test';
import { comparisonGames, mockPublicPlayers, seedComparison } from './fixtures/comparison-fixtures.mjs';

async function selectOpponent(page, user = 'beta') {
  await page.locator('#comparePlayerSearch').fill(user);
  await page.locator('#comparePlayerSearch').press('Enter');
  await expect(page.locator('#playerProfileCards [data-player="'+user+'"]')).toBeVisible();
}
async function openScout(page) {
  await page.locator('[data-study-mode="scout"]').click();
  await expect(page.locator('.pcScoutPlan')).toBeVisible();
}
test('Scout produces three evidenced actions, repeated legal lines and honest sample limits without network or engines', async ({page}, info) => {
  const requests = [], workers = []; page.on('worker', worker => workers.push(worker));
  await mockPublicPlayers(page, requests); await seedComparison(page); await selectOpponent(page);
  const before = requests.length;
  await openScout(page);
  await expect(page.locator('[data-pool="rapid"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.pcScoutAction')).toHaveCount(3);
  await expect(page.locator('.pcScoutAction').first()).toContainText('5 of 5 sampled White games');
  await expect(page.locator('.pcScoutLine')).toHaveCount(2);
  await expect(page.locator('#opponentScoutPanel')).toContainText('10 of 10 games supplied six legal opening plies');
  await expect(page.locator('#opponentScoutPanel')).toContainText('Not enough reliable timestamps');
  await expect(page.locator('#opponentScoutPanel')).toContainText('Two larger samples needed');
  await expect(page.locator('#opponentScoutPanel')).toContainText('no engine analysis has been performed');
  expect(requests.length).toBe(before); expect(workers).toHaveLength(0);
  await page.locator('.pcScoutHero').scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('opponent-scout-after.png'),fullPage:true,animations:'disabled'});
});
test('Scout replay uses the existing board with exactly the six supported opening plies and reliable navigation', async ({page}) => {
  const workers = []; page.on('worker', worker => workers.push(worker));
  await mockPublicPlayers(page); await seedComparison(page); await selectOpponent(page); await openScout(page);
  await page.locator('.pcScoutLine [data-scout-replay]').first().click();
  await expect(page.locator('#boardLabView')).toBeVisible();
  const initial = await page.locator('#labBoard').innerHTML();
  for (let i = 0; i < 6; i++) await page.locator('#labForward').click();
  await expect(page.locator('#labForward')).toBeDisabled();
  expect(await page.locator('#labBoard').innerHTML()).not.toBe(initial);
  await page.goBack(); await expect(page.locator('#opponentScoutPanel')).toBeVisible();
  await page.locator('[data-study-mode="compare"]').click();
  await expect(page.locator('#comparisonFormats [data-format="rapid"]')).toBeVisible();
  await page.locator('#homeDashboardTab').click(); await expect(page.locator('#homeView')).toBeVisible();
  expect(workers).toHaveLength(0);
});
test('no saved games and lifetime-only statistics offer usable alternatives without invented insights', async ({page}) => {
  await mockPublicPlayers(page); await seedComparison(page); await selectOpponent(page, 'new-player'); await openScout(page);
  await expect(page.locator('.pcScoutHero')).toContainText('0 rapid games');
  await expect(page.locator('.pcScoutAction')).toHaveCount(3);
  await expect(page.locator('.pcScoutAction').first()).toContainText('Insufficient evidence');
  await expect(page.locator('#opponentScoutPanel')).toContainText('No repeated legal sequence');
  await page.locator('[data-source="lifetime"]').click();
  await expect(page.locator('#opponentScoutPanel')).toContainText('Scout needs completed games');
  await expect(page.locator('#playerCompareStatus')).toHaveText('Public data loaded.');
  await page.locator('[data-source="local"]').click(); await expect(page.locator('.pcScoutPlan')).toBeVisible();
  await page.locator('[data-pool="all"]').click();
  await expect(page.locator('#opponentScoutPanel')).toContainText('Choose one time control');
});
test('cache-first load survives an offline session and explicit refresh is a separate action', async ({page, context}) => {
  const requests = []; await mockPublicPlayers(context, requests); await seedComparison(page); await selectOpponent(page);
  await page.locator('#loadPublicPlayers').click();
  await expect(page.locator('#playerCompareStatus')).toHaveText('Public data loaded.');
  await expect(page.locator('#loadPublicPlayers')).toHaveText('Refresh public data');
  const beforeRefresh = requests.length;
  await page.locator('#loadPublicPlayers').click();
  await expect(page.locator('#playerCompareStatus')).toHaveText('Public data loaded.');
  expect(requests.length).toBeGreaterThan(beforeRefresh);
  // Re-open online so the existing external chess library can load, then go offline.
  await page.reload(); await page.locator('#analyticsTab').click(); await page.locator('#friendsAnalyticsTab').click();
  await selectOpponent(page); await expect(page.locator('#loadPublicPlayers')).toHaveText('Load public data');
  const before = requests.length;
  await context.setOffline(true); await page.locator('#loadPublicPlayers').click();
  await expect(page.locator('#playerCompareStatus')).toHaveText('Public data loaded.');
  await expect(page.locator('#comparisonScope')).toContainText('3 public monthly archives');
  expect(requests.length).toBe(before);
  await openScout(page); await expect(page.locator('.pcScoutHero')).toContainText('Scout beta');
});
test.describe('lazy study cancellation', () => {
// Keep module timing under test control; other cases exercise the real SW.
test.use({serviceWorkers:'block'});
test('cancelled lazy study cannot publish results after an account change and can be retried', async ({page}) => {
  await mockPublicPlayers(page); await seedComparison(page); await selectOpponent(page);
  let release; const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/js/opponent-scout.js', async route => { await gate; await route.continue().catch(()=>{}); });
  await page.locator('[data-study-mode="scout"]').click();
  await expect(page.locator('[data-scout-cancel]')).toBeVisible(); await page.locator('[data-scout-cancel]').click();
  await expect(page.locator('#opponentScoutPanel')).toContainText('Study paused');
  release();
  await page.locator('[data-scout-retry]').click(); await expect(page.locator('.pcScoutPlan')).toBeVisible();
  await page.evaluate(() => { localStorage.setItem('chess-username','other-account'); window.dispatchEvent(new Event('chessImportFinished')); });
  await expect(page.locator('[data-player="other-account"]')).toBeVisible();
  await expect(page.locator('#playerStudyResults')).toBeHidden(); await expect(page.locator('.pcScoutHero')).toHaveCount(0);
  await expect(page.locator('[data-study-mode="scout"]')).toBeDisabled();
});
test('leaving a pending study pauses it and late imports cannot reveal the previous account', async ({page}) => {
  await mockPublicPlayers(page); await seedComparison(page); await selectOpponent(page);
  let release; const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/js/opponent-scout.js', async route => { await gate; await route.continue().catch(()=>{}); });
  await page.locator('[data-study-mode="scout"]').click(); await expect(page.locator('[data-scout-cancel]')).toBeVisible();
  await page.locator('#homeDashboardTab').click(); await page.locator('#analyticsTab').click();
  await expect(page.locator('#opponentScoutPanel')).toContainText('Study paused');
  await page.evaluate(() => { localStorage.setItem('chess-username','new-account'); window.dispatchEvent(new Event('chessImportFinished')); });
  await expect(page.locator('[data-player="new-account"]')).toBeVisible();
  const loaded = page.waitForResponse(response => response.url().endsWith('/js/opponent-scout.js'));
  release(); await loaded;
  await expect(page.locator('#opponentScoutPanel')).toBeEmpty();
  await expect(page.locator('#playerStudyResults')).toBeHidden();
});
});
test('illegal PGNs and nonstandard starting positions cannot supply legal opening lines', async ({page}) => {
  await mockPublicPlayers(page); await seedComparison(page);
  const games = comparisonGames('alpha', 'beta', 40).map((game, i) => ({...game,pgn:Math.floor(i / 4) % 2
    ? '[Opening "Unverified label"]\n[SetUp "1"]\n[FEN "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"]\n\n1... e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d3'
    : '[Opening "Unverified label"]\n\n1. e4 e5 2. Qh9'}));
  await page.evaluate(async games => {
    const {Chess} = await import('https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm');
    const board = new Chess(); board.loadPgn(games.find(game=>game.pgn.includes('[SetUp')).pgn);
    if (board.history().length !== 6) throw new Error('The custom-start fixture must contain six legal plies');
    const db = await new Promise(resolve=>{const r=indexedDB.open('rk93-chess-analyser',1);r.onsuccess=()=>resolve(r.result)});
    await new Promise(resolve=>{const tx=db.transaction('games','readwrite');for(const game of games)tx.objectStore('games').put(game);tx.oncomplete=resolve});db.close();
    window.dispatchEvent(new Event('chessGamesImported'));
  },games);
  await selectOpponent(page); await openScout(page);
  await expect(page.locator('.pcScoutLine')).toHaveCount(0);
  await expect(page.locator('#opponentScoutPanel')).toContainText('0 of 10 games supplied six legal opening plies');
});
test('Scout controls remain touch friendly with no overflow at each viewport and reduced motion', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'}); await mockPublicPlayers(page); await seedComparison(page); await selectOpponent(page); await openScout(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
  const heights = await page.locator('.pcStudyModes button:visible,[data-scout-replay]:visible').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().height));
  expect(heights.every(height=>height>=44)).toBe(true);
  await page.locator('#comparisonPeriod').selectOption('30'); await expect(page.locator('.pcScoutPlan')).toBeVisible();
  await page.locator('[data-pool="daily"]').click(); await expect(page.locator('.pcScoutHero')).toContainText('10 daily games');
  await expect(page.locator('#opponentScoutPanel')).toContainText('includes time away from the board');
});
test('real PGN parsing is capped at 200 games, yields progress and stops at cancellation', async ({page}) => {
  await mockPublicPlayers(page); await seedComparison(page);
  const result = await page.evaluate(async games => {
    const {selectSample} = await import('./js/comparison-intelligence.js');
    const {analyseOpponentScout} = await import('./js/opponent-scout.js');
    const rows = selectSample(games, 'alpha', {days:'all'}), progress = [];
    const model = await analyseOpponentScout(rows, {pool:'rapid',onProgress:(done,total)=>progress.push([done,total])});
    const controller = new AbortController(); let cancelledAt = null, errorName;
    try { await analyseOpponentScout(rows, {pool:'rapid',signal:controller.signal,onProgress:done=>{cancelledAt=done;controller.abort()}}); }
    catch(error) { errorName = error.name; }
    return {assessed:model.assessed,available:model.available,parsed:model.parsed,progress,cancelledAt,errorName};
  },comparisonGames('alpha','beta',840));
  expect(result.assessed).toBe(200); expect(result.available).toBe(210); expect(result.parsed).toBe(200);
  expect(result.progress.at(-1)).toEqual([200,200]); expect(result.progress).toHaveLength(20);
  expect(result.cancelledAt).toBe(10); expect(result.errorName).toBe('AbortError');
});
