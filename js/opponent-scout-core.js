import { openingGroups } from './comparison-intelligence.js';
import { record } from './player-insights.js';

export const SCOUT_GAME_LIMIT = 200;
const DAY = 86400;
function tags(pgn) {
  const out = {};
  for (const match of String(pgn || '').matchAll(/^\[([A-Za-z]+)\s+"([^"\r\n]*)"\]/gm)) out[match[1]] = match[2];
  return out;
}
function utcStamp(date, time) {
  const d = String(date || '').match(/^(\d{4})\.(\d{2})\.(\d{2})$/), t = String(time || '').match(/^(\d{2}):(\d{2}):(\d{2})$/);
  if (!d || !t) return null;
  const parts = [...d.slice(1), ...t.slice(1)].map(Number);
  if (parts[0] < 1970 || parts[1] < 1 || parts[1] > 12 || parts[2] < 1 || parts[2] > 31 || parts[3] > 23 || parts[4] > 59 || parts[5] > 59) return null;
  const stamp = Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]), parsed = new Date(stamp);
  if (parsed.getUTCFullYear() !== parts[0] || parsed.getUTCMonth() !== parts[1] - 1 || parsed.getUTCDate() !== parts[2]) return null;
  return stamp / 1000;
}

export function reliableGameDuration(game) {
  const values = tags(game.pgn), explicitUTC = values.Timezone?.toUpperCase() === 'UTC';
  const start = values.UTCDate && values.UTCTime ? utcStamp(values.UTCDate, values.UTCTime)
    : explicitUTC ? utcStamp(values.StartDate || values.Date, values.StartTime) : null;
  const end = Number(game.end_time);
  if (start === null || !Number.isFinite(end) || end <= start || end - start > 366 * 2 * DAY) return null;
  return end - start;
}

function median(values) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function cohortEvidence(rows) {
  const dates = rows.map(row => row.end).filter(Number.isFinite);
  return { games: rows.length, known: record(rows).known,
    start: dates.length ? Math.min(...dates) : null, end: dates.length ? Math.max(...dates) : null };
}

// Parsed lines are supplied by the lazy browser layer. No PGN/engine work runs
// on page load, and results-based observations never become tactical labels.
export function buildOpponentScout(rows, parsedLines = [], { pool, now = Date.now() / 1000 } = {}) {
  const available = rows.filter(row => row.pool === pool), cohort = available.slice(0, SCOUT_GAME_LIMIT);
  const allowed = new Map(cohort.map(row => [row.key, row]));
  const openings = openingGroups(cohort, pool), white = cohort.filter(row => row.white), black = cohort.filter(row => !row.white);
  const top = side => openings.filter(group => group.white === side).slice().sort((a, b) => b.games - a.games)[0] || null;
  const commonWhite = top(true), commonBlack = top(false);
  const lineGroups = new Map(), seen = new Set();
  let parsed = 0;
  for (const line of parsedLines) {
    const row = allowed.get(line.key);
    if (!row || seen.has(row.key) || !Array.isArray(line.ucis) || line.ucis.length < 6 || !Array.isArray(line.sans) || line.sans.length < 6) continue;
    seen.add(row.key);
    if (!line.ucis.slice(0, 6).every(uci => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci))) continue;
    parsed++;
    const key = `${row.white ? 'w' : 'b'}|${line.ucis.slice(0, 6).join(' ')}`;
    if (!lineGroups.has(key)) lineGroups.set(key, { key, white: row.white, sans: line.sans.slice(0, 6), rows: [] });
    lineGroups.get(key).rows.push(row);
  }
  const lines = [...lineGroups.values()].filter(line => line.rows.length >= 3)
    .map(line => ({ ...line, games: line.rows.length, evidence: cohortEvidence(line.rows) })).sort((a, b) => b.games - a.games);
  const recent = cohort.filter(row => row.end !== null && row.end <= now && row.end >= now - 30 * DAY);
  const previous = cohort.filter(row => row.end !== null && row.end >= now - 60 * DAY && row.end < now - 30 * DAY);
  const recentResult = record(recent), previousResult = record(previous);
  const shift = recentResult.known >= 10 && previousResult.known >= 10 ? recentResult.score - previousResult.score : null;
  const repertoireChanges = [];
  for (const isWhite of [true, false]) {
    const a = recent.filter(row => row.white === isWhite && row.opening), b = previous.filter(row => row.white === isWhite && row.opening);
    if (a.length < 10 || b.length < 10) continue;
    for (const name of new Set(a.map(row => row.opening))) {
      const count = a.filter(row => row.opening === name).length, oldCount = b.filter(row => row.opening === name).length;
      const delta = count * 100 / a.length - oldCount * 100 / b.length;
      if (count >= 5 && delta >= 20) repertoireChanges.push({ name, white: isWhite, count, total: a.length, previousCount: oldCount, previousTotal: b.length, delta });
    }
  }
  const difficult = openings.filter(group => group.known >= 5 && group.losses >= 3 && group.score <= 40)
    .sort((a, b) => a.score - b.score || b.known - a.known)[0] || null;
  const timeoutRows = cohort.filter(row => row.result === 'L' && row.game[row.white ? 'white' : 'black']?.result === 'timeout');
  const durations = cohort.map(row => reliableGameDuration(row.game)).filter(value => value !== null);
  const recommendations = [
    { kind:'white', title:'Prepare their White opening', opening:commonWhite?.eligible ? commonWhite : null,
      evidence:cohortEvidence(commonWhite?.eligible ? commonWhite.rows : white), supported:!!commonWhite?.eligible,
      text:commonWhite?.eligible ? `Study ${commonWhite.name}: it appears in ${commonWhite.games} of ${white.length} sampled White games. Replay a representative line and prepare a reply before playing.` : 'At least five completed games in one White opening are needed. Collect a larger sample before assuming a repertoire.' },
    { kind:'black', title:'Prepare for their Black defence', opening:commonBlack?.eligible ? commonBlack : null,
      evidence:cohortEvidence(commonBlack?.eligible ? commonBlack.rows : black), supported:!!commonBlack?.eligible,
      text:commonBlack?.eligible ? `Explore ${commonBlack.name}: it appears in ${commonBlack.games} of ${black.length} sampled Black games. Check how the position arises against your usual first move.` : 'At least five completed games in one Black opening are needed. Choose a format with more saved or public games.' },
    { kind:'outcomes', title:difficult ? 'Study a difficult opening sample' : lines.length ? 'Rehearse a repeated opening sequence' : 'Build a reliable preparation sample',
      opening:difficult, line:!difficult ? lines[0] || null : null,
      evidence:cohortEvidence(difficult?.rows || lines[0]?.rows || cohort), supported:!!difficult || lines.length > 0,
      text:difficult ? `${difficult.name} scored ${Math.round(difficult.score)}% across ${difficult.known} completed ${difficult.white ? 'White' : 'Black'} games (${difficult.wins}W/${difficult.draws}D/${difficult.losses}L). Study a source game; these outcomes do not prove an engine-evaluated weakness.`
        : lines.length ? `The same first six plies occurred in ${lines[0].games} different games as ${lines[0].white ? 'White' : 'Black'}. Rehearse that line before a future game; the next opponent move is never guaranteed.`
        : 'Load more completed games and review representative positions. Results alone cannot identify tactical, positional or endgame weaknesses.' },
  ];
  return { pool, available:available.length, assessed:cohort.length, parsed, cohort, evidence:cohortEvidence(cohort), totals:record(cohort),
    white:record(white), black:record(black), commonWhite, commonBlack, lines:lines.slice(0, 4), difficult, recommendations,
    duration:{ medianSeconds:durations.length >= 5 ? median(durations) : null, games:durations.length },
    performance:{ recent:recentResult, previous:previousResult, scoreChange:shift }, repertoireChanges:repertoireChanges.slice(0, 3),
    timeouts:{ games:timeoutRows.length, supporting:cohortEvidence(timeoutRows), rate:record(cohort).known >= 10 && timeoutRows.length >= 3 ? timeoutRows.length * 100 / record(cohort).known : null } };
}
