import { discoverPlayers, readPlayerDirectory, validPlayerName, writePlayerDirectory } from './player-directory.js';
import { createPublicPlayerClient } from './player-public-data.js';
import { COMPARISON_POOLS, formatSummary, headToHead, openingGroups, publicFormatStats, selectSample } from './comparison-intelligence.js';
export { safeArchives } from './player-public-data.js';

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const pct = value => value === null || !Number.isFinite(value) ? '—' : Math.round(value) + '%';
const title = value => value[0].toUpperCase() + value.slice(1);
const icons = {
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
  players:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v3"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[name] || icons.players}</svg>`;
const client = createPublicPlayerClient();
let owner = '', directory = { favourites: [], searches: [] }, local = [], slots = ['', ''], metadata = {}, samples = {};
let source = 'local', pool = 'all', days = 60, generation = 0, controller = null, busy = false;
let pickerSlot = 1, activeOption = -1, options = [], openingViews = [];

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
function status(message, error = false) {
  $('playerCompareStatus').textContent = message;
  $('playerCompareStatus').classList.toggle('pcError', error);
}
function saveDirectory(next) {
  try { directory = writePlayerDirectory(localStorage, owner, next); }
  catch { status('Player selected. Storage is unavailable, so this favourite or recent search could not be saved.', true); }
}
function avatar(user, profile, className = '') {
  let image = '';
  try { const url = new URL(profile?.avatar); if (url.protocol === 'https:' && !url.username && !url.password) image = `<img src="${esc(url.href)}" alt="" referrerpolicy="no-referrer" loading="lazy">`; } catch {}
  return `<span class="pcAvatar ${className}"><span aria-hidden="true">${esc((user || '?').slice(0, 2).toUpperCase())}</span>${image}</span>`;
}
function wireImages(root) {
  root.querySelectorAll('.pcAvatar img').forEach(img => { img.addEventListener('error', () => img.remove(), { once: true }); });
}
function date(seconds) { return Number.isFinite(seconds) && seconds > 0 && seconds * 1000 < 8640000000000000 ? new Date(seconds * 1000).toISOString().slice(0, 10) : 'date unavailable'; }
function card(user, index) {
  if (!user) return `<article class="pcProfile pcProfileEmpty"><span class="pcEyebrow">${index ? 'Your opponent' : 'Your profile'}</span>${avatar('')}<h3>${index ? 'Who will you study?' : 'Choose your profile'}</h3><button type="button" class="pcButton pcButtonQuiet" data-pick="${index}">${icon('search')} Choose player</button></article>`;
  const meta = metadata[user], favourite = directory.favourites.includes(user);
  return `<article class="pcProfile" data-player="${esc(user)}"><div class="pcProfileTop"><span class="pcEyebrow">${user === owner ? 'You' : index ? 'Opponent' : 'Player one'}</span>${user === owner ? '' : `<button type="button" class="pcIconButton ${favourite ? 'pcIsFavourite' : ''}" data-favourite="${esc(user)}" aria-pressed="${favourite}" aria-label="${favourite ? 'Remove' : 'Save'} ${esc(user)} ${favourite ? 'from' : 'as'} favourite">${icon('star')}</button>`}</div><div class="pcIdentity">${avatar(user, meta?.profile)}<div><h3 title="${esc(user)}">${esc(user)}</h3><button type="button" class="pcTextButton" data-pick="${index}">Change player</button></div></div><div class="pcRatings">${COMPARISON_POOLS.map(format => `<div><span>${title(format)}</span><strong>${publicFormatStats(meta?.stats, format).rating ?? '—'}</strong></div>`).join('')}</div><small class="pcMuted">${meta?.stats ? `Public ratings · ${meta.stale ? 'stale cache · ' : ''}${date(meta.updated / 1000)}` : 'Public ratings available with “Load public data”'}</small></article>`;
}
function renderProfiles() {
  const root=$('playerProfileCards'),active=document.activeElement;
  const focusKey=root.contains(active)?['favourite','pick'].find(key=>active.dataset[key]!==undefined):null;
  const focusValue=focusKey?active.dataset[focusKey]:null;
  root.innerHTML = slots.map(card).join('');
  wireImages(root);
  if(focusKey)[...root.querySelectorAll(`[data-${focusKey}]`)].find(button=>button.dataset[focusKey]===focusValue)?.focus({preventScroll:true});
  $('loadPublicPlayers').disabled = busy || !slots.every(Boolean) || slots[0] === slots[1];
}
function renderPicker() {
  const input = $('comparePlayerSearch'), query = input.value.trim();
  options = discoverPlayers(local, owner, directory, query);
  const exact = validPlayerName(query);
  if (exact && !options.some(row => row.name === exact)) options.push({ name: exact, sources: ['Enter exact username'] });
  activeOption = -1; input.removeAttribute('aria-activedescendant');
  const list = $('playerSearchOptions');
  list.innerHTML = options.map((row, i) => `<button id="playerOption${i}" role="option" aria-selected="false" type="button" class="pcPlayerOption" data-option="${i}">${avatar(row.name, metadata[row.name]?.profile, 'pcAvatarSmall')}<span><strong>${esc(row.name)}</strong><small>${esc(row.sources.join(' · '))}${row.games ? ` · ${row.games} games` : ''}</small></span>${icon(row.favourite ? 'star' : 'arrow')}</button>`).join('') || '<p class="pcMuted pcPickerEmpty">No saved players yet. Import games to find opponents, or enter an exact Chess.com username.</p>';
  list.hidden = false; input.setAttribute('aria-expanded', 'true');
  $('playerPickerLabel').textContent = pickerSlot ? 'Find an opponent' : 'Choose your profile'; wireImages(list);
}
function closePicker() { $('playerSearchOptions').hidden = true; $('comparePlayerSearch').setAttribute('aria-expanded', 'false'); $('comparePlayerSearch').removeAttribute('aria-activedescendant'); activeOption = -1; }
function focusPicker(slot) { pickerSlot = slot; $('comparePlayerSearch').value = ''; renderPicker(); $('comparePlayerSearch').focus(); }
async function choosePlayer(raw) {
  const user = validPlayerName(raw); if (!user) { status('Enter a Chess.com username using letters, numbers, underscores or hyphens.', true); return; }
  if (slots[1 - pickerSlot] === user) { status('Choose a different player for the other side.', true); return; }
  controller?.abort(); generation++; busy = false;
  slots[pickerSlot] = user;
  if (user !== owner) saveDirectory({ ...directory, searches: [user, ...directory.searches.filter(name => name !== user)] });
  closePicker(); $('comparePlayerSearch').value = ''; renderProfiles(); renderComparison();
  const token = generation, cached = await client.cachedMetadata(user);
  if (token !== generation) return;
  metadata[user] = cached; renderProfiles(); renderComparison();
  if (source !== 'local') await loadPublic(false);
}
function sparkline(points, label) {
  if (points.length < 2) return '<span class="pcMuted">Two dated rated games needed for a trend</span>';
  const step = Math.max(1, Math.ceil(points.length / 48)), sampled = points.filter((_, i) => i % step === 0 || i === points.length - 1);
  const low = Math.min(...sampled.map(row => row.rating)), high = Math.max(...sampled.map(row => row.rating)), span = Math.max(1, high - low);
  const path = sampled.map((row, i) => `${i ? 'L' : 'M'}${(4 + i * 212 / (sampled.length - 1)).toFixed(1)} ${(44 - 36 * (row.rating - low) / span).toFixed(1)}`).join(' ');
  return `<svg class="pcSparkline" viewBox="0 0 220 52" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title><path d="${path}"/></svg>`;
}
function scope(rows, user) {
  if (source === 'lifetime') return metadata[user]?.stats ? 'Lifetime public record · supported formats' : 'No public statistics loaded';
  const dated = rows.filter(row => row.end !== null), sample = samples[user];
  const label = source === 'local' ? 'Saved games on this device' : sample ? `${sample.archives} public monthly archives${sample.stale ? ' · stale cached sample' : ''}` : 'Public sample not loaded';
  return `${label}${dated.length ? ` · ${date(dated.at(-1).end)} – ${date(dated[0].end)} UTC` : ''}`;
}
function formatRow(format, rows) {
  const summary = slots.map((user, i) => source === 'lifetime' ? publicFormatStats(metadata[user]?.stats, format) : formatSummary(rows[i], format));
  return `<article class="pcFormatRow" data-format="${format}"><div class="pcFormatHeading"><h4>${title(format)}</h4><button type="button" class="pcTextButton" data-format-drill="${format}" aria-label="Explore ${title(format)} comparison">Explore ${icon('arrow')}</button></div><div class="pcFormatPair">${summary.map((stat, i) => `<div><span class="pcMuted">${esc(slots[i] || (i ? 'Opponent' : 'You'))}</span><div class="pcFormatNumbers"><strong>${pct(stat.winRate)}</strong><span>${stat.games === null ? 'No public record' : `${stat.games} games`}</span></div><div class="pcWinTrack" role="img" aria-label="${esc(slots[i] || 'Player')} ${title(format)} win rate ${pct(stat.winRate)}"><span style="width:${Math.max(0, Math.min(100, stat.winRate || 0))}%"></span></div><small>${source === 'lifetime' ? `Public rating ${stat.rating ?? '—'}` : `${stat.wins}W · ${stat.draws}D · ${stat.losses}L${stat.unknown ? ` · ${stat.unknown} unknown` : ''}`}</small></div>`).join('')}</div></article>`;
}
function detailedFormat(rows) {
  if (pool === 'all' || source === 'lifetime') return '';
  return `<div class="pcDetailPair">${rows.map((games, i) => {
    const value = formatSummary(games, pool);
    return `<article class="pcDetail"><h4>${esc(slots[i] || 'Choose a player')}</h4>${sparkline(value.points, `${slots[i]} ${pool} rating observations`)}<p class="pcMuted">${value.delta === null ? 'Rating change unavailable' : `${value.delta > 0 ? '+' : ''}${value.delta} between saved rated observations`}</p><div class="pcFormDots" aria-label="Recent form, newest first">${value.recent.length ? value.recent.map(result => `<span class="pcResult${result}" title="${({ W:'Win', D:'Draw', L:'Loss' })[result]}">${result}</span>`).join('') : '<span class="pcMuted">No completed games in this selection</span>'}</div><div class="pcColourScores"><span>White <b>${pct(value.white.score)}</b><small>${value.white.known} games</small></span><span>Black <b>${pct(value.black.score)}</b><small>${value.black.known} games</small></span></div></article>`;
  }).join('')}</div>`;
}
function renderOpenings(rows) {
  openingViews = [];
  if (source === 'lifetime') return '<p class="pcMuted">Lifetime public statistics do not include opening histories. Choose a game sample to explore openings.</p>';
  return `<div class="pcOpeningPair">${rows.map((games, player) => {
    const groups=openingGroups(games,pool),highlights=pool==='all'?[groups.find(group=>group.white),groups.find(group=>!group.white)].filter(Boolean):groups.slice(0,2);
    return `<div><h4>${esc(slots[player] || 'Choose a player')}</h4>${highlights.map(group => {
    const id = openingViews.push(group) - 1;
    return `<article class="pcOpening"><div><strong>${esc(group.name)}</strong><span>${group.white ? 'White' : 'Black'} · ${title(group.pool)} · ${group.games} games</span></div><div class="pcOpeningFooter"><span>${group.eligible ? `${pct(group.score)} score` : 'Small sample'}<small>${group.wins}W / ${group.draws}D / ${group.losses}L</small></span><button type="button" class="pcButton pcButtonQuiet" data-opening="${id}" aria-label="Replay ${esc(group.name)} opening">Replay ${icon('arrow')}</button></div><details><summary>Opponent strength</summary>${['higher','similar','lower'].map(band => { const stat = group.strength[band]; return `<p>${title(band)} rated: ${stat.known >= 5 ? pct(stat.score)+' score' : 'More games needed'} · ${stat.known} games</p>`; }).join('')}</details></article>`;
  }).join('') || '<p class="pcMuted">No opening metadata in this selection. Import or load a game sample to discover a repertoire.</p>'}</div>`;}).join('')}</div><p class="pcFootnote">Game-history evidence · score = wins + half draws. Five completed games per opening, colour and format are needed for a performance comparison. Outcomes do not establish tactical weaknesses.</p>`;
}
function renderHeadToHead(rows) {
  if (!slots.every(Boolean) || source === 'lifetime') return '';
  const match = headToHead(rows[0], rows[1], slots[0], slots[1], pool);
  return `<section class="pcSection pcHeadToHead"><div class="pcSectionHeading"><h3>When paths crossed</h3><span class="pcTag">Head to head</span></div>${match.games ? `<p><b>${match.games} encounters</b> in this selection · ${esc(slots[0])}: ${match.wins}W / ${match.draws}D / ${match.losses}L</p><div class="pcColourScores"><span>As White <b>${pct(match.white.score)}</b><small>${match.white.known} games</small></span><span>As Black <b>${pct(match.black.score)}</b><small>${match.black.known} games</small></span></div><div class="pcEncounterList">${match.rows.slice(0, 3).map(row => `<button type="button" class="pcEncounter" data-replay-game="${esc(row.key)}">${date(row.end)} · ${title(row.pool)} · ${row.opening ? esc(row.opening) : 'Game replay'} ${icon('arrow')}</button>`).join('')}</div>` : '<p class="pcMuted">No head-to-head games found in the available selection. The players may have met outside this sample.</p>'}</section>`;
}
function currentRows() { return slots.map(user => selectSample(source === 'public' ? samples[user]?.games || [] : local, user, { days })); }
function renderComparison() {
  document.querySelectorAll('[data-pool]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.pool === pool)));
  document.querySelectorAll('[data-source]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.source === source)));
  const rows = currentRows(), both = slots.every(Boolean);
  $('friendsAnalyticsPanel').querySelector('.playerComparison').classList.toggle('pcHasComparison',both);
  $('playerCompareResults').hidden = !both; $('playerComparisonWelcome').hidden = both;
  if (!both) return;
  $('comparisonScope').innerHTML = slots.map((user, i) => `<span><b>${esc(user)}</b> · ${esc(scope(rows[i], user))}</span>`).join('');
  $('comparisonPeriod').disabled = source === 'lifetime';
  $('comparisonSummary').textContent = source === 'lifetime' ? 'Lifetime records are separate for each format. They do not contain historical rating trends or opening moves.' : `${days === 'all' ? 'All available dates' : `Same last ${days} days for both players`} · sample coverage may differ. Ratings are never compared across formats.`;
  $('comparisonFormats').innerHTML = (pool === 'all' ? COMPARISON_POOLS : [pool]).map(format => formatRow(format, rows)).join('') + detailedFormat(rows);
  $('comparisonOpenings').innerHTML = renderOpenings(rows); $('comparisonEncounters').innerHTML = renderHeadToHead(rows);
  $('comparisonEvidence').textContent = source === 'lifetime' ? 'Source: Chess.com public statistics. Different opponents and lifetime periods affect these records.' : `${source === 'local' ? 'Source: locally saved game history' : 'Source: recent public game archives'}. Trends use rated observations; percentages exclude unknown outcomes. Small samples are descriptive, not reliable measures of playing strength.`;
}
async function loadPublic(refresh = false) {
  if (!slots.every(Boolean)) { status('Choose both players first.'); return; }
  controller?.abort(); controller = new AbortController(); busy = true;
  const token = ++generation, users = [...slots], signal = controller.signal;
  $('cancelPlayerLoad').hidden = false; renderProfiles(); status('Loading public player profiles…');
  try {
    const warnings = [];
    for (const user of users) {
      const data = await client.metadata(user, { signal, refresh });
      if (token !== generation) return;
      metadata[user] = data; warnings.push(...data.warnings); renderProfiles();
      if (source === 'public') {
        status(`Loading ${user}'s recent games…`);
        samples[user] = await client.sample(user, { signal, refresh, onProgress: text => { if (token === generation) status(text); } });
        if (samples[user].stale) warnings.push('Showing a stale cached sample while public data is unavailable.');
      }
    }
    if (token !== generation) return;
    renderProfiles(); renderComparison(); status(warnings.length ? [...new Set(warnings)].join(' ') : 'Public data loaded.');
  } catch (error) {
    if (token !== generation) return;
    renderProfiles(); renderComparison(); status(error.name === 'AbortError' ? 'Loading cancelled. Your saved games are unchanged.' : error.name === 'TimeoutError' ? 'Chess.com took too long. Try saved games or retry later.' : error.message, true);
  } finally { if (token === generation) { busy = false; $('cancelPlayerLoad').hidden = true; renderProfiles(); } }
}
async function refreshLocal(reset = false) {
  const nextOwner = validPlayerName(localStorage.getItem('chess-username')) || '';
  if (reset || nextOwner !== owner) {
    controller?.abort(); generation++; busy = false; owner = nextOwner; directory = readPlayerDirectory(localStorage, owner);
    slots = [owner, '']; metadata = {}; samples = {}; source = 'local'; pool = 'all'; days = 60;
    $('comparisonPeriod').value = '60'; $('cancelPlayerLoad').hidden = true;
  }
  const token = generation;
  try { const games = await localGames(); if (token !== generation) return; local = games; }
  catch { status('Saved games are unavailable. You can still choose a username and load public data.', true); local = []; }
  for (const user of slots.filter(Boolean)) {
    if (!metadata[user]) { const value = await client.cachedMetadata(user); if (token !== generation) return; metadata[user] = value; }
  }
  renderProfiles(); renderComparison();
  renderDiscoveryChips();
}
function renderDiscoveryChips(){
  $('playerDiscoveryChips').innerHTML = discoverPlayers(local, owner, directory).slice(0, 5).map(row => `<button type="button" class="pcDiscoveryChip" data-discover="${esc(row.name)}">${row.favourite ? icon('star') : icon('players')}<span>${esc(row.name)}<small>${esc(row.sources[0])}</small></span></button>`).join('');
}
async function replay(pgn, name, white = true, maxPlies = 24) {
  try {
    const { Chess } = await import('https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm');
    const board = new Chess(); board.loadPgn(pgn); if (!board.history().length) throw new Error();
    $('boardLabTab').click();
    window.dispatchEvent(new CustomEvent('loadLabPgn', { detail: { pgn, label: name, orientation: white ? 'white' : 'black', maxPlies } }));
  } catch { status('This game does not contain a playable PGN. Choose another opening or game.', true); }
}
function init() {
  const panel = $('friendsAnalyticsPanel'); if (!panel) return;
  panel.innerHTML = `<section class="playerComparison" aria-labelledby="playerComparisonTitle"><header class="pcHero"><span class="pcEyebrow">Friends & Players</span><h2 id="playerComparisonTitle">Your chess circle.</h2><p>Pick a familiar opponent. Find the patterns.</p></header><form id="playerCompareForm" class="pcPicker" autocomplete="off"><label id="playerPickerLabel" for="comparePlayerSearch">Find an opponent</label><div class="pcSearchBox">${icon('search')}<input id="comparePlayerSearch" role="combobox" aria-autocomplete="list" aria-controls="playerSearchOptions" aria-expanded="false" placeholder="Search players or enter a username" maxlength="50" spellcheck="false"><button type="submit" class="pcButton" aria-label="Select player">${icon('arrow')}</button></div><div id="playerSearchOptions" class="pcSearchOptions" role="listbox" aria-label="Suggested players" hidden></div></form><div id="playerDiscoveryChips" class="pcDiscoveryChips" aria-label="Players from your saved games and favourites"></div><details class="pcDiscoveryNote"><summary>Where do these players come from?</summary><p>Recent opponents come from your saved games. Favourites and recent searches are saved on this device for your configured username. These are not imported Chess.com friends. Search completes locally known names; enter an exact username to study someone new.</p></details><div id="playerProfileCards" class="pcProfileCards"></div><section class="pcWorkspace"><div class="pcWorkspaceTop"><div class="pcSourceTabs" aria-label="Comparison data source">${[['local','Saved games'],['public','Public sample'],['lifetime','Lifetime stats']].map(([key,label])=>`<button type="button" data-source="${key}" aria-pressed="${key==='local'}">${label}</button>`).join('')}</div><div class="pcLoadActions"><button id="loadPublicPlayers" class="pcButton pcButtonQuiet" type="button">Load public data</button><button id="cancelPlayerLoad" class="pcTextButton" type="button" hidden>Cancel</button></div></div><p id="playerCompareStatus" role="status" aria-live="polite"></p><div id="playerComparisonWelcome" class="pcWelcome">${icon('players')}<h3>A little rivalry. A lot to learn.</h3><p>Choose a player above to compare all four formats. Your own profile is filled in from your saved username.</p></div><div id="playerCompareResults" hidden><div class="pcComparisonControls"><div class="pcPoolTabs" aria-label="Time-control comparison"><button type="button" data-pool="all" aria-pressed="true">Overview</button>${COMPARISON_POOLS.map(format=>`<button type="button" data-pool="${format}" aria-pressed="false">${title(format)}</button>`).join('')}</div><label class="pcPeriodLabel">Period<select id="comparisonPeriod"><option value="30">Last 30 days</option><option value="60" selected>Last 60 days</option><option value="90">Last 90 days</option><option value="all">All available</option></select></label></div><p id="comparisonSummary" class="pcFootnote"></p><div id="comparisonScope" class="pcScope"></div><section class="pcSection"><div class="pcSectionHeading"><h3>Four formats. Different stories.</h3><span class="pcTag">Win rate</span></div><div id="comparisonFormats"></div><p id="comparisonEvidence" class="pcFootnote"></p></section><section class="pcSection"><div class="pcSectionHeading"><h3>Opening fingerprints</h3><span class="pcTag">Explore & replay</span></div><div id="comparisonOpenings"></div></section><div id="comparisonEncounters"></div></div></section></section>`;
  panel.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.pick !== undefined) focusPicker(Number(button.dataset.pick));
    if (button.dataset.option !== undefined) void choosePlayer(options[Number(button.dataset.option)]?.name);
    if (button.dataset.discover) { pickerSlot = 1; void choosePlayer(button.dataset.discover); }
    if (button.dataset.favourite) {
      const user = button.dataset.favourite;
      if(!directory.favourites.includes(user)&&directory.favourites.length>=24){status('You have 24 saved favourites. Remove one before adding another.',true);return;}
      saveDirectory({ ...directory, favourites: directory.favourites.includes(user) ? directory.favourites.filter(name => name !== user) : [user, ...directory.favourites] }); renderProfiles(); renderDiscoveryChips();
    }
    if (button.dataset.source) { controller?.abort(); generation++; busy = false; source = button.dataset.source; $('cancelPlayerLoad').hidden = true; renderComparison(); if (source !== 'local') void loadPublic(false); else renderProfiles(); }
    const selectedPool = button.dataset.pool || button.dataset.formatDrill;
    if (selectedPool) { pool = selectedPool; renderComparison(); }
    if (button.dataset.opening !== undefined) { const group = openingViews[Number(button.dataset.opening)]; if (group) void replay(group.rows[0].game.pgn, group.name, group.white); }
    if (button.dataset.replayGame) { const row = currentRows().flat().find(row => row.key === button.dataset.replayGame); if (row) void replay(row.game.pgn, 'Head-to-head game', row.white, 1200); }
  });
  $('comparePlayerSearch').addEventListener('input', renderPicker);
  $('comparePlayerSearch').addEventListener('focus', renderPicker);
  $('comparePlayerSearch').addEventListener('keydown', event => {
    if (event.key === 'Escape') { closePicker(); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); if ($('playerSearchOptions').hidden) renderPicker(); if (!options.length) return;
      activeOption = (activeOption + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      document.querySelectorAll('[data-option]').forEach((option,i) => option.setAttribute('aria-selected',String(i===activeOption)));
      const active = $('playerOption'+activeOption); $('comparePlayerSearch').setAttribute('aria-activedescendant', active.id); active.scrollIntoView({ block:'nearest' });
    }
  });
  $('playerCompareForm').addEventListener('submit', event => { event.preventDefault(); void choosePlayer(activeOption >= 0 ? options[activeOption]?.name : $('comparePlayerSearch').value); });
  $('comparisonPeriod').addEventListener('change', event => { days = event.target.value === 'all' ? 'all' : Number(event.target.value); renderComparison(); });
  $('loadPublicPlayers').addEventListener('click', () => { if (source === 'local') source = 'public'; renderComparison(); void loadPublic(true); });
  $('cancelPlayerLoad').addEventListener('click', () => controller?.abort());
  document.addEventListener('click', event => { if (!$('playerCompareForm').contains(event.target) && !event.target.closest('[data-pick]')) closePicker(); });
  $('friendsAnalyticsTab').addEventListener('click', () => void refreshLocal());
  window.addEventListener('chessImportFinished', () => void refreshLocal());
  window.addEventListener('chessGamesImported', () => void refreshLocal());
  window.addEventListener('storage', event => { if (event.key === 'chess-username' || event.key === null) void refreshLocal(true); });
  void refreshLocal(true);
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
}
