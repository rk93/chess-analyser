import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm';
const $=id=>document.getElementById(id),glyph={w:{p:'♙',n:'♘',b:'♗',r:'♖',q:'♕',k:'♔'},b:{p:'♟',n:'♞',b:'♝',r:'♜',q:'♛',k:'♚'}};
let active=false,loaded=false,refreshId=0;
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const username=()=>String(localStorage.getItem('chess-username')||'').trim().toLowerCase();
function gameResult(g,u){
 const white=String(g.white?.username||'').toLowerCase()===u,me=white?g.white:g.black,opponent=white?g.black:g.white;
 const result=me?.result==='win'?'Win':['checkmated','resigned','timeout','lose'].includes(me?.result)?'Loss':'Draw';
 return {result,opponent:opponent?.username||'Opponent',rating:me?.rating||'—',white};
}
function openingName(pgn){
 const tag=String(pgn||'').match(/^\[Opening\s+"([^"]+)"\]/m);
 if(tag)return tag[1];
 const url=String(pgn||'').match(/^\[ECOUrl\s+"([^"]+)"\]/m)?.[1]||'';
 return url?decodeURIComponent(url.split('/').pop()||'').replace(/-\d.*$/,'').replace(/-/g,' '):'';
}
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
async function readRecent(limit=5){
 const db=await openDB();
 return new Promise((resolve,reject)=>{
  const values=[],tx=db.transaction('games','readonly'),store=tx.objectStore('games'),index=store.indexNames.contains('end_time')?store.index('end_time'):store;
  const req=index.openCursor(null,'prev');
  req.onsuccess=()=>{const cursor=req.result;if(!cursor||values.length===limit)return;values.push(cursor.value);cursor.continue()};
  tx.oncomplete=()=>{db.close();resolve(values)};
  tx.onerror=()=>{db.close();reject(tx.error)};
 });
}
async function readSummary(){
 const db=await openDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('games','readonly'),store=tx.objectStore('games'),req=store.openCursor();
  let total=0,wins=0,known=0,lastRating='—';const openings=new Map(),u=username();
  req.onsuccess=()=>{const cursor=req.result;if(!cursor)return;
   const g=cursor.value,r=gameResult(g,u);total++;if(r.result==='Win')wins++;if(u&&(String(g.white?.username||'').toLowerCase()===u||String(g.black?.username||'').toLowerCase()===u))known++;
   const opening=openingName(g.pgn);if(opening)openings.set(opening,(openings.get(opening)||0)+1);
   cursor.continue();
  };
  tx.oncomplete=()=>{db.close();const top=[...openings].sort((a,b)=>b[1]-a[1])[0];resolve({total,wins,known,opening:top?.[0]||'',openingCount:top?.[1]||0})};
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
 <div id="homeMetrics" class="homeMetrics" aria-live="polite"><div><strong>—</strong><small>Games</small></div><div><strong>—</strong><small>Win rate</small></div><div><strong>—</strong><small>Saved games</small></div></div>
 <section class="homeDailyCard"><div class="homeSectionTop"><h2>Daily puzzle</h2><span>♟ A new challenge each day</span></div><div class="homeDailyBody"><span class="homeDailyIcon" aria-hidden="true">♞</span><div><strong>Find today's best move</strong><p>Practise your calculation with Pip.</p></div></div><button type="button" class="homePrimary" id="homeSolvePuzzle">Solve puzzle →</button></section>
 <section class="homeRecentSection"><div class="homeSectionTop"><h2>Recent games</h2><button id="homeViewAllGames" type="button">All games →</button></div><div class="homeRecentScroller" id="homeRecentScroller" role="region" aria-label="Five most recent games, swipe horizontally" tabindex="0"><p class="homeEmpty">Your recent games will appear here after syncing.</p></div></section>
 <section class="homeOpeningCard"><div class="homeSectionTop"><h2>Most played opening</h2><span>♟</span></div><strong id="homeOpeningName">Sync games to discover your openings</strong><p id="homeOpeningCount">Based on your saved games</p></section>
 <section class="homeInsightCard"><h2>Pip's insight</h2><p id="homeInsightText">Every great move starts with one good idea. Review a game or solve a puzzle today.</p></section>`;
 const library=$('libraryView');library?.parentNode?.insertBefore(view,library);
 button.addEventListener('click',show);
 $('homeViewAllGames').addEventListener('click',()=>$('gamesTab')?.click());
 $('homeSolvePuzzle').addEventListener('click',()=>$('puzzlesTab')?.click());
 document.addEventListener('click',e=>{
  const tab=e.target.closest?.('.homeTabs .homeTab');
  if(tab&&tab.id!=='homeDashboardTab')hide();
 },true);
 window.addEventListener('chessImportFinished',()=>{loaded=false;if(active)void refresh()});
 window.addEventListener('requestChessSync',()=>{loaded=false});
}
function hide(){if(!active)return;active=false;const view=$('homeView');if(view)view.hidden=true}
function show(){
 active=true;
 for(const id of ['libraryView','boardLabView','explorerView','puzzlesView','analyticsView','topPlayersView','settingsView']){
  if($(id))$(id).hidden=true;
 }
 if($('analysisView'))$('analysisView').style.display='none';
 $('homeView').hidden=false;
 document.querySelectorAll('.homeTabs .homeTab').forEach(b=>b.classList.toggle('active',b.id==='homeDashboardTab'));
 window.scrollTo({top:0,behavior:'instant'});
 if(!loaded)void refresh();
}
async function refresh(){
 const id=++refreshId,scroller=$('homeRecentScroller'),user=username();
 try{
  const recent=await readRecent(5);if(id!==refreshId)return;
  scroller.replaceChildren();
  for(const [index,g] of recent.entries()){
   const result=gameResult(g,user),card=document.createElement('button');
   card.type='button';card.className='homeRecentCard';
   card.setAttribute('aria-label','Review '+result.result.toLowerCase()+' game against '+result.opponent);
   card.innerHTML=miniBoard(g.pgn)+'<span class="homeRecentTitle">'+escapeHtml(result.opponent)+'</span><span class="homeRecentDetails"><b class="homeResult '+result.result.toLowerCase()+'">'+result.result+'</b> · '+escapeHtml(g.time_class||'Game')+' · '+escapeHtml(result.rating)+'</span>';
   card.addEventListener('click',()=>{
    hide();
    const libraryCards=[...document.querySelectorAll('#games > .game.gameWithAvatar')];
    if(libraryCards[index])libraryCards[index].click();
    else $('gamesTab')?.click();
   });
   scroller.appendChild(card);
  }
  if(!recent.length)scroller.innerHTML='<p class="homeEmpty">Sync your Chess.com games to see the five most recent boards here.</p>';
  loaded=true;
  // Summary work happens after recent cards render. No engine or network requests.
  await new Promise(resolve=>setTimeout(resolve,0));
  const stats=await readSummary();if(id!==refreshId)return;
  const percent=stats.total?Math.round(stats.wins*100/stats.total):0;
  $('homeMetrics').innerHTML='<div><strong>'+stats.total.toLocaleString()+'</strong><small>Games</small></div><div><strong>'+(stats.total?percent+'%':'—')+'</strong><small>Wins</small></div><div><strong>'+recent.length+'</strong><small>Recent shown</small></div>';
  $('homeOpeningName').textContent=stats.opening||'No opening names recorded yet';
  $('homeOpeningCount').textContent=stats.openingCount?stats.openingCount.toLocaleString()+' saved games with this opening':'Your next sync may include opening information';
  $('homeInsightText').textContent=stats.total>=5?'You have '+stats.total.toLocaleString()+' saved games. '+(stats.opening?'Your most frequent opening is '+stats.opening+'. ':'')+'Review a recent loss to find your next improvement.':'Play a few more games, then Pip can start finding useful patterns.';
 }catch(e){if(id===refreshId){scroller.innerHTML='<p class="homeEmpty">Saved games are temporarily unavailable. Open Games to retry.</p>';console.warn('Home dashboard',e)}}
}
function init(){
 create();show();
 // Initial navigation is Home, not the Games library.
 history.replaceState({...(history.state||{}),chessNav:true,screen:'homeDashboardTab'},'');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
