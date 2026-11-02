// Pure, local-data calculations shared by Home and player comparison.
const DRAWS = new Set(['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient', 'draw']);
const LOSSES = new Set(['checkmated', 'resigned', 'timeout', 'lose', 'abandoned']);
const DAY = 86400;

export function gameIdentity(game) {
  return String(game._key || game.url || `${game.end_time}-${game.white?.username}-${game.black?.username}`);
}

export function openingFromPgn(pgn) {
  const text = String(pgn || '');
  const named = text.match(/^\[Opening\s+"([^"]+)"\]/m)?.[1];
  if (named) return named;
  const slug = text.match(/^\[ECOUrl\s+"([^"]+)"\]/m)?.[1]?.split('/').pop();
  if (!slug) return '';
  try { return decodeURIComponent(slug).replace(/-\d.*$/, '').replace(/-/g, ' ').trim(); }
  catch { return ''; }
}

function timeClass(game) {
  if (['bullet', 'blitz', 'rapid', 'daily'].includes(game.time_class)) return game.time_class;
  const tc = String(game.time_control || '');
  if (tc.includes('/')) return 'daily';
  if (!/^\d+(?:\+\d+)?$/.test(tc)) return 'other';
  const [base, inc = 0] = tc.split('+').map(Number), seconds = base + 40 * inc;
  return seconds < 180 ? 'bullet' : seconds < 600 ? 'blitz' : 'rapid';
}

export function playerGames(games, username) {
  const user = String(username || '').trim().toLowerCase(), seen = new Set(), rows = [];
  if (!user) return rows;
  for (const game of games) {
    if (!game || (game.rules && game.rules !== 'chess')) continue;
    const white = String(game.white?.username || '').toLowerCase() === user;
    if (!white && String(game.black?.username || '').toLowerCase() !== user) continue;
    const key = gameIdentity(game);
    if (seen.has(key)) continue;
    seen.add(key);
    const me = white ? game.white : game.black, opponent = white ? game.black : game.white;
    const result = me?.result === 'win' ? 'W' : DRAWS.has(me?.result) ? 'D' : LOSSES.has(me?.result) ? 'L' : null;
    const end = Number(game.end_time), rating = me?.rating;
    rows.push({ key, game, white, result, end: Number.isFinite(end) && end > 0 ? end : null,
      opponent: opponent?.username || 'Opponent', pool: timeClass(game),
      rating: typeof rating === 'number' && Number.isFinite(rating) && rating > 0 ? rating : null,
      rated: game.rated === true, opening: openingFromPgn(game.pgn) });
  }
  return rows.sort((a, b) => (b.end || 0) - (a.end || 0) || a.key.localeCompare(b.key));
}

export function record(rows) {
  let wins = 0, draws = 0, losses = 0;
  for (const row of rows) {
    if (row.result === 'W') wins++;
    else if (row.result === 'D') draws++;
    else if (row.result === 'L') losses++;
  }
  const known = wins + draws + losses;
  return { games: rows.length, known, wins, draws, losses, unknown: rows.length - known,
    winRate: known ? 100 * wins / known : null, score: known ? 100 * (wins + draws / 2) / known : null };
}

function ratingTrend(rows, cutoff = null) {
  const points = rows.filter(row => row.rated && row.rating !== null && row.end !== null).slice().reverse();
  const last = points.at(-1);
  const first = cutoff === null ? points[0] : points.filter(row => row.end < cutoff).at(-1);
  // A weekly change needs an observation from before the week, not its first game.
  const delta = first && last && first !== last && (cutoff === null || last.end >= cutoff) ? last.rating - first.rating : null;
  return { points, latest: last?.rating ?? null, delta,
    best: points.length ? points.reduce((best, row) => Math.max(best, row.rating), 0) : null };
}

export function buildPlayerInsights(games, username, { now = Date.now() / 1000, pool = 'all' } = {}) {
  const all = playerGames(games, username), rows = all.filter(row => pool === 'all' || row.pool === pool);
  const totals = record(rows), white = record(rows.filter(row => row.white)), black = record(rows.filter(row => !row.white));
  const dated = rows.filter(row => row.end !== null && row.end <= now);
  const weekStart = now - 7 * DAY, previousStart = now - 14 * DAY;
  const weekRows = dated.filter(row => row.end >= weekStart);
  const previous = record(dated.filter(row => row.end >= previousStart && row.end < weekStart));
  const week = { ...record(weekRows), previous, start: weekStart, end: now };
  const pools = [...new Set(rows.map(row => row.pool))];
  const ratings = pools.map(name => ({ pool: name, ...ratingTrend(dated.filter(row => row.pool === name)),
    weeklyDelta: ratingTrend(dated.filter(row => row.pool === name), weekStart).delta }))
    .filter(item => item.latest !== null).sort((a, b) => b.points.at(-1).end - a.points.at(-1).end);
  const groups = new Map(), openingCounts = new Map();
  for (const row of rows) {
    if (!row.opening) continue;
    openingCounts.set(row.opening, (openingCounts.get(row.opening) || 0) + 1);
    if (!row.result) continue;
    const key = JSON.stringify([row.pool, row.white, row.opening]);
    if (!groups.has(key)) groups.set(key, { name: row.opening, pool: row.pool, white: row.white, rows: [] });
    groups.get(key).rows.push(row);
  }
  const openings = [...groups.values()].map(group => ({ ...group, ...record(group.rows) }))
    .sort((a, b) => b.known - a.known || a.name.localeCompare(b.name));
  const qualified = openings.filter(group => group.known >= 5);
  const strongest = qualified.slice().sort((a, b) => b.score - a.score || b.known - a.known)[0] || null;
  const weakest = qualified.slice().sort((a, b) => a.score - b.score || b.known - a.known)[0] || null;
  const commonOpening = [...openingCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] || null;
  const result = dated[0]?.result;
  let streak = 0;
  if (result === 'W' || result === 'L') for (const row of dated) { if (row.result !== result) break; streak++; }
  return { rows, totals, white, black, week, ratings, openings, strongest, weakest, commonOpening,
    streak: { result: streak ? result : null, count: streak } };
}
