import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm';

const $=id=>document.getElementById(id);
const DB_NAME='rk93-chess-analyser',STORE='games';
const TOKEN_KEY='chess-analyser-lichess-token',EXPLORER_HOST='https://explorer.lichess.org';
let review=null,timer=null,requestId=0,localIndexPromise=null;

function moveEls(){return [...document.querySelectorAll('#moves .move')]}
function sans(){return moveEls().map(e=>e.childNodes[0]?.textContent?.trim()||e.textContent.trim())}
function currentPly(){const i=moveEls().findIndex(e=>e.classList.contains('active'));return i<0?0:i+1}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function pct(n,d){return d?Math.round(n*1000/d)/10:0}
function fenKey(fen){return String(fen||'').split(' ').slice(0,4).join(' ')}

function buildGame(){
  const c=new Chess(),positions=[c.fen()],moves=[];
  for(const san of sans()){
    try{moves.push(c.move(san));positions.push(c.fen())}catch{return null}
  }
  return{positions,moves};
}
function sanForUci(fen,uci){
  if(!uci)return'';
  try{const c=new Chess(fen),m=c.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]||undefined});return m?.san||uci}catch{return uci}
}

function ensureContext(){
  const card=$('reviewGuideCard');if(!card)return null;
  let box=$('reviewMoveContext');
  if(box)return box;
  box=document.createElement('section');box.id='reviewMoveContext';box.className='reviewMoveContext';
  box.innerHTML='<div class="reviewContextTitle">Position context</div><div id="reviewContextBody" class="reviewContextBody muted">Move to a position to load context.</div>';
  const actions=card.querySelector('.reviewGuideActions');
  card.insertBefore(box,actions||null);
  return box;
}

function moveFacts(game,ply){
  if(!game||ply<1||ply>game.moves.length)return[];
  const m=game.moves[ply-1],facts=[];
  if(m.san?.includes('#'))facts.push('Checkmate');
  else if(m.san?.includes('+'))facts.push('Check');
  if(m.captured){const names={p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen'};facts.push(`Captures ${names[m.captured]||'piece'}`)}
  if(/^O-O-O/.test(m.san))facts.push('Queenside castle');
  else if(/^O-O/.test(m.san))facts.push('Kingside castle');
  if(m.promotion)facts.push(`Promotes to ${({q:'queen',r:'rook',b:'bishop',n:'knight'})[m.promotion]||m.promotion}`);
  const label=review?.labels?.[ply-1],best=review?.bestMoves?.[ply-1],before=game.positions[ply-1];
  if(label==='Blunder'||label==='Mistake'||label==='Inaccuracy'){
    const bestSan=sanForUci(before,best);
    if(bestSan&&bestSan!==m.san)facts.push(`Missed stronger move: ${bestSan}`);
  }
  try{
    const after=new Chess(game.positions[ply]);
    const q=after.moves({verbose:true}).find(x=>x.captured==='q');
    if(q)facts.push('Tactical alert: queen can be captured next');
  }catch{}
  return facts;
}

function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function allGames(){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    if(!db.objectStoreNames.contains(STORE)){db.close();resolve([]);return}
    const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).getAll();
    r.onsuccess=()=>{db.close();resolve(r.result||[])};r.onerror=()=>{db.close();reject(r.error)}
  });
}
function resultOf(pgn){return String(pgn||'').match(/^\[Result\s+"([^"]+)"\]/m)?.[1]||''}
async function buildLocalIndex(){
  const games=await allGames(),index=new Map();
  for(let gi=0;gi<games.length;gi++){
    const g=games[gi];if(!g?.pgn)continue;
    try{
      const parsed=new Chess();parsed.loadPgn(g.pgn);
      const seq=parsed.history({verbose:true});
      const fenTag=String(g.pgn).match(/^\[FEN\s+"([^"]+)"\]/m)?.[1];
      const c=fenTag?new Chess(fenTag):new Chess(),result=resultOf(g.pgn),limit=Math.min(seq.length,100);
      for(let i=0;i<=limit;i++){
        const key=fenKey(c.fen());let row=index.get(key);
        if(!row){row={count:0,examples:[],next:new Map()};index.set(key,row)}
        row.count++;
        if(row.examples.length<4)row.examples.push({
          white:g.white?.username||'White',black:g.black?.username||'Black',
          result,date:g.end_time?new Date(g.end_time*1000).toLocaleDateString():'',url:g.url||'',next:i<seq.length?seq[i].san:''
        });
        if(i<seq.length){const san=seq[i].san;row.next.set(san,(row.next.get(san)||0)+1);c.move({from:seq[i].from,to:seq[i].to,promotion:seq[i].promotion})}
      }
    }catch{}
    if(gi%30===29)await new Promise(r=>setTimeout(r,0));
  }
  return index;
}
function localIndex(){if(!localIndexPromise)localIndexPromise=buildLocalIndex().catch(()=>new Map());return localIndexPromise}

async function globalExplorer(fen){
  const token=localStorage.getItem(TOKEN_KEY)||'';if(!token)return null;
  const u=new URL(EXPLORER_HOST+'/lichess');
  u.searchParams.set('variant','standard');u.searchParams.set('speeds','blitz,rapid,classical');
  u.searchParams.set('ratings','1000,1200,1400,1600,1800,2000,2200,2500');
  u.searchParams.set('fen',fen);u.searchParams.set('moves','5');u.searchParams.set('topGames','3');u.searchParams.set('recentGames','0');
  const r=await fetch(u,{headers:{Accept:'application/json',Authorization:`Bearer ${token}`}});
  if(!r.ok)return null;return r.json();
}

function exampleText(g){
  if(!g)return'';
  const w=g.players?.white||g.white||{},b=g.players?.black||g.black||{};
  const wn=w.name||w.username||g.white?.name||'White',bn=b.name||b.username||g.black?.name||'Black';
  const year=g.year||'',winner=g.winner?(` · ${g.winner} won`):'';
  return `${wn} – ${bn}${year?` (${year})`:''}${winner}`;
}

async function renderContext(){
  const box=ensureContext(),body=$('reviewContextBody');if(!box||!body||!review)return;
  const ply=currentPly();if(ply<1){body.textContent='Start the guided review to see opening, tactics and database context.';return}
  const game=buildGame();if(!game)return;
  const before=game.positions[ply-1],m=game.moves[ply-1],id=++requestId;
  const facts=moveFacts(game,ply);
  const best=review.bestMoves?.[ply-1]||'',bestSan=sanForUci(before,best),loss=Number(review.lossPct?.[ply-1]);
  body.innerHTML=`<div class="reviewContextMove"><b>${Math.floor((ply+1)/2)}${ply%2?' .':' …'} ${esc(m.san)}</b><span>${esc(review.labels?.[ply-1]||'')}</span></div>
    <div class="reviewContextFacts">${facts.length?facts.map(x=>`<span>${esc(x)}</span>`).join(''):'<span>Quiet/positional move</span>'}</div>
    <div class="reviewContextEngine">${bestSan?`Engine best: <b>${esc(bestSan)}</b>`:''}${Number.isFinite(loss)?` · Win% loss <b>${loss.toFixed(1)}%</b>`:''}</div>
    <div class="reviewContextLoading">Loading opening/database context…</div>`;

  const [global,idx]=await Promise.all([globalExplorer(before).catch(()=>null),localIndex()]);
  if(id!==requestId)return;
  const local=idx.get(fenKey(before));
  const sections=[];
  if(global){
    const total=(global.white||0)+(global.draws||0)+(global.black||0),opening=global.opening;
    if(opening?.name||opening?.eco)sections.push(`<div class="reviewContextOpening"><b>${esc(opening?.name||'Opening')}</b> ${opening?.eco?`<span>${esc(opening.eco)}</span>`:''}</div>`);
    if(total){
      const played=(global.moves||[]).find(x=>x.san===m.san||x.uci===m.from+m.to+(m.promotion||'')),playedN=played?(played.white||0)+(played.draws||0)+(played.black||0):0;
      sections.push(`<div class="reviewContextDb"><b>${total.toLocaleString()}</b> similar positions in Lichess DB${playedN?` · <b>${playedN.toLocaleString()}</b> continued with ${esc(m.san)} (${pct(playedN,total)}%)`:''}</div>`);
      const common=(global.moves||[]).slice(0,3).map(x=>{const n=(x.white||0)+(x.draws||0)+(x.black||0);return `<span><b>${esc(x.san||x.uci)}</b> ${n.toLocaleString()} (${pct(n,total)}%)</span>`}).join('');
      if(common)sections.push(`<div class="reviewContextCommon"><small>Most common from this position</small>${common}</div>`);
    }
    if(global.topGames?.length)sections.push(`<div class="reviewContextExamples"><small>Example games</small>${global.topGames.slice(0,3).map(g=>`<span>${esc(exampleText(g))}</span>`).join('')}</div>`);
  }else{
    sections.push('<div class="reviewContextDb muted">Connect Lichess in Explorer to see the global opening database and example games.</div>');
  }
  if(local?.count){
    const next=[...local.next.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([san,n])=>`<b>${esc(san)}</b> ${n}`).join(' · ');
    sections.push(`<div class="reviewContextLocal"><b>Your imported games:</b> this position appeared ${local.count} time${local.count===1?'':'s'}${next?` · next: ${next}`:''}</div>`);
    if(local.examples?.length)sections.push(`<div class="reviewContextExamples"><small>Your matching games</small>${local.examples.slice(0,3).map(g=>`<span>${esc(g.white)} – ${esc(g.black)}${g.date?` · ${esc(g.date)}`:''}${g.next?` · next ${esc(g.next)}`:''}</span>`).join('')}</div>`);
  }
  body.querySelector('.reviewContextLoading')?.remove();
  body.insertAdjacentHTML('beforeend',sections.join(''));
}

function schedule(){clearTimeout(timer);timer=setTimeout(()=>renderContext().catch(()=>{}),120)}
function init(){
  ensureContext();
  window.addEventListener('gameReviewReady',e=>{review=e.detail?.data||review;schedule()});
  window.addEventListener('reviewNavigation',schedule);
  document.addEventListener('click',e=>{if(e.target.closest?.('#reviewNext,#reviewPrev,#reviewStartBtn,#moves .move'))schedule()},true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
