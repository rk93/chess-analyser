import { test, expect } from '@playwright/test';

async function openComparison(page) {
  await page.goto('/');
  await page.locator('#analyticsTab').click();
  await page.locator('#friendsAnalyticsTab').click();
  await expect(page.locator('#playerCompareForm')).toBeVisible();
}

test('public player comparison bounds requests, reuses cached archives and preserves the Games library', async ({ page }, testInfo) => {
  const requests = [];
  await page.route('https://api.chess.com/**', async route => {
    const url = route.request().url(); requests.push(url);
    const match = new URL(url).pathname.match(/\/player\/([^/]+)\/games\/(.+)$/), user = match[1], suffix = match[2];
    const body = suffix === 'archives' ? { archives: [7,8,9,10].map(month => `https://api.chess.com/pub/player/${user}/games/2026/${String(month).padStart(2,'0')}`) } : {
      games: [{ url: `${user}-${suffix}`, end_time: Math.floor(Date.now()/1000) - Number(suffix.slice(-2))*86400, rules: 'chess', rated: true, time_class: 'rapid', time_control: '600',
        white: { username: user, result: user === 'alpha' ? 'win' : 'resigned', rating: user === 'alpha' ? 1400 : 1200 }, black: { username: 'opponent', result: user === 'alpha' ? 'resigned' : 'win', rating: 1300 },
        pgn: '[Opening "Italian Game"]\n\n1. e4 e5 2. Nf3 Nc6' }],
    };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await openComparison(page);
  await page.locator('#comparePlayerA').fill('alpha');
  await page.locator('#comparePlayerB').fill('beta');
  await page.locator('#compareFetchPublic').check();
  await page.locator('#comparePlayers').click();
  const cards = page.locator('.playerCompareCard');
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toContainText('100%');
  await expect(cards.nth(1)).toContainText('0%');
  await expect(cards.first()).toContainText('3 public monthly archives');
  expect(requests).toHaveLength(8);
  expect(requests.some(url => url.includes('/2026/07'))).toBe(false);
  await page.locator('#comparePlayers').click();
  await expect(cards.first()).toContainText('cached within 24 hours');
  expect(requests).toHaveLength(8);
  const savedCount = await page.evaluate(async () => {
    const db = await new Promise(resolve => { const r = indexedDB.open('rk93-chess-analyser', 1); r.onsuccess = () => resolve(r.result); });
    const count = await new Promise(resolve => { const r = db.transaction('games','readonly').objectStore('games').count(); r.onsuccess = () => resolve(r.result); }); db.close(); return count;
  });
  expect(savedCount).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('player-comparison-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: testInfo.outputPath('player-comparison-desktop.png'), fullPage: true });
});

test('rate-limited comparisons show an error, preserve empty results and honor Retry-After', async ({ page }) => {
  let calls = 0;
  await page.route('https://api.chess.com/**', route => { calls++; return route.fulfill({ status: 429, headers: { 'Retry-After': '60' }, body: '{}' }); });
  await openComparison(page);
  await page.locator('#comparePlayerA').fill('alpha');
  await page.locator('#comparePlayerB').fill('beta');
  await page.locator('#compareFetchPublic').check();
  await page.locator('#comparePlayers').click();
  await expect(page.locator('#playerCompareStatus')).toContainText('rate limiting');
  await expect(page.locator('.playerCompareCard')).toHaveCount(0);
  await page.locator('#comparePlayers').click();
  await expect(page.locator('#playerCompareStatus')).toContainText('rate limit to reset');
  expect(calls).toBe(1);
});

test('saved-data comparison makes no API calls and reports missing players without invented scores', async ({ page }) => {
  let calls = 0;
  await page.route('https://api.chess.com/**', route => { calls++; return route.abort(); });
  await openComparison(page);
  await page.locator('#comparePlayerA').fill('alpha');
  await page.locator('#comparePlayerB').fill('beta');
  await page.locator('#comparePlayers').click();
  await expect(page.locator('.playerCompareCard')).toHaveCount(2);
  await expect(page.locator('.playerCompareCard').first()).toContainText('No standard-chess games');
  await expect(page.locator('.playerCompareCard').first()).not.toContainText('0%');
  expect(calls).toBe(0);
});
