import { buildPlayerInsights } from './player-insights.js';
import { cacheGet, cacheSet } from './analysis-store.js';

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
let generation = 0, controller = null, retryAfter = 0;
const DAY = 86400000;
function validateName(value) {
  const name = value.trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,50}$/.test(name)) throw new Error('Enter two Chess.com usernames using letters, numbers, underscores or hyphens.');
  return name;
}

async function getJSON(url, signal) {
  const timeout = AbortSignal.timeout(15000), combined = AbortSignal.any([signal, timeout]);
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: combined });
  if (response.status === 429) {
    const header = response.headers.get('Retry-After');
    const seconds = header && /^\d+$/.test(header) ? Number(header) : header ? Math.max(0, (Date.parse(header) - Date.now()) / 1000) : 60;
    retryAfter = Date.now() + (Number.isFinite(seconds) ? Math.max(1, seconds) : 60) * 1000;
    throw new Error('Chess.com is rate limiting requests. Please wait before trying again.');
  }
  if (!response.ok) throw new Error(response.status === 404 ? 'Chess.com could not find one of these players.' : `Chess.com request failed (${response.status}). Your saved games are unchanged.`);
  return response.json();
}

export function safeArchives(archives, user) {
  if (!Array.isArray(archives)) throw new Error('Chess.com returned an invalid archive list.');
  return [...new Set(archives.filter(raw => {
    try {
      const url = new URL(raw), match = url.pathname.match(/^\/pub\/player\/([a-z0-9_-]+)\/games\/\d{4}\/(0[1-9]|1[0-2])$/i);
      return url.origin === 'https://api.chess.com' && !url.username && !url.password && !url.search && !url.hash && match?.[1].toLowerCase() === user;
    } catch { return false; }
  }))].sort().slice(-3);
}

async function publicGames(user, signal) {
  const saved = await cacheGet('player-comparison', user);
  if (saved?.version === 1 && Array.isArray(saved.games) && Number.isFinite(saved.updated) && saved.updated <= Date.now() && Date.now() - saved.updated < DAY) return { ...saved, cached: true };
  const response = await getJSON(`https://api.chess.com/pub/player/${encodeURIComponent(user)}/games/archives`, signal);
  const archives = safeArchives(response.archives, user), games = [];
  for (const archive of archives) {
    const data = await getJSON(archive, signal);
    if (!Array.isArray(data.games)) throw new Error('Chess.com returned an invalid games archive. Try again later.');
    for (const game of data.games) games.push(game);
  }
  const data = { version: 1, games: games.sort((a, b) => (b.end_time || 0) - (a.end_time || 0)).slice(0, 6000), updated: Date.now(), archives: archives.length };
  await cacheSet('player-comparison', user, data);
  return { ...data, cached: false };
}

async function localGames() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('rk93-chess-analyser', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('games')) { db.close(); resolve([]); return; }
      const tx = db.transaction('games', 'readonly'), result = tx.objectStore('games').getAll();
      tx.oncomplete = () => { db.close(); resolve(result.result || []); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  });
}

function playerCard(user, insights, source) {
  const stats = insights.totals, rating = insights.ratings[0], first = insights.rows.filter(row => row.end).at(-1), last = insights.rows.find(row => row.end);
  const pct = value => value === null ? '—' : Math.round(value) + '%';
  const date = row => new Date(row.end * 1000).toISOString().slice(0, 10);
  const opening = insights.strongest;
  return `<article class="playerCompareCard"><h3>${esc(user)}</h3><p class="homeDataNote">${esc(source)}${first && last ? ` · ${date(first)} to ${date(last)} UTC` : ''}</p><dl><div><dt>Saved games in selection</dt><dd>${stats.games}</dd></div><div><dt>Score</dt><dd>${pct(stats.score)}</dd></div><div><dt>Wins / draws / losses</dt><dd>${stats.wins} / ${stats.draws} / ${stats.losses}</dd></div><div><dt>${rating ? esc(rating.pool) : 'Selected pool'} rating observation</dt><dd>${rating?.latest ?? '—'}</dd></div><div><dt>White score (${insights.white.known} games)</dt><dd>${pct(insights.white.score)}</dd></div><div><dt>Black score (${insights.black.known} games)</dt><dd>${pct(insights.black.score)}</dd></div></dl><p>${opening ? `Strongest observed opening: ${esc(opening.name)} · ${opening.white ? 'White' : 'Black'} · ${opening.known} games · ${pct(opening.score)} score.` : 'At least five games per opening, colour and time control are needed for an opening comparison.'}</p>${stats.unknown ? `<p>${stats.unknown} unknown results excluded from percentages.</p>` : ''}${!stats.games ? '<p>No standard-chess games for this player in this selection.</p>' : ''}</article>`;
}

async function compare(event) {
  event.preventDefault();
  const token = ++generation;
  controller?.abort(); controller = new AbortController();
  const signal = controller.signal, status = $('playerCompareStatus'), results = $('playerCompareResults'), button = $('comparePlayers');
  results.replaceChildren(); button.disabled = true;
  try {
    const first = validateName($('comparePlayerA').value), second = validateName($('comparePlayerB').value);
    if (first === second) throw new Error('Choose two different players.');
    const live = $('compareFetchPublic').checked, pool = $('compareTimeClass').value;
    if (live && Date.now() < retryAfter) throw new Error('Please wait for the Chess.com rate limit to reset before trying again.');
    status.textContent = live ? 'Loading up to three monthly archives per player, one request at a time…' : 'Comparing games already saved on this device…';
    let a, b, firstSource, secondSource;
    if (live) {
      const firstData = await publicGames(first, signal), secondData = await publicGames(second, signal);
      a = firstData.games; b = secondData.games;
      const source = data => `${data.archives} public monthly archives${data.cached ? ' · cached within 24 hours' : ''} · up to 6,000 games`;
      firstSource = source(firstData); secondSource = source(secondData);
    } else { a = b = await localGames(); firstSource = secondSource = 'Games stored on this device'; }
    if (token !== generation) return;
    results.innerHTML = playerCard(first, buildPlayerInsights(a, first, { pool }), firstSource) + playerCard(second, buildPlayerInsights(b, second, { pool }), secondSource);
    status.textContent = `Comparing ${pool} games. Different date ranges, opponents and sample sizes affect these results; they do not establish who is the stronger player.`;
  } catch (error) {
    if (token === generation) status.textContent = error.name === 'TimeoutError' ? 'Chess.com took too long. Try again or compare saved games.' : error.name === 'AbortError' ? 'Comparison cancelled.' : error.message || 'Could not load this comparison.';
  } finally { if (token === generation) button.disabled = false; }
}

function init() {
  const panel = $('friendsAnalyticsPanel'); if (!panel) return;
  panel.innerHTML = `<section class="card playerComparison"><h2>Compare your chess</h2><p>Compare two public Chess.com players using saved games, or fetch a bounded recent sample.</p><form id="playerCompareForm"><div class="playerCompareFields"><label>First player<input id="comparePlayerA" autocomplete="off" required maxlength="50"></label><label>Second player<input id="comparePlayerB" autocomplete="off" required maxlength="50"></label><label>Time control<select id="compareTimeClass"><option value="rapid">Rapid</option><option value="blitz">Blitz</option><option value="bullet">Bullet</option><option value="daily">Daily</option></select></label></div><label class="playerCompareFetch"><input type="checkbox" id="compareFetchPublic"> Fetch up to three recent public monthly archives per player</label><p class="homeDataNote">Public samples are cached for 24 hours and kept separate from your Games library. No engine analysis runs here.</p><button id="comparePlayers" class="btn" type="submit">Compare players</button></form><p id="playerCompareStatus" role="status" aria-live="polite"></p><div id="playerCompareResults"></div></section>`;
  $('comparePlayerA').value = localStorage.getItem('chess-username') || '';
  $('playerCompareForm').addEventListener('submit', compare);
  $('playerCompareForm').addEventListener('input', () => { if (controller) { generation++; controller.abort(); $('comparePlayers').disabled = false; $('playerCompareStatus').textContent = ''; $('playerCompareResults').replaceChildren(); } });
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
}
