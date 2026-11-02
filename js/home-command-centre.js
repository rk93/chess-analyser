import { buildChessPulse } from './chess-pulse.js';
import { buildWeaknessReport } from './weakness-core.js';
import { gameIdentity } from './player-insights.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const title=value=>value[0].toUpperCase()+value.slice(1);
const signed=value=>value===null?'More history needed':`${value>0?'+':''}${value}`;
const date=value=>Number.isFinite(value)?new Date(value*1000).toISOString().slice(0,10):'Date unavailable';
const arrow='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';

export function createHomeCommandCentre(view,openGame) {
  const $=id=>view.querySelector('#'+id);
  let user='',games=[],report=null,controller=null,generation=0,pulse=[],format='rapid',chartDays=30,chartPoints=[],showAll=false;
  view.querySelector('h1').id='homeViewHeading';
  const old=$('homeAnalyticsLink'),section=document.createElement('section');section.className='homePulse';
  section.innerHTML=`<div class="homeSectionTop"><div><span class="homeEyebrow">Your chess pulse</span><h2>A clearer picture.</h2></div><button id="homeAnalyticsLink" class="homeTextButton" type="button" aria-label="View your full chess analytics">Analytics ${arrow}</button></div>${$('homeMetrics').outerHTML}<div id="homePulsePools" class="homePulsePools" role="group" aria-label="Rating format"></div><div class="homePulseChartTop"><strong id="homePulseReadout" aria-live="polite"></strong><div class="homeChartPeriods" role="group" aria-label="Rating chart period">${[7,30,90].map(days=>`<button type="button" data-chart-days="${days}" aria-pressed="${days===30}">${days}d</button>`).join('')}</div></div><div id="homePulseChart"></div><input id="homePulseCursor" class="homePulseCursor" type="range" min="0" max="0" value="0" aria-label="Explore saved rating observations" hidden><p id="homePulseDelta" class="homeDataNote"></p><p class="homeDataNote">Saved rated observations, not live ratings. Each format has its own scale.</p>`;
  old.replaceWith(section);
  $('homeInsightText').closest('section').classList.add('homeDailyInsight');
  $('homeInsightText').closest('section').querySelector('h2').textContent="Pip’s daily insight";
  $('homeInsightText').closest('section').querySelector('.homeSectionTop>span').textContent='One useful next step';
  const growth=document.createElement('section');growth.className='homeGrowth';
  growth.innerHTML=`<div class="homeSectionTop"><div><span class="homeEyebrow">Your growth areas</span><h2>Patterns worth your attention.</h2></div></div><p class="homeDataNote">Last 90 days of saved games. Formats stay separate. Outcomes describe results; saved engine reviews support move-quality observations.</p><div id="homeGrowthList" class="homeGrowthList"></div><button id="homeShowAllWeaknesses" type="button" class="homeTextButton" aria-expanded="false" hidden>Show all patterns</button><div class="homeEvidenceActions"><button id="homeCheckWeaknesses" type="button" class="homeTextButton">Check saved engine reviews ${arrow}</button><button id="homeCancelWeaknesses" type="button" class="homeTextButton" hidden>Cancel check</button></div><p id="homeWeaknessStatus" class="homeDataNote" role="status">Engine evidence has not been checked. No new analysis runs here.</p><details class="homeEvidencePolicy"><summary>How to read these observations</summary><p class="homeDataNote">Sample labels are descriptive, not statistical confidence. Phase estimates use remaining non-pawn material (13 points or fewer is an endgame); otherwise moves 1–10 are the opening, followed by the middlegame. Pawn structure, king safety and positional diagnoses need separate verification.</p></details>`;
  $('homeInsightText').closest('section').after(growth);
  const continuation=document.createElement('section');continuation.className='homeContinue';
  continuation.innerHTML=`<div class="homeSectionTop"><h2>Continue improving</h2><span>A little focus goes a long way</span></div><div class="homeContinueGrid"><button id="homeResumeReview" type="button" class="homeContinueAction" hidden><span class="homeEyebrow">Pick up where you left off</span><strong>Resume your game review</strong><small></small>${arrow}</button><button id="homeContinuePractice" type="button" class="homeContinueAction"><span class="homeEyebrow">Your own positions</span><strong>Find a useful practice moment</strong><small>Choose from saved, verified mistakes</small>${arrow}</button><button id="homeContinueOpening" type="button" class="homeContinueAction" hidden><span class="homeEyebrow">Opening study</span><strong>Revisit a familiar line</strong><small></small>${arrow}</button></div></section>`;
  growth.after(continuation);
  const recent=$('homeRecentScroller').closest('section');continuation.after(recent);
  const milestones=document.createElement('section');milestones.className='homeMilestones';
  milestones.innerHTML='<div class="homeSectionTop"><h2>Your personal milestones</h2><span>Progress with perspective</span></div><div id="homeMilestoneList"></div><p class="homeDataNote">Bests refer to ratings in your saved games, separately for each format. Missing older games can change these records.</p>';
  recent.after(milestones);

  function cancel() { controller?.abort();controller=null;generation++;$('homeCheckWeaknesses').disabled=false;$('homeCancelWeaknesses').hidden=true; }
  function reset() { cancel();user='';games=[];report=null;pulse=[];showAll=false;for(const id of ['homeGrowthList','homePulsePools','homePulseChart','homeMilestoneList'])$(id).replaceChildren();$('homePulseReadout').textContent='Loading your saved observations…';$('homePulseDelta').textContent='';$('homeInsightText').textContent='Loading your saved games…';$('homeReviewSuggestion').hidden=true;$('homeShowAllWeaknesses').hidden=true;view.querySelectorAll('.homeVerifiedBadge').forEach(badge=>badge.remove());$('homePulseCursor').hidden=true;$('homeResumeReview').hidden=true;$('homeContinueOpening').hidden=true;$('homeWeaknessStatus').textContent='Engine evidence has not been checked. No new analysis runs here.'; }
  function resume() {
    try { const value=JSON.parse(localStorage.getItem('chess-home-review:'+user)||'null');return value&&games.some(game=>gameIdentity(game)===value.key)?value:null; }
    catch {return null;}
  }
  function renderContinue() {
    const last=resume(),button=$('homeResumeReview');button.hidden=!last;
    if(last)button.querySelector('small').textContent=`${last.ply?`Position after ply ${last.ply}`:'Return to your saved game'} · stored on this device`;
    const opening=report?.history.find(item=>item.kind==='opening'),target=$('homeContinueOpening');target.hidden=!opening;
    if(opening)target.querySelector('small').textContent=`${opening.pool} · ${opening.rows[0].opening}`;
  }
  function renderChart() {
    const selected=pulse.find(item=>item.pool===format),now=Date.now()/1000;
    chartPoints=(selected?.points||[]).filter(point=>point.end>=now-chartDays*86400);
    view.querySelectorAll('[data-chart-days]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.chartDays)===chartDays)));
    const cursor=$('homePulseCursor');cursor.hidden=chartPoints.length<2;cursor.max=String(Math.max(0,chartPoints.length-1));cursor.value=cursor.max;
    $('homePulseDelta').textContent=`${title(format)} · 7 days: ${signed(selected?.weekly??null)}${selected?.weekly!==null&&selected?.weekly!==undefined?' points':''} · 30 days: ${signed(selected?.monthly??null)}${selected?.monthly!==null&&selected?.monthly!==undefined?' points':''}. Changes need a rated observation before the window.`;
    $('homePulseReadout').textContent=chartPoints.length?`${date(chartPoints.at(-1).end)} · ${chartPoints.at(-1).rating}`:`${title(format)} · no rated observations in this window`;
    if(chartPoints.length<2){$('homePulseChart').innerHTML='<p class="homeChartEmpty">Two dated rated observations are needed for a chart. Try a longer window or another format.</p>';return;}
    const min=chartPoints.reduce((n,point)=>Math.min(n,point.rating),Infinity),max=chartPoints.reduce((n,point)=>Math.max(n,point.rating),-Infinity),span=Math.max(1,max-min),first=chartPoints[0].end,last=chartPoints.at(-1).end;
    const step=Math.max(1,Math.ceil(chartPoints.length/60));
    const path=chartPoints.filter((_,i)=>i%step===0||i===chartPoints.length-1).map((point,i)=>`${i?'L':'M'}${(8+484*(point.end-first)/Math.max(1,last-first)).toFixed(1)} ${(95-75*(point.rating-min)/span).toFixed(1)}`).join(' ');
    $('homePulseChart').innerHTML=`<svg viewBox="0 0 500 112" role="img" aria-label="${esc(title(format))} saved ratings over ${chartDays} days"><path class="homePulseArea" d="${path} L492 110 L8 110 Z"/><path class="homePulseLine" d="${path}"/><line id="homeChartMarker" x1="492" x2="492" y1="8" y2="105"/></svg>`;
  }
  function renderPulse() {
    const focused=document.activeElement?.dataset.pulseFormat;
    $('homePulsePools').innerHTML=pulse.map(item=>`<button type="button" data-pulse-format="${item.pool}" aria-pressed="${item.pool===format}"><span>${title(item.pool)}</span><strong>${item.latest??'—'}</strong><small>Saved rating</small></button>`).join('');
    if(focused)$('homePulsePools').querySelector(`[data-pulse-format="${focused}"]`)?.focus({preventScroll:true});
    $('homeMilestoneList').innerHTML=pulse.filter(item=>item.best!==null).map(item=>`<article><span class="homeEyebrow">${title(item.pool)} personal best</span><strong>${item.best}</strong><small>Highest saved rated observation</small></article>`).join('')||'<p class="homeDataNote">Your first saved rated game starts your personal rating record.</p>';
    renderChart();
  }
  function renderFindings() {
    const findings=report?.findings||[],visible=showAll?findings:findings.slice(0,3);
    $('homeGrowthList').innerHTML=visible.map((finding,index)=>`<article class="homeGrowthCard"><div class="homeGrowthMeta"><span>${finding.source==='engine-review'?'Saved Stockfish evidence':'Game-history observation'}</span><b>${esc(finding.pool)}</b></div><h3>${esc(finding.title)}</h3><div class="homeEvidenceBar" role="img" aria-label="${finding.games} supporting games in ${finding.denominator} eligible games"><span style="width:${Math.min(100,100*finding.games/Math.max(1,finding.denominator))}%"></span></div><small>${finding.games} supporting / ${finding.denominator} eligible games · ${esc(finding.reliability)}${finding.depth?` · depth ≥${finding.depth}`:''}</small><small>${date(finding.start)} – ${date(finding.end)} UTC</small><p class="homeGrowthTrend">${finding.trend?`${finding.trend.direction} · ${signed(Math.round(finding.trend.delta))} percentage points · ${finding.trend.recentGames} recent / ${finding.trend.previousGames} previous games`:'Trend unavailable: more comparable games needed.'}</p><details><summary>Explore the evidence</summary><p>${esc(finding.text)}</p>${finding.representatives.map((row,i)=>`<button type="button" class="homeEvidenceGame" data-evidence-game="${index}:${i}">Review vs ${esc(row.opponent)} · ${date(row.end)} ${arrow}</button>${row.fen?`<button type="button" class="homeEvidenceGame" data-evidence-position="${index}:${i}">Position before ${esc(row.badMove)} · move ${row.moveNumber} ${arrow}</button>`:''}`).join('')}</details></article>`).join('')||'<div class="homeGrowthEmpty"><strong>No pattern meets the evidence minimum yet.</strong><p>That is not a diagnosis of strengths or weaknesses. Review a saved game, or check existing engine reviews to find a useful practice target.</p></div>';
    const more=$('homeShowAllWeaknesses');more.hidden=findings.length<=3;more.setAttribute('aria-expanded',String(showAll));more.textContent=showAll?'Show three priorities':`Explore all ${findings.length} patterns`;
    const first=findings[0];
    if(first){$('homeInsightText').textContent=first.text;$('homeReviewSuggestion').hidden=false;$('homeReviewSuggestion').textContent='Review a supporting game';$('homeReviewSuggestion').onclick=()=>openGame(first.representatives[0].key,Math.max(0,(first.representatives[0].ply||1)-1));}
    else {const row=report?.rows.find(row=>row.result==='L')||report?.rows[0];$('homeInsightText').textContent=row?'Choose one decision from a recent saved game to study. No recurring pattern meets the evidence threshold yet.':'Import your games to discover personal patterns and a useful next step.';$('homeReviewSuggestion').hidden=!row;$('homeReviewSuggestion').textContent='Review a recent game';$('homeReviewSuggestion').onclick=()=>{if(row)openGame(row.key)};}
    renderContinue();
  }
  async function checkReviews() {
    cancel();controller=new AbortController();const signal=controller.signal,token=generation,currentUser=user;
    $('homeCheckWeaknesses').disabled=true;$('homeCancelWeaknesses').hidden=false;$('homeWeaknessStatus').textContent='Checking up to 60 recent saved reviews. No new engine analysis…';
    try {
      const {inspectWeaknessReviews}=await import('./weakness-reviews.js');signal.throwIfAborted();
      const reviews=await inspectWeaknessReviews(report.rows,{signal,onProgress:(done,total)=>{if(token===generation)$('homeWeaknessStatus').textContent=`Checking saved reviews: ${done} / ${total}`;}});
      if(token!==generation||user!==currentUser)return;
      report=buildWeaknessReport(games,user,{reviews});renderFindings();
      $('homeWeaknessStatus').textContent=`${report.reviewed} eligible saved Stockfish reviews / ${report.scanned} games checked, from ${report.rows.length} games in the 90-day selection. Missing, partial, low-depth or invalid reviews are excluded; unchecked games are not treated as mistake-free.`;
      const verified=new Set(reviews.filter(review=>review.facts).map(review=>review.row.key));
      view.querySelectorAll('.homeVerifiedBadge').forEach(badge=>badge.remove());
      view.querySelectorAll('.homeRecentCard').forEach(card=>{if(verified.has(card.dataset.gameKey)&&!card.querySelector('.homeVerifiedBadge'))card.insertAdjacentHTML('beforeend','<small class="homeVerifiedBadge">Verified review available</small>');});
    } catch(error) {if(token===generation)$('homeWeaknessStatus').textContent=error.name==='AbortError'?'Review check paused. Your saved data is unchanged.':'Saved reviews could not be checked. Reconnect if the chess library is unavailable, then retry.';}
    finally {if(token===generation){controller=null;$('homeCheckWeaknesses').disabled=false;$('homeCancelWeaknesses').hidden=true;}}
  }
  section.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.pulseFormat){format=button.dataset.pulseFormat;renderPulse();}
    if(button.dataset.chartDays){chartDays=Number(button.dataset.chartDays);renderChart();}
  });
  $('homePulseCursor').addEventListener('input',event=>{
    const index=Number(event.target.value),point=chartPoints[index];if(!point)return;
    $('homePulseReadout').textContent=`${date(point.end)} · ${point.rating} · observation ${index+1}/${chartPoints.length}`;
    const x=8+484*(point.end-chartPoints[0].end)/Math.max(1,chartPoints.at(-1).end-chartPoints[0].end);$('homeChartMarker')?.setAttribute('x1',x);$('homeChartMarker')?.setAttribute('x2',x);
  });
  growth.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    const key=button.dataset.evidenceGame||button.dataset.evidencePosition;if(!key)return;
    const [a,b]=key.split(':').map(Number),row=report?.findings[a]?.representatives[b];if(!row)return;
    if(button.dataset.evidencePosition){document.getElementById('boardLabTab')?.click();window.dispatchEvent(new CustomEvent('loadLabFen',{detail:{fen:row.fen}}));}
    else openGame(row.key,Math.max(0,(row.ply||1)-1));
  });
  $('homeCheckWeaknesses').addEventListener('click',()=>void checkReviews());
  $('homeCancelWeaknesses').addEventListener('click',()=>{cancel();$('homeWeaknessStatus').textContent='Review check paused. Your saved data is unchanged.';});
  $('homeShowAllWeaknesses').addEventListener('click',()=>{showAll=!showAll;renderFindings();});
  $('homeResumeReview').addEventListener('click',()=>{const last=resume();if(last)openGame(last.key,last.ply);});
  $('homeContinuePractice').addEventListener('click',()=>{$('homeFindTraining').click();$('homeTrainingStatus').closest('section').scrollIntoView({block:'start'});});
  $('homeContinueOpening').addEventListener('click',()=>{
    const opening=report?.history.find(item=>item.kind==='opening'),row=opening?.rows[0];if(!row)return;
    document.getElementById('boardLabTab')?.click();window.dispatchEvent(new CustomEvent('loadLabPgn',{detail:{pgn:row.game.pgn,label:row.opening,orientation:row.white?'white':'black',maxPlies:24}}));
  });
  return {
    update(nextGames,nextUser) {
      if(games!==nextGames||user!==nextUser){cancel();user=nextUser;games=nextGames;showAll=false;report=buildWeaknessReport(games,user);pulse=buildChessPulse(games,user);if(!pulse.find(item=>item.pool===format)?.points.length)format=pulse.find(item=>item.points.length)?.pool||'rapid';$('homeWeaknessStatus').textContent='Engine evidence has not been checked. No new analysis runs here.';}
      $('homeViewHeading').textContent=nextUser?`Your next good move, ${nextUser}.`:'Your next good move.';renderPulse();renderFindings();
    },reset,
    pause(){if(controller){cancel();$('homeWeaknessStatus').textContent='Review check paused. Return and check saved reviews when ready.';}},
    invalidateReviews(){cancel();view.querySelectorAll('.homeVerifiedBadge').forEach(badge=>badge.remove());if(report){report=buildWeaknessReport(games,user);renderFindings();$('homeWeaknessStatus').textContent='Saved review evidence changed. Check again to refresh these patterns.';}},
    remember(key,ply=0){if(!user||!games.some(game=>gameIdentity(game)===key&&[game.white?.username,game.black?.username].some(name=>String(name||'').toLowerCase()===user)))return;try{localStorage.setItem('chess-home-review:'+user,JSON.stringify({key,ply:Number.isSafeInteger(ply)&&ply>=0?ply:0}));renderContinue();}catch{}},
    rememberPosition(){const last=resume();if(last){const active=document.querySelector('#moves .move.active');if(active)this.remember(last.key,[...document.querySelectorAll('#moves .move')].indexOf(active)+1);}},
  };
}
