import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm';
import { buildPlayerInsights } from './player-insights.js';
import { findPersonalTraining, invalidatePersonalTraining } from './personal-training.js';
import { createHomeCommandCentre } from './home-command-centre.js';
const $=id=>document.getElementById(id),glyph={w:{p:'♙',n:'♘',b:'♗',r:'♖',q:'♕',k:'♔'},b:{p:'♟',n:'♞',b:'♝',r:'♜',q:'♛',k:'♚'}};
let active=false,loaded=false,refreshId=0,loadedUser='',savedGames=[],command=null;
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const username=()=>String(localStorage.getItem('chess-username')||'').trim().toLowerCase();
function miniBoard(pgn){
 const board=new Chess();
 try{board.loadPgn(String(pgn||''));}catch{}
 const grid=board.board();
 const squares=grid.flatMap((rank,r)=>rank.map((piece,c)=>{
  const light=(r+c)%2===0;
  return '<span class="homeMiniSquare '+(light?'light':'dark')+'">'+(piece?'<span class="homeMiniPiece '+(piece.color==='w'?'white':'black')+'">'+glyph[piece.color][piece.type]+'</span>':'')+'</span>';
 })).join('');
 return '<span class="homeMiniBoard" aria-hidden="true">'+squares+'</span>';
}
function openDB(){
 return new Promise((resolve,reject)=>{const request=indexedDB.open('rk93-chess-analyser',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onupgradeneeded=()=>request.result.createObjectStore('games',{keyPath:'_key'}).createIndex('end_time','end_time')});
}
async function readGames(){
 const db=await openDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('games','readonly'),req=tx.objectStore('games').getAll();
  tx.oncomplete=()=>{db.close();resolve(req.result||[])};
  tx.onerror=()=>{db.close();reject(tx.error)};
 });
}
function create(){
 if($('homeView'))return;
 const nav=document.querySelector('.homeTabs'),games=$('gamesTab'),button=document.createElement('button');
 button.type='button';button.id='homeDashboardTab';button.className='homeTab';button.innerHTML='<span class="homeNavSymbol" aria-hidden="true">⌂</span><span class="navLabel">Home</span>';
 nav?.insertBefore(button,games);
 const view=document.createElement('section');view.id='homeView';view.hidden=true;
 view.innerHTML=`<header class="homeHero"><span class="coachAvatar coachWelcome homePip" aria-hidden="true"></span><div><h1>Your chess journey</h1><p>A little better, every game.</p></div></header>
 <button id="homeAnalyticsLink" class="homeAnalyticsLink" type="button" aria-label="View your full chess analytics"><span class="homeAnalyticsHeading">Your performance <span aria-hidden="true">↗</span></span><div id="homeMetrics" class="homeMetrics" aria-live="polite"><div><strong>—</strong><small>Games</small></div><div><strong>—</strong><small>Win rate</small></div><div><strong>—</strong><small>Latest rating</small></div></div><span class="homeAnalyticsFooter">View full analytics →</span></button>
 <section class="homeInsightCard"><div class="homeSectionTop"><h2>Your next step</h2><span>Pip's insight</span></div><p id="homeInsightText">Import your games to discover your next step.</p><button id="homeReviewSuggestion" class="homeTextButton" type="button" hidden>Review this game →</button></section>
 <section class="homeWeekCard" aria-labelledby="homeWeekTitle"><div class="homeSectionTop"><h2 id="homeWeekTitle">Your last 7 days</h2><span>Saved games</span></div><p id="homeWeekSummary" aria-live="polite">No games imported yet.</p><div id="homeWeeklyRatings" class="homeWeeklyRatings"></div><p class="homeDataNote">A rolling 7-day window ending now. Missing archives can make this report incomplete.</p></section>
 <section class="homeTrainingCard" aria-labelledby="homeTrainingTitle"><div class="homeSectionTop"><h2 id="homeTrainingTitle">Learn from your games</h2><span>Stockfish verified</span></div><p id="homeTrainingStatus" role="status"></p><button id="homeFindTraining" class="homeTextButton" type="button">Find my practice positions →</button><div id="homeTrainingList"></div><p id="homeTrainingProgress" class="homeDataNote"></p></section>
 <section class="homeRecentSection"><div class="homeSectionTop"><h2>Recent games</h2><button id="homeViewAllGames" type="button">All games →</button></div><div class="homeRecentScroller" id="homeRecentScroller" role="region" aria-label="Five most recent games, swipe horizontally" tabindex="0"><p class="homeEmpty">Your recent games will appear here after syncing.</p></div></section>
 <section class="homeDnaCard" aria-labelledby="homeDnaTitle"><div class="homeSectionTop"><h2 id="homeDnaTitle">Your Chess DNA</h2><label class="homePoolLabel">Time control<select id="homeTimeClass"><option value="all">All formats</option><option value="rapid">Rapid</option><option value="blitz">Blitz</option><option value="bullet">Bullet</option><option value="daily">Daily</option><option value="other">Other</option></select></label></div><p id="homeDnaScope" class="homeDataNote"></p><div id="homeColorResults" class="homeColorResults"></div><p id="homeStreak"></p><div id="homeRatingTrends"></div><h3>Opening intelligence</h3><div id="homeOpeningInsights"></div><p class="homeDataNote">Score = wins + half of draws. Openings are separated by colour and time control. Five completed games are needed per opening group; these are observations, not proof that an opening causes your results.</p></section>
 <section class="homeOpeningCard"><div class="homeSectionTop"><h2>Most played opening</h2><span>♟</span></div><strong id="homeOpeningName">Sync games to discover your openings</strong><p id="homeOpeningCount">Based on your saved games</p></section>
 <section class="homeDailyCard"><div class="homeSectionTop"><h2>Daily puzzle</h2><span>♟ A new challenge each day</span></div><div class="homeDailyBody"><span class="homeDailyIcon" aria-hidden="true">♞</span><div><strong>Find today's best move</strong><p>Practise your calculation with Pip.</p></div></div><button type="button" class="homePrimary" id="homeSolvePuzzle">Solve puzzle →</button></section>`;
 const library=$('libraryView');library?.parentNode?.insertBefore(view,library);
 command=createHomeCommandCentre(view,requestGame);
 button.addEventListener('click',show);
 $('homeAnalyticsLink').addEventListener('click',()=>{const tab=$('analyticsTab');if(tab)tab.click();});
 $('homeViewAllGames').addEventListener('click',()=>$('gamesTab')?.click());
 $('homeSolvePuzzle').addEventListener('click',()=>$('puzzlesTab')?.click());
 $('homeTimeClass').addEventListener('change',()=>renderInsights(savedGames,username()));
 $('homeFindTraining').addEventListener('click',()=>void findPersonalTraining(savedGames));
 invalidatePersonalTraining();
 document.addEventListener('click',e=>{
  const tab=e.target.closest?.('.homeTabs .homeTab');
  if(tab)command.rememberPosition();
  if(tab&&tab.id!=='homeDashboardTab')hide();
 },true);
 const invalidate=()=>{loaded=false;refreshId++;command.reset();invalidatePersonalTraining();if(active)void refresh()};
 window.addEventListener('chessImportFinished',invalidate);
 window.addEventListener('chessGamesImported',invalidate);
 window.addEventListener('storage',e=>{if(e.key==='chess-username'||e.key===null)invalidate()});
 window.addEventListener('savedGameOpened',event=>{command.remember(event.detail?.key,event.detail?.ply);hide()});
 window.addEventListener('gameReviewUpdated',()=>{invalidatePersonalTraining();command.invalidateReviews()});
 window.addEventListener('requestChessSync',()=>{loaded=false});
 window.addEventListener('popstate',()=>command.rememberPosition());
}
function hide(){command?.rememberPosition();command?.pause();if(!active)return;active=false;const view=$('homeView');if(view)view.hidden=true}
function show(){
 active=true;
 for(const id of ['libraryView','boardLabView','explorerView','puzzlesView','analyticsView','topPlayersView','settingsView']){
  if($(id))$(id).hidden=true;
 }
 if($('analysisView'))$('analysisView').style.display='none';
 $('homeView').hidden=false;
 document.querySelectorAll('.homeTabs .homeTab').forEach(b=>b.classList.toggle('active',b.id==='homeDashboardTab'));
 window.scrollTo({top:0,behavior:'instant'});
 if(!loaded||loadedUser!==username())void refresh();
}
const percent=value=>value===null?'—':Math.round(value)+'%';
const signed=value=>(value>0?'+':'')+value;
const title=value=>value.charAt(0).toUpperCase()+value.slice(1);
function requestGame(key,ply=0){window.dispatchEvent(new CustomEvent('requestOpenSavedGame',{detail:{key,ply}}))}
function renderInsights(games,user){
 const stats=buildPlayerInsights(games,user),latest=stats.ratings[0];
 $('homeMetrics').innerHTML='<div><strong>'+stats.totals.games.toLocaleString()+'</strong><small>Your games</small></div><div><strong>'+percent(stats.totals.winRate)+'</strong><small>Win rate'+(stats.totals.unknown?' · known results':'')+'</small></div><div><strong>'+(latest?.latest??'—')+'</strong><small>'+escapeHtml(latest?title(latest.pool)+' rating':'Rated games needed')+'</small></div>';
 const week=stats.week;
 $('homeWeekSummary').textContent=week.games?`${week.games} games · ${week.wins}W / ${week.draws}D / ${week.losses}L${week.unknown?` · ${week.unknown} unknown results`:''}. ${signed(week.games-week.previous.games)} games compared with the previous 7 days.`:'No saved games in the last 7 days. Import recent games to build your weekly report.';
 $('homeWeeklyRatings').innerHTML=stats.ratings.filter(item=>item.weeklyDelta!==null).map(item=>`<span>${escapeHtml(title(item.pool))} <b>${signed(item.weeklyDelta)}</b> rating points</span>`).join('');
 $('homeOpeningName').textContent=stats.commonOpening?.[0]||'No opening names recorded yet';
 $('homeOpeningCount').textContent=stats.commonOpening?stats.commonOpening[1].toLocaleString()+' saved games with this opening':'Your next sync may include opening information';
 const selected=$('homeTimeClass').value,dna=buildPlayerInsights(games,user,{pool:selected});
 $('homeDnaScope').textContent=`${dna.totals.games} saved standard-chess games${selected==='all'?'':` · ${title(selected)}`}${dna.totals.unknown?` · ${dna.totals.unknown} unknown results excluded from percentages`:''}`;
 $('homeColorResults').innerHTML=[['White',dna.white],['Black',dna.black]].map(([color,data])=>`<div><strong>${color} · ${percent(data.score)} score</strong><span>${data.wins}W / ${data.draws}D / ${data.losses}L · ${data.known} completed</span></div>`).join('');
 $('homeStreak').textContent=dna.streak.count?`${dna.streak.count}-game ${dna.streak.result==='W'?'winning':'losing'} streak in this selection.`:'No current winning or losing streak in this selection.';
 $('homeRatingTrends').innerHTML=dna.ratings.map(item=>{
  const points=item.points,step=Math.max(1,Math.ceil(points.length/60)),sample=points.filter((_,i)=>i%step===0||i===points.length-1);
  const min=Math.min(...sample.map(row=>row.rating)),max=Math.max(...sample.map(row=>row.rating)),span=Math.max(1,max-min);
  const path=sample.map((row,i)=>(i?'L':'M')+(8+264*i/Math.max(1,sample.length-1)).toFixed(1)+' '+(64-48*(row.rating-min)/span).toFixed(1)).join(' ');
  return `<div class="homeRatingRow"><div><strong>${escapeHtml(title(item.pool))} · ${item.latest}</strong><span>${item.delta===null?'Two rated observations needed':signed(item.delta)+' since first saved rating'} · best ${item.best}</span></div>${points.length>1?`<svg viewBox="0 0 280 80" role="img" aria-label="${escapeHtml(title(item.pool))} saved rating trend"><path d="${path}"/></svg>`:''}</div>`;
 }).join('')||'<p class="homeDataNote">Import rated games to see rating trends. Each time control has its own rating.</p>';
 const entries=[['Strongest observed',dna.strongest],['Room to explore',dna.weakest]].filter(([,group],i,list)=>group&&(i===0||group!==list[0][1]));
 $('homeOpeningInsights').innerHTML=entries.map(([label,group])=>`<article class="homeOpeningInsight"><span>${label}</span><strong>${escapeHtml(group.name)}</strong><p>${group.white?'White':'Black'} · ${escapeHtml(title(group.pool))} · ${group.known} games · ${percent(group.score)} score</p><small>${group.wins}W / ${group.draws}D / ${group.losses}L</small></article>`).join('')||'<p class="homeDataNote">Play at least five completed games with the same opening, colour and time control to compare opening results.</p>';
 command.update(games,user);
}
async function refresh(){
 const id=++refreshId,scroller=$('homeRecentScroller'),user=username();
 try{
  const games=await readGames();if(id!==refreshId||user!==username())return;
  savedGames=games;loadedUser=user;
  const recent=buildPlayerInsights(games,user).rows.slice(0,5);
  scroller.replaceChildren();
  for(const row of recent){
   const g=row.game,result={result:({W:'Win',D:'Draw',L:'Loss'})[row.result]||'Unknown',opponent:row.opponent,rating:row.rating??'—'},card=document.createElement('button');
   card.type='button';card.className='homeRecentCard';
   card.setAttribute('aria-label','Review '+result.result.toLowerCase()+' game against '+result.opponent);
   card.innerHTML=miniBoard(g.pgn)+'<span class="homeRecentTitle">'+escapeHtml(result.opponent)+'</span><span class="homeRecentDetails"><b class="homeResult '+result.result.toLowerCase()+'">'+result.result+'</b> · '+escapeHtml(g.time_class||'Game')+' · '+escapeHtml(result.rating)+'</span><small class="homeRecentOpening">'+escapeHtml(row.opening||'Opening not recorded')+'</small>';
   card.dataset.gameKey=row.key;
   card.addEventListener('click',()=>requestGame(row.key));
   scroller.appendChild(card);
  }
  if(!recent.length)scroller.innerHTML='<p class="homeEmpty">Sync your Chess.com games to see the five most recent boards here.</p>';
  loaded=true;
  // No Stockfish or network work: all summaries use the player's saved games.
  await new Promise(resolve=>setTimeout(resolve,0));
  if(id!==refreshId||user!==username())return;
  renderInsights(games,user);
 }catch(e){if(id===refreshId){scroller.innerHTML='<p class="homeEmpty">Saved games are temporarily unavailable. Open Games to retry.</p>';console.warn('Home dashboard',e)}}
}
function init(){
 create();show();
 // Initial navigation is Home, not the Games library.
 history.replaceState({...(history.state||{}),chessNav:true,screen:'homeDashboardTab'},'');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
