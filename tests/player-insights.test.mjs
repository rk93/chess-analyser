import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlayerInsights, playerGames, openingFromPgn } from '../js/player-insights.js';

const NOW = 1800000000, DAY = 86400;
function game(id, options = {}) {
  const { white = true, user = 'Alice', result = 'win', rating = 1400, pool = 'rapid', end = NOW - DAY, ...extra } = options;
  const me = { username: user, result, rating }, them = { username: `opponent-${id}`, result: result === 'win' ? 'resigned' : 'win', rating: 1450 };
  return { _key: String(id), end_time: end, time_class: pool, rated: true, rules: 'chess',
    white: white ? me : them, black: white ? them : me, pgn: '[Opening "Italian Game"]\n\n1. e4 e5 2. Nf3 Nc6', ...extra };
}

test('personal statistics filter account and variant, deduplicate and do not mutate input', () => {
  const own = game(1), games = [game(2, { user: 'someone' }), own, own, game(3, { rules: 'chess960' }), game(4, { white: false })];
  const before = structuredClone(games), rows = playerGames(games, ' ALICE ');
  assert.deepEqual(rows.map(row => row.key), ['1', '4']);
  assert.equal(rows[1].white, false);
  assert.deepEqual(games, before);
  assert.deepEqual(playerGames(games, ''), []);
});

test('unknown results are excluded from percentages and all documented draw reasons remain draws', () => {
  const games = ['win', 'resigned', 'timevsinsufficient', 'abandoned', 'new-result'].map((result, i) => game(i, { result }));
  const { totals } = buildPlayerInsights(games, 'alice', { now: NOW });
  assert.equal(totals.games, 5);
  assert.equal(totals.known, 4);
  assert.equal(totals.unknown, 1);
  assert.equal(totals.winRate, 25);
  assert.equal(totals.score, 37.5);
});

test('ratings never mix pools or casual games and weekly deltas require a prior observation', () => {
  const games = [game(1, { rating: 1300, end: NOW - 8 * DAY }), game(2, { rating: 1320 }),
    game(3, { pool: 'blitz', rating: 800 }), game(4, { rating: 2500, rated: false, end: NOW }),
    game(5, { rating: 2600, end: NOW + DAY })];
  const { ratings } = buildPlayerInsights(games, 'alice', { now: NOW });
  const rapid = ratings.find(row => row.pool === 'rapid'), blitz = ratings.find(row => row.pool === 'blitz');
  assert.equal(rapid.latest, 1320);
  assert.equal(rapid.delta, 20);
  assert.equal(rapid.weeklyDelta, 20);
  assert.equal(rapid.best, 1320);
  assert.equal(blitz.delta, null);
  assert.equal(blitz.weeklyDelta, null);
});

test('weekly windows are disjoint with inclusive current-week boundary; missing dates cannot form streaks', () => {
  const games = [game(1, { end: NOW - 7 * DAY }), game(2, { end: NOW - 14 * DAY }),
    game(3, { end: NOW - 7 * DAY - 1 }), game(4, { end: NOW + 1 }), game(5, { end: null })];
  const data = buildPlayerInsights(games, 'alice', { now: NOW });
  assert.equal(data.week.games, 1);
  assert.equal(data.week.previous.games, 2);
  assert.equal(data.streak.count, 3);
});

test('draws and unknown results break streaks, and pool filters apply before streaks', () => {
  const games = [game(1, { end: NOW }), game(2, { end: NOW - 1, result: 'draw', pool: 'blitz' }), game(3, { end: NOW - 2 })];
  assert.equal(buildPlayerInsights(games, 'alice', { now: NOW }).streak.count, 1);
  assert.equal(buildPlayerInsights(games, 'alice', { now: NOW, pool: 'rapid' }).streak.count, 2);
});

test('opening recommendations require five games per colour and time-control group', () => {
  const games = Array.from({ length: 4 }, (_, i) => game(i));
  games.push(game('black', { white: false }), game('blitz', { pool: 'blitz' }));
  assert.equal(buildPlayerInsights(games, 'alice', { now: NOW }).strongest, null);
  games.push(game(5, { result: 'agreed' }));
  const stats = buildPlayerInsights(games, 'alice', { now: NOW });
  assert.equal(stats.strongest.known, 5);
  assert.equal(stats.strongest.white, true);
  assert.equal(stats.strongest.pool, 'rapid');
  assert.equal(stats.strongest.score, 90);
});

test('opening parsing tolerates malformed encoding, absent names and ECO URLs', () => {
  assert.equal(openingFromPgn('[ECOUrl "https://www.chess.com/openings/Sicilian-Defense-2.Nf3"]'), 'Sicilian Defense');
  assert.equal(openingFromPgn('[ECOUrl "https://www.chess.com/openings/%ZZ"]'), '');
  assert.equal(openingFromPgn(''), '');
});

test('empty accounts have no invented scores, ratings or opening recommendations', () => {
  const stats = buildPlayerInsights([game(1)], 'other-user', { now: NOW });
  assert.equal(stats.totals.winRate, null);
  assert.deepEqual(stats.ratings, []);
  assert.equal(stats.weakest, null);
  assert.equal(stats.streak.count, 0);
});
