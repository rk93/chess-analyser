const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const date = seconds => seconds === null ? 'date unavailable' : new Date(seconds * 1000).toISOString().slice(0, 10);
const percent = value => value === null ? '—' : Math.round(value) + '%';
const evidence = value => `${value.games} supporting games · ${date(value.start)} – ${date(value.end)} UTC`;
function elapsed(seconds) {
  if (seconds >= 86400) return (seconds / 86400).toFixed(1) + ' days';
  if (seconds >= 3600) return (seconds / 3600).toFixed(1) + ' hours';
  return Math.round(seconds / 60) + ' min';
}

// One scoped, in-memory report. Account, source and cohort changes invalidate it.
// Parsing is lazy, cancellable and separate from public fetching and Stockfish.
export function createOpponentScoutView(root, replay) {
  let state = null, replays = [];
  function paused() {
    root.innerHTML = '<div class="pcWelcome" role="status"><h3>Study paused</h3><p>Your saved games are unchanged. Resume when you are ready.</p><button type="button" class="pcButton pcButtonQuiet" data-scout-retry>Retry study</button></div>';
  }
  function stop() { if (state?.loading) { state.controller.abort(); state.loading = false; paused(); } }
  function clear() { stop(); state = null; replays = []; root.replaceChildren(); }
  function replayButton(row, label, plies = 24) {
    if (!row?.game?.pgn) return '';
    const id = replays.push({ row, label, plies }) - 1;
    return `<button type="button" class="pcButton pcButtonQuiet" data-scout-replay="${id}">Explore on board <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m7 17 10-10M7 7h10v10"/></svg></button>`;
  }
  function report(model, user) {
    replays = [];
    const { totals, duration, performance } = model;
    root.innerHTML = `<header class="pcScoutHero"><span class="pcEyebrow">Pre-game preparation</span><h3>Scout ${esc(user)}.</h3><p>Study completed games before playing, or learn afterwards. Preparation guidance is based on game history; no engine analysis has been performed here.</p><div class="pcScoutStats"><span><strong>${model.assessed}</strong> ${esc(model.pool)} games</span><span><strong>${percent(totals.score)}</strong> score · ${totals.known} known results</span><span><strong>${totals.wins} / ${totals.draws} / ${totals.losses}</strong> wins / draws / losses</span></div></header>
      <p class="pcFootnote">${esc(evidence(model.evidence))}. ${model.available > model.assessed ? `Newest ${model.assessed} of ${model.available} available games assessed.` : 'All available games in this selection assessed.'} ${totals.unknown ? `${totals.unknown} unknown outcomes excluded from percentages.` : ''} Descriptive evidence, not a prediction of playing strength.</p>
      <section class="pcSection"><div class="pcSectionHeading"><h3>Your preparation plan</h3><span class="pcTag">3 next steps</span></div><div class="pcScoutPlan">${model.recommendations.map((item, index) => `<article class="pcScoutAction"><div class="pcScoutStep"><span>0${index + 1}</span><small>${item.supported ? 'Game-history observation' : 'Insufficient evidence'}</small></div><h4>${esc(item.title)}</h4><p>${esc(item.text)}</p><small class="pcMuted">${esc(evidence(item.evidence))}</small>${replayButton(item.opening?.rows[0] || item.line?.rows[0], item.opening?.name || 'Repeated opening line', item.line ? 6 : 24)}</article>`).join('')}</div></section>
      <section class="pcSection"><div class="pcSectionHeading"><h3>Moves they return to</h3><span class="pcTag">Legal PGN moves</span></div><p class="pcMuted">First three full moves, grouped separately by colour. At least three distinct games per line. ${model.parsed} of ${model.assessed} games supplied six legal opening plies.</p><div class="pcScoutLines">${model.lines.map(line => `<article class="pcScoutLine"><span class="pcEyebrow">As ${line.white ? 'White' : 'Black'} · ${line.games} games</span><p class="pcScoutMoves">${line.sans.map((san, i) => `${i % 2 === 0 ? `<span>${i / 2 + 1}.</span> ` : ''}${esc(san)}`).join(' ')}</p><small class="pcMuted">${esc(evidence(line.evidence))}</small>${replayButton(line.rows[0], 'Repeated opening line', 6)}</article>`).join('') || '<p class="pcMuted">No repeated legal sequence meets the three-game minimum. Short games and unplayable PGNs cannot supply a line.</p>'}</div></section>
      <section class="pcSection"><div class="pcSectionHeading"><h3>Activity & recent changes</h3><span class="pcTag">${esc(model.pool)}</span></div><div class="pcDetailPair"><article class="pcDetail"><h4>Typical elapsed duration</h4><strong>${duration.medianSeconds === null ? 'Not enough reliable timestamps' : elapsed(duration.medianSeconds) + ' median'}</strong><p class="pcMuted">${duration.games} games with explicit UTC start and end timestamps. Five required. Wall-clock duration includes time away from the board, especially in Daily chess.</p><h4>Losses on time</h4><p class="pcMuted">${model.timeouts.rate === null ? `${model.timeouts.games} recorded timeout losses; at least three and ten known results are needed to show a rate.` : `${model.timeouts.games} timeout losses · ${percent(model.timeouts.rate)} of ${totals.known} known results.`} Only explicit timeout results count.</p></article><article class="pcDetail"><h4>Recent results</h4><strong>${performance.scoreChange === null ? 'Two larger samples needed' : `${performance.scoreChange >= 0 ? '+' : ''}${Math.round(performance.scoreChange)} percentage points in score`}</strong><p class="pcMuted">Last 30 days: ${performance.recent.known} known results · ${percent(performance.recent.score)} score. Previous 30 days: ${performance.previous.known} · ${percent(performance.previous.score)}. Ten known results in each window required. Opponents and sample coverage may differ.</p><h4>Repertoire changes</h4>${model.repertoireChanges.map(change => `<p class="pcMuted">${esc(change.name)} as ${change.white ? 'White' : 'Black'}: ${change.count}/${change.total} recent vs ${change.previousCount}/${change.previousTotal} previous games with named openings (+${Math.round(change.delta)} percentage points).</p>`).join('') || '<p class="pcMuted">No increase meets the evidence threshold: ten named-opening games per colour in each 30-day window, at least five recent occurrences and a 20-point share increase.</p>'}</article></div></section>`;
  }
  function update(rows, { owner, user, source, pool, days }) {
    if (source === 'lifetime' || pool === 'all') {
      clear(); root.innerHTML = `<div class="pcWelcome"><h3>${source === 'lifetime' ? 'Scout needs completed games' : 'Choose one time control'}</h3><p>${source === 'lifetime' ? 'Choose Saved games or Public sample above. Lifetime statistics contain no opening moves.' : 'Choose Bullet, Blitz, Rapid or Daily above to prepare using a single format.'}</p></div>`; return;
    }
    const selected = rows.filter(row => row.pool === pool), bounded = selected.slice(0, 200);
    // Include the full bounded input so edited PGNs/results cannot reuse a stale report.
    const key = JSON.stringify([owner, user, source, pool, days, selected.length, bounded]);
    if (state?.key === key) return;
    stop(); const current = state = { key, controller:new AbortController(), loading:true };
    root.innerHTML = '<div class="pcScoutLoading" role="status"><h3>Finding opening patterns…</h3><p data-scout-progress>Preparing completed games</p><button type="button" class="pcButton pcButtonQuiet" data-scout-cancel>Cancel study</button></div>';
    void (async () => {
      try {
        const { analyseOpponentScout } = await import('./opponent-scout.js');
        const model = await analyseOpponentScout(selected, { pool, signal:current.controller.signal,
          onProgress:(done, total) => { if (state === current) root.querySelector('[data-scout-progress]').textContent = `${done} of ${total} games studied`; } });
        if (state === current && !current.controller.signal.aborted) { current.loading = false; report(model, user); }
      } catch (error) {
        if (state !== current) return;
        current.loading = false;
        root.innerHTML = `<div class="pcWelcome" role="status"><h3>${error.name === 'AbortError' ? 'Study paused' : 'Study unavailable'}</h3><p>${error.name === 'AbortError' ? 'Your saved games are unchanged. Resume when you are ready.' : 'Opening replay requires the chess library. Reconnect and retry; your saved games are unchanged.'}</p><button type="button" class="pcButton pcButtonQuiet" data-scout-retry>Retry study</button></div>`;
      }
    })();
  }
  root.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.hasAttribute('data-scout-cancel')) stop();
    if (button.hasAttribute('data-scout-retry')) { state = null; root.dispatchEvent(new Event('scoutRetry')); }
    if (button.dataset.scoutReplay !== undefined) {
      const entry = replays[Number(button.dataset.scoutReplay)];
      if (entry) void replay(entry.row.game.pgn, entry.label, entry.row.white, entry.plies);
    }
  });
  return { update, stop, clear };
}
