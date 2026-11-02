import { playerGames, record } from './player-insights.js';

export const COMPARISON_POOLS = ['bullet', 'blitz', 'rapid', 'daily'];
const DAY = 86400;
export function publicFormatStats(stats, pool) {
  const value = stats?.[`chess_${pool}`], result = value?.record;
  const validCount = count => Number.isSafeInteger(count) && count >= 0;
  const known = result && ['win', 'draw', 'loss'].every(key => validCount(result[key]));
  const games = known ? result.win + result.draw + result.loss : null;
  const rating = Number.isFinite(value?.last?.rating) && value.last.rating > 0 ? value.last.rating : null;
  return { pool, games, wins: known ? result.win : null, draws: known ? result.draw : null, losses: known ? result.loss : null,
    winRate: games ? result.win * 100 / games : null, score: games ? (result.win + result.draw / 2) * 100 / games : null,
    rating, ratingDate: Number.isFinite(value?.last?.date) ? value.last.date : null };
}

export function selectSample(games, user, { days = 60, now = Date.now() / 1000 } = {}) {
  return playerGames(games, user).filter(row => days === 'all' ? row.end === null || row.end <= now : row.end !== null && row.end >= now - Number(days) * DAY && row.end <= now);
}

export function formatSummary(rows, pool) {
  const selected = rows.filter(row => row.pool === pool), results = record(selected);
  const rated = selected.filter(row => row.rated && row.rating !== null && row.end !== null).slice().reverse();
  return { ...results, pool, rating: rated.at(-1)?.rating ?? null, points: rated,
    delta: rated.length > 1 ? rated.at(-1).rating - rated[0].rating : null,
    white: record(selected.filter(row => row.white)), black: record(selected.filter(row => !row.white)),
    recent: selected.filter(row => row.result && row.end !== null).slice(0, 8).map(row => row.result) };
}

export function openingGroups(rows, pool = 'all') {
  const groups = new Map();
  for (const row of rows) {
    if (!row.opening || (pool !== 'all' && row.pool !== pool)) continue;
    const key = JSON.stringify([row.opening, row.white, row.pool]);
    if (!groups.has(key)) groups.set(key, { key, name: row.opening, white: row.white, pool: row.pool, rows: [] });
    groups.get(key).rows.push(row);
  }
  return [...groups.values()].map(group => {
    const results = record(group.rows), strength = { higher: [], lower: [], similar: [] };
    for (const row of group.rows) {
      const rating = row.game[row.white ? 'black' : 'white']?.rating;
      if (!Number.isFinite(rating) || row.rating === null) continue;
      const diff = rating - row.rating;
      strength[diff > 50 ? 'higher' : diff < -50 ? 'lower' : 'similar'].push(row);
    }
    return { ...group, ...results, eligible: results.known >= 5,
      strength: Object.fromEntries(Object.entries(strength).map(([band, games]) => [band, record(games)])) };
  }).sort((a, b) => b.games - a.games || a.name.localeCompare(b.name));
}

export function headToHead(firstRows, secondRows, first, second, pool = 'all') {
  const seen = new Set(), games = [];
  for (const row of [...firstRows, ...secondRows]) {
    const game = row.game, white = String(game.white?.username || '').toLowerCase(), black = String(game.black?.username || '').toLowerCase();
    if (!((white === first && black === second) || (white === second && black === first))) continue;
    const key = String(game.url || game._key || `${row.end}-${white}-${black}`);
    if (seen.has(key)) continue;
    seen.add(key); games.push(game);
  }
  const rows = playerGames(games, first).filter(row => pool === 'all' || row.pool === pool);
  return { ...record(rows), rows, white: record(rows.filter(row => row.white)), black: record(rows.filter(row => !row.white)) };
}
