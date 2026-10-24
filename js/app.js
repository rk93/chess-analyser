import { getLocalStockfish } from './local-stockfish.js';
import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm';
const $=id=>document.getElementById(id);
const DB_NAME='rk93-chess-analyser', DB_VERSION=1, STORE='games';
const PREF='chess-analyser-pref:';
function preference(k,fallback){return localStorage.getItem(PREF+k)||fallback}
function pieceSvg(color,type,extraClass=''){
  const code={p:'P',r:'R',n:'N',b:'B',q:'Q',k:'K'}[type],side=color==='w'?'w':'b',cls=color==='w'?'whitePiece':'blackPiece';
  const folders={neo:'chess_kaneo',bases:'chess_kaneo_midnight',classic:'chess_maestro_bw'};
  const folder=folders[preference('pieces','neo')]||folders.neo;
  const src=`https://cdn.jsdelivr.net/gh/Kadagaden/chess-pieces@master/${folder}/${side}${code}.svg`;
  return `<img class="piece ${cls} ${extraClass}" src="${src}" draggable="false" alt="" aria-hidden="true">`;
}
let selectedGame=null, mainMoves=[], currentChess=new Chess(), currentPly=0, orientation='white', selectedSquare=null, legalTargets=[], variation=false, lastMove=null;
const evalCache=new Map();
let audioCtx=null;
function playMoveSound(capture=false){if(preference('sound','on')==='off')return;try{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.value=capture?235:330;g.gain.setValueAtTime(.045,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+.07);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+.075)}catch{}}
queueMicrotask(()=>{const e=$('enginePieceIcon');if(e)e.innerHTML=pieceSvg('b','n')});
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE)){const s=db.createObjectStore(STORE,{keyPath:'_key'});s.createIndex('end_time','end_time')}};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function putGames(games){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite'),s=tx.objectStore(STORE);for(const g of games){g._key=g.url||`${g.end_time}-${g.white?.username}-${g.black?.username}`;s.put(g)}tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}})}
async function allGames(){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).getAll();r.onsuccess=()=>{db.close();resolve(r.result.sort((a,b)=>(b.end_time||0)-(a.end_time||0)))};r.onerror=()=>{db.close();reject(r.error)}})}
async function getJSON(url){const r=await fetch(url,{headers:{Accept:'application/json'}});if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);return r.json()}
function gameKey(g){return g.url||`${g.end_time}-${g.white?.username}-${g.black?.username}`}
function syncMetaKey(u){return `chess-sync-meta:${u.toLowerCase()}`}
function readSyncMeta(u){try{return JSON.parse(localStorage.getItem(syncMetaKey(u))||'null')||{archives:[],lastSync:0}}catch{return {archives:[],lastSync:0}}}
function writeSyncMeta(u,meta){localStorage.setItem(syncMetaKey(u),JSON.stringify(meta))}
const SYNC_INTERVAL_MS=24*60*60*1000;
let syncInFlight=null;
function userGames(games,u){const name=u.toLowerCase();return games.filter(g=>String(g.white?.username||'').toLowerCase()===name||String(g.black?.username||'').toLowerCase()===name)}
async function sync({automatic=false}={}){
 if(syncInFlight)return syncInFlight;
 syncInFlight=(async()=>{
 const button=$('sync'),status=$('status');button.disabled=true;
 try{
  const u=$('user').value.trim();if(!u){if(!automatic)throw new Error('Enter a Chess.com username');status.textContent='Enter a Chess.com username to import games.';return}
  const previous=localStorage.getItem('chess-username')||'';
  localStorage.setItem('chess-username',u);
  const before=userGames(await allGames(),u),meta=readSyncMeta(u);
  const last=Number(meta.lastSync)||0;
  // All entry points respect the same strict greater-than-one-day freshness guard.
  if(last>0&&Date.now()-last<=SYNC_INTERVAL_MS){
   renderGames(before,u);
   status.textContent=`Using ${before.length} saved games · next check after 24 hours`;
   if(previous.toLowerCase()!==u.toLowerCase())window.dispatchEvent(new Event('chessImportFinished'));
   return;
  }
  status.textContent=before.length?'Checking for new Chess.com games…':'Importing Chess.com history…';
  const response=await getJSON(`https://api.chess.com/pub/player/${encodeURIComponent(u)}/games/archives`);
  const archives=response.archives||[],known=new Set(meta.archives||[]);
  // Previously imported months are immutable except the current month and recent boundary.
  // On the first import, download all archives; later, only newly discovered months
  // and the latest archive (where today's games are still arriving).
  const targets=before.length
   ? [...new Set([...archives.filter(x=>!known.has(x)),...archives.slice(-1)])]
   : archives;
  const existing=new Set(before.map(gameKey));
  let newCount=0;
  for(let i=0;i<targets.length;i++){
   status.textContent=`Downloading ${i+1}/${targets.length} monthly archives…`;
   const d=await getJSON(targets[i]),batch=(d.games||[]).filter(g=>String(g.white?.username||'').toLowerCase()===u.toLowerCase()||String(g.black?.username||'').toLowerCase()===u.toLowerCase());
   const added=batch.filter(g=>!existing.has(gameKey(g)));
   for(const g of added)existing.add(gameKey(g));
   if(added.length){await putGames(added);newCount+=added.length}
  }
  const games=userGames(await allGames(),u);renderGames(games,u);
  writeSyncMeta(u,{archives:[...archives],lastSync:Date.now()});
  // Refresh dependent views only when the local game collection actually changes.
  if(newCount||previous.toLowerCase()!==u.toLowerCase())window.dispatchEvent(new CustomEvent('chessImportFinished',{detail:{username:u,newCount}}));
  status.textContent=newCount?`${newCount} new games synced · ${games.length} saved`:`Up to date · ${games.length} saved games · next check in 24 hours`;
 }catch(e){status.textContent=(automatic?'Auto-sync failed: ':'Sync failed: ')+e.message}
 finally{button.disabled=false}
 })();
 try{return await syncInFlight}finally{syncInFlight=null}
}
const playerAvatarCache=new Map();
function playerAvatar(username){
  const key=String(username||'').toLowerCase();
  if(!playerAvatarCache.has(key))playerAvatarCache.set(key,getJSON('https://api.chess.com/pub/player/'+encodeURIComponent(key))
    .then(profile=>{const url=profile?.avatar;return typeof url==='string'&&url.startsWith('https://')?url:null})
    .catch(()=>null));
  return playerAvatarCache.get(key);
}
let avatarObserver=null;
function classifyGameTimeControl(tc){
  const s=String(tc||'');if(!s||s.includes('/'))return 'other';
  const [base,increment='0']=s.split('+');const seconds=Number(base),inc=Number(increment);
  if(!Number.isFinite(seconds)||!Number.isFinite(inc))return 'other';
  const effective=seconds+40*inc;
  return effective<180?'bullet':effective<600?'blitz':'rapid';
}
function renderGames(games,u){
  const root=$('games');root.replaceChildren();avatarObserver?.disconnect();
  if(!games.length){const empty=document.createElement('div');empty.className='game';empty.textContent='No saved games yet.';root.appendChild(empty);return}
  avatarObserver=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
    for(const entry of entries){if(!entry.isIntersecting)continue;avatarObserver?.unobserve(entry.target);entry.target.loadAvatar?.()}
  },{rootMargin:'120px'}):null;
  games.forEach(g=>{
    const isWhite=String(g.white?.username||'').toLowerCase()===u.toLowerCase(),me=isWhite?g.white:g.black,opp=isWhite?g.black:g.white;
    const result=me.result==='win'?'Win':(['checkmated','resigned','timeout','lose'].includes(me.result)?'Loss':'Draw');
    const d=document.createElement('div');d.className='game gameWithAvatar';d.tabIndex=0;d.setAttribute('role','button');
    // Filtering uses structured Chess.com fields, never visible text or ratings.
    d.dataset.result=result.toLowerCase();
    d.dataset.speed=String(g.time_class||'').toLowerCase()||classifyGameTimeControl(g.time_control);
    d.dataset.opponent=String(opp.username||'').toLowerCase();
    const avatar=document.createElement('span');avatar.className='gamePlayerAvatar';avatar.textContent=String(opp.username||'?').slice(0,1).toUpperCase();
    const image=document.createElement('img');image.alt='';image.loading='lazy';image.hidden=true;avatar.appendChild(image);
    d.loadAvatar=async()=>{const url=await playerAvatar(opp.username);if(!url||!d.isConnected)return;image.onload=()=>{image.hidden=false;avatar.classList.add('hasAvatar')};image.onerror=()=>{image.hidden=true;avatar.classList.remove('hasAvatar')};image.src=url};
    const body=document.createElement('div');body.className='gamePlayerDetails';
    const title=document.createElement('b');title.textContent=`${me.username} ${me.rating??''} — ${opp.username} ${opp.rating??''}`;
    const info=document.createElement('div');info.className='muted';info.textContent=`${result} · ${formatTimeControl(g.time_control)} · ${new Date((g.end_time||0)*1000).toLocaleString()}`;
    body.append(title,info);d.append(avatar,body);
    d.onclick=()=>openGame(g,u);
    d.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openGame(g,u)}};
    root.appendChild(d);
    // Start loading the first visible page immediately: pagination may hide cards
    // before an IntersectionObserver ever fires on mobile.
    if(root.children.length<=5)d.loadAvatar();
    else if(avatarObserver)avatarObserver.observe(d);
  });
}
function formatTimeControl(tc){if(!tc)return 'Game';if(tc.includes('+')){const [s,i]=tc.split('+').map(Number);return `${Math.round(s/60)}+${i}`}const s=Number(tc);return Number.isFinite(s)?`${Math.round(s/60)} min`:tc}
function parseInitialFen(pgn){const m=pgn.match(/^\[FEN\s+"([^"]+)"\]/m);return m?m[1]:null}
function freshChess(){const fen=parseInitialFen(selectedGame?.pgn||'');return fen?new Chess(fen):new Chess()}
function freshFromPgn(pgn){const c=new Chess();c.loadPgn(pgn);return c}
function openGame(g,u){selectedGame=g;const parsed=freshFromPgn(g.pgn);mainMoves=parsed.history({verbose:true});orientation=g.white.username.toLowerCase()===u.toLowerCase()?'white':'black';currentPly=0;variation=false;selectedSquare=null;lastMove=null;currentChess=freshChess();$('libraryView').style.display='none';$('analysisView').style.display='block';$('gameTitle').textContent=`${g.white.username} ${g.white.rating??''} — ${g.black.username} ${g.black.rating??''}`;$('gameMeta').textContent=`${new Date((g.end_time||0)*1000).toLocaleString()} · ${formatTimeControl(g.time_control)} · ${g.rated?'Rated':'Casual'}`;renderAll();window.scrollTo(0,0)}
function gotoPly(ply){ply=Math.max(0,Math.min(mainMoves.length,ply));const old=currentPly,wasVariation=variation;currentChess=freshChess();lastMove=null;for(let i=0;i<ply;i++){const m=mainMoves[i];lastMove=currentChess.move({from:m.from,to:m.to,promotion:m.promotion})}currentPly=ply;variation=false;selectedSquare=null;legalTargets=[];clearEval();renderBoard();if(wasVariation){renderMoves()}else{const moves=document.querySelectorAll('#moves .move');if(moves.length!==mainMoves.length)renderMoves();else{if(old>0)moves[old-1]?.classList.remove('active');if(ply>0)moves[ply-1]?.classList.add('active')}}$('variationNote').textContent='';renderMobileMoveStrip();if(old!==ply)playMoveSound(lastMove?.captured!=null)}
function renderAll(){renderPlayers();renderBoard();renderMoves();$('variationNote').textContent=variation?'Exploring your variation. Use return to go back to the game.':''}
function renderPlayers(){const topColor=orientation==='white'?'black':'white',bottomColor=orientation,top=topColor==='white'?selectedGame.white:selectedGame.black,bottom=bottomColor==='white'?selectedGame.white:selectedGame.black;const h=(p,c)=>`<span class="playerName">${pieceSvg(c==='white'?'w':'b','p','playerPiece')}<span>${p.username}</span></span><span>${p.rating??''}</span>`;$('topPlayer').innerHTML=h(top,topColor);$('bottomPlayer').innerHTML=h(bottom,bottomColor)}
function squareOrder(){const files=orientation==='white'?['a','b','c','d','e','f','g','h']:['h','g','f','e','d','c','b','a'],ranks=orientation==='white'?[8,7,6,5,4,3,2,1]:[1,2,3,4,5,6,7,8];return ranks.flatMap(r=>files.map(f=>f+r))}
function renderBoard(){const b=$('board');b.innerHTML='';squareOrder().forEach((sq,index)=>{const file=sq.charCodeAt(0)-97,rank=Number(sq[1]),el=document.createElement('div');el.className=`sq ${(file+rank)%2?'light':'dark'}`;el.dataset.square=sq;
 if(index%8===0){const c=document.createElement('span');c.className='boardCoordinate rankCoordinate';c.textContent=sq[1];el.appendChild(c)}
 if(index>=56){const c=document.createElement('span');c.className='boardCoordinate fileCoordinate';c.textContent=sq[0];el.appendChild(c)}
 if(selectedSquare===sq)el.classList.add('selected');if(lastMove&&(lastMove.from===sq||lastMove.to===sq))el.classList.add('last');const p=currentChess.get(sq);if(p)el.insertAdjacentHTML('beforeend',pieceSvg(p.color,p.type));el.onclick=()=>tapSquare(sq);b.appendChild(el)})}
function tapSquare(sq){if(selectedSquare){if(tryUserMove(selectedSquare,sq))return;selectedSquare=null;legalTargets=[]}const p=currentChess.get(sq);if(p&&p.color===currentChess.turn()){selectedSquare=sq;legalTargets=currentChess.moves({square:sq,verbose:true});renderBoard()}}
function tryUserMove(from,to){const moves=currentChess.moves({square:from,verbose:true}).filter(m=>m.to===to);if(!moves.length)return false;try{lastMove=currentChess.move({from,to,promotion:moves.some(m=>m.promotion)?'q':undefined});variation=true;selectedSquare=null;legalTargets=[];clearEval();renderAll();playMoveSound(lastMove?.captured!=null);return true}catch{return false}}
function renderMoves(){const box=$('moves');box.innerHTML='';for(let i=0;i<mainMoves.length;i+=2){const row=document.createElement('div');row.className='moveRow';row.innerHTML=`<div class="moveNo">${Math.floor(i/2)+1}.</div>`;for(let j=0;j<2;j++){const idx=i+j;if(idx<mainMoves.length){const btn=document.createElement('div');btn.className='move'+(!variation&&currentPly===idx+1?' active':'');btn.textContent=mainMoves[idx].san;btn.onclick=()=>gotoPly(idx+1);row.appendChild(btn)}else row.appendChild(document.createElement('div'))}box.appendChild(row)}

 renderMobileMoveStrip();
}
function renderMobileMoveStrip(){
 if(!selectedGame)return;
 let shell=$('mobileReviewMoves');
 if(!shell){
  shell=document.createElement('div');shell.id='mobileReviewMoves';shell.className='mobileReviewMoves';shell.setAttribute('aria-label','Game moves and PGN');
  $('bottomPlayer')?.after(shell);
 }
 let strip=$('mobileReviewMoveList');
 if(!strip){strip=document.createElement('div');strip.id='mobileReviewMoveList';strip.className='mobileReviewMoveList';shell.append(strip)}
 strip.replaceChildren();
 const first=Math.max(0,currentPly-5),last=Math.min(mainMoves.length,currentPly+6);
 for(let i=first;i<last;i++){
   const btn=document.createElement('button');btn.type='button';btn.className='mobileReviewMove'+(currentPly===i+1?' selected':'');
   btn.textContent=(i%2===0?(Math.floor(i/2)+1)+'. ':'')+mainMoves[i].san;
   btn.setAttribute('aria-current',currentPly===i+1?'step':'false');
   btn.onclick=()=>gotoPly(i+1);strip.append(btn);
 }
 let copyBtn=$('copyGamePgn');
 if(!copyBtn){
   copyBtn=document.createElement('button');copyBtn.id='copyGamePgn';copyBtn.className='copyGamePgn';copyBtn.type='button';
   copyBtn.textContent='Copy PGN';copyBtn.title='Copy entire game PGN to clipboard';copyBtn.setAttribute('aria-label','Copy entire game PGN');
   copyBtn.onclick=async()=>{
     const pgn=selectedGame?.pgn||'';
     if(!pgn){copyBtn.textContent='No PGN';return}
     try{await navigator.clipboard.writeText(pgn);copyBtn.textContent='Copied ✓'}
     catch{const t=document.createElement('textarea');t.value=pgn;t.style.position='fixed';t.style.opacity='0';document.body.append(t);t.select();const ok=document.execCommand('copy');t.remove();copyBtn.textContent=ok?'Copied ✓':'Copy failed'}
     setTimeout(()=>{if(copyBtn.isConnected)copyBtn.textContent='Copy PGN'},1700);
   };
   shell.append(copyBtn);
 }
 const active=strip.querySelector('.selected');
 if(active)requestAnimationFrame(()=>active.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'}));
}
function clearArrows(){$('analysisArrows').innerHTML=''}
function clearEval(){$('engineScore').textContent='—';$('engineSource').textContent='Ready';$('mobileScore').textContent='—';$('mobileSource').textContent='Ready';$('mobileLine').textContent='Tap Analyse to show the best move arrow.';$('bestLine').textContent='Choose a position and tap Analyse. The suggested move will be drawn directly on the board.';$('evalFill').style.height='50%';clearArrows()}
function scoreInfo(pv){if(pv?.mate!==undefined&&pv?.mate!==null&&Number(pv.mate)!==0){const mate=Number(pv.mate);return{whiteScore:mate>0?20:-20,label:(mate<0?'-':'')+'M'+Math.abs(mate)}}const whiteScore=(Number(pv?.cp)||0)/100;return{whiteScore,label:(whiteScore>=0?'+':'')+whiteScore.toFixed(2)}}
function firstUciMove(pv){const raw=String(pv?.moves||'').trim().split(/\s+/)[0]||'';return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(raw)?raw:null}
function squareCenter(sq){const f=sq.charCodeAt(0)-97,r=Number(sq[1]),x=orientation==='white'?f:7-f,y=orientation==='white'?8-r:r-1;return{x:(x+.5)*100,y:(y+.5)*100}}
function drawEngineArrows(pvs){const svg=$('analysisArrows');svg.innerHTML='<defs><marker id="arr0" markerWidth="5" markerHeight="5" refX="4.1" refY="2.5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L5,2.5 L0,5 Z" fill="#8bc34a"/></marker><marker id="arr1" markerWidth="5" markerHeight="5" refX="4.1" refY="2.5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L5,2.5 L0,5 Z" fill="#f4c542"/></marker><marker id="arr2" markerWidth="5" markerHeight="5" refX="4.1" refY="2.5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L5,2.5 L0,5 Z" fill="#58a6ff"/></marker></defs>';pvs.slice(0,3).forEach((pv,i)=>{const u=firstUciMove(pv);if(!u)return;const a=squareCenter(u.slice(0,2)),b=squareCenter(u.slice(2,4)),dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,ex=b.x-dx/len*22,ey=b.y-dy/len*22;svg.insertAdjacentHTML('beforeend',`<line x1="${a.x}" y1="${a.y}" x2="${ex}" y2="${ey}" stroke="${['#8bc34a','#f4c542','#58a6ff'][i]}" stroke-width="${i?12:16}" stroke-linecap="round" opacity=".88" marker-end="url(#arr${i})"/>`)})}
async function lichessCloud(fen){const r=await fetch(`https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=3&variant=standard`,{headers:{Accept:'application/json'}});if(r.status===404)return null;if(!r.ok)throw new Error(`Cloud ${r.status}`);const j=await r.json(),pvs=(j.pvs||[]).slice(0,3);return pvs.length?{depth:j.depth,pv:pvs[0],pvs,source:'Lichess cloud'}:null}
async function liveStockfish(fen){const r=await fetch('https://chess-api.com/v1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fen,depth:14,variants:1,maxThinkingTime:180})});if(!r.ok)throw new Error(`Live engine ${r.status}`);const j=await r.json(),whiteScore=j.eval!=null?Number(j.eval):Number(j.centipawns)/100,bestMove=j.move||j.lan||'',continuation=Array.isArray(j.continuationArr)?j.continuationArr.filter(Boolean):[],line=[bestMove,...continuation.filter((m,i)=>!(i===0&&m===bestMove))].filter(Boolean).join(' '),pv={cp:Number.isFinite(whiteScore)?Math.round(whiteScore*100):0,mate:j.mate,moves:line};return{depth:j.depth||14,pv,pvs:[pv],source:'Stockfish live'}}
function setAnalysing(on){for(const id of ['analyse','analyseMobile']){const b=$(id);b.disabled=on;b.classList.toggle('loading',on);b.textContent=on?'Analysing':'Analyse'}}
async function analysePosition(){
 const fen=currentChess.fen(),cacheKey='local|'+fen;
 if(evalCache.has(cacheKey)){showEval(evalCache.get(cacheKey));return}
 try{
  setAnalysing(true);
  const engine=getLocalStockfish();
  await engine.ready();
  const result=await engine.analyse(fen,{depth:16,multipv:3,clearHash:true});
  const lines=(result.lines?.length?result.lines:[{cp:result.cp,mate:result.mate,pv:result.pv,best:result.best}]).slice(0,3);
  const pvs=lines.map(x=>({cp:x.cp,mate:x.mate,moves:x.pv||x.best||''})).filter(x=>x.moves||Number.isFinite(x.cp)||x.mate!=null);
  if(!pvs.length)throw new Error('Local Stockfish returned no analysis');
  const data={source:'Stockfish local',depth:result.depth||16,pvs};
  evalCache.set(cacheKey,data);
  showEval(data);
 }catch(e){$('bestLine').textContent='Local Stockfish unavailable: '+e.message;$('mobileLine').textContent='Local analysis unavailable — tap to retry.'}
 finally{setAnalysing(false)}
}
function showEval(data){const pvs=(data.pvs?.length?data.pvs:[data.pv]).filter(Boolean).slice(0,3),top=scoreInfo(pvs[0]);$('engineScore').textContent=$('mobileScore').textContent=top.label;$('engineSource').textContent=`${data.source} · depth ${data.depth??'—'}`;$('mobileSource').textContent=data.source;$('bestLine').textContent='Best: '+(pvs[0].moves||'');$('mobileLine').textContent='Best: '+(pvs[0].moves||'');const pct=50+45*(2/Math.PI)*Math.atan(top.whiteScore/3);$('evalFill').style.height=`${Math.max(3,Math.min(97,pct))}%`;drawEngineArrows(pvs)}
function rerenderAppearance(){if(selectedGame)renderAll();const e=$('enginePieceIcon');if(e)e.innerHTML=pieceSvg('b','n')}
window.addEventListener('chessPreference',e=>{if(e.detail?.key==='pieces')rerenderAppearance();if(e.detail?.key==='engine')clearEval()});
$('sync').onclick=()=>sync({automatic:false});$('back').onclick=()=>{$('analysisView').style.display='none';$('libraryView').style.display='block';document.body.classList.remove('review-guided-active');document.querySelector('.homeTabs')?.classList.remove('reviewHidden');document.querySelector('.homeTabs')?.style.removeProperty('display');const guide=$('reviewGuideCard');if(guide)guide.hidden=true;};$('flip').onclick=()=>{orientation=orientation==='white'?'black':'white';renderAll();const cached=evalCache.get('local|'+currentChess.fen());if(cached)showEval(cached)};$('analyse').onclick=$('analyseMobile').onclick=analysePosition;$('start').onclick=()=>gotoPly(0);$('prev').onclick=()=>gotoPly(Math.max(0,currentPly-1));$('next').onclick=()=>gotoPly(Math.min(mainMoves.length,currentPly+1));$('end').onclick=()=>gotoPly(mainMoves.length);$('resetVariation').onclick=()=>gotoPly(currentPly);
(async()=>{try{const savedUser=localStorage.getItem('chess-username');if(savedUser)$('user').value=savedUser;const u=$('user').value.trim(),saved=await allGames();renderGames(userGames(saved,u),u);$('status').textContent=saved.length?`Loaded saved games from this device`:'No saved games yet';if(u)await sync({automatic:true})}catch(e){$('status').textContent='Storage initialisation failed: '+e.message}})();
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js');
