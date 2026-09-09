import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm';
import { cacheSet,simpleHash,getPositionEval,setPositionEval } from './analysis-store.js';

const $=id=>document.getElementById(id);
let review=null,fetching=false;
const cycle=new Map();

function moveEls(){return [...document.querySelectorAll('#moves .move')]}
function sans(){return moveEls().map(e=>e.childNodes[0]?.textContent?.trim()||e.textContent.trim())}
function currentPly(){const i=moveEls().findIndex(e=>e.classList.contains('active'));return i<0?0:i+1}
function reviewKey(){return simpleHash(`${$('gameTitle')?.textContent||''}|${sans().join(' ')}`)}
function positions(){const c=new Chess(),out=[c.fen()];for(const san of sans()){try{c.move(san);out.push(c.fen())}catch{return []}}return out}
function firstMove(moves){const u=String(moves||'').trim().split(/\s+/)[0];return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(u)?u:''}
function sanForUci(fen,uci){try{const c=new Chess(fen),m=c.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]||undefined});return m?.san||uci}catch{return uci}}

async function fetchBest(fen){
  const cached=await getPositionEval('cloud',fen).catch(()=>null);
  let best=firstMove(cached?.pvs?.[0]?.moves);
  if(best)return best;
  try{
    const r=await fetch(`https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=1&variant=standard`,{headers:{Accept:'application/json'}});
    if(r.ok){const j=await r.json();if(j?.pvs?.length){await setPositionEval('cloud',fen,{source:'Lichess cloud',depth:j.depth||0,pvs:j.pvs.slice(0,1)});best=firstMove(j.pvs[0].moves);if(best)return best}}
  }catch{}
  try{
    const r=await fetch('https://chess-api.com/v1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fen,depth:12,variants:1,maxThinkingTime:180})});
    if(r.ok){const j=await r.json();best=j.move||j.lan||'';if(/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(best))return best}
  }catch{}
  return '';
}

function drawArrow(uci){
  const svg=$('analysisArrows'),board=$('board');if(!svg||!board)return false;
  svg.innerHTML='';if(!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci||''))return false;
  const point=sq=>{const el=board.querySelector(`[data-square="${sq}"]`);if(!el)return null;const br=board.getBoundingClientRect(),r=el.getBoundingClientRect();if(!br.width||!br.height)return null;return{x:((r.left+r.width/2-br.left)/br.width)*800,y:((r.top+r.height/2-br.top)/br.height)*800}};
  const a=point(uci.slice(0,2)),b=point(uci.slice(2,4));if(!a||!b)return false;
  svg.innerHTML=`<defs><marker id="reliableReviewArrow" markerWidth="5" markerHeight="5" refX="4.1" refY="2.5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L5,2.5 L0,5 Z" fill="#8bc34a"/></marker></defs><line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#8bc34a" stroke-width="16" stroke-linecap="round" opacity=".9" marker-end="url(#reliableReviewArrow)"/>`;
  return true;
}
function drawWhenReady(uci,tries=4){if(drawArrow(uci)||tries<=0)return;requestAnimationFrame(()=>drawWhenReady(uci,tries-1))}

async function showBest(){
  if(!review||fetching)return;
  const ply=currentPly(),i=ply-1;if(i<0)return;
  const ps=positions(),fen=ps[i];if(!fen)return;
  const btn=$('reviewShowBest'),comment=$('reviewGuideComment');let best=review.bestMoves?.[i]||'';
  if(!best){
    fetching=true;if(btn){btn.disabled=true;btn.textContent='Finding best…'};
    try{best=await fetchBest(fen);if(best){review.bestMoves=review.bestMoves||[];review.bestMoves[i]=best;await cacheSet('review',reviewKey(),review).catch(()=>{})}}finally{fetching=false;if(btn){btn.disabled=false;btn.textContent='Show best'}}
  }
  if(!best){if(comment)comment.textContent='A verified best move is not available for this position yet.';return}
  drawWhenReady(best);
  const bestSan=sanForUci(fen,best);if(comment)comment.textContent=`Best move: ${bestSan}. The green arrow shows the engine's preferred move.`;
}

function keepShowBestAvailable(){
  const btn=$('reviewShowBest');if(!btn||!review)return;
  btn.hidden=currentPly()===0;
}

function jumpToSummaryMove(row,side){
  if(!review)return;
  const label=row.querySelector('.label')?.textContent?.trim();if(!label)return;
  const indices=[];review.labels?.forEach((x,i)=>{if(x===label&&((side==='white'&&i%2===0)||(side==='black'&&i%2===1)))indices.push(i)});
  if(!indices.length)return;
  const key=`${side}|${label}`,n=cycle.get(key)||0,i=indices[n%indices.length];cycle.set(key,(n+1)%indices.length);
  const screen=$('reviewSummaryScreen');if(screen)screen.hidden=true;
  const el=moveEls()[i];if(!el)return;el.click();
  requestAnimationFrame(()=>requestAnimationFrame(()=>{$('reviewGuideCard')?.scrollIntoView({behavior:'smooth',block:'start'});keepShowBestAvailable()}));
}

function init(){
  window.addEventListener('gameReviewReady',e=>{review=e.detail?.data||review;cycle.clear();requestAnimationFrame(keepShowBestAvailable)});
  window.addEventListener('reviewNavigation',()=>requestAnimationFrame(keepShowBestAvailable));
  document.addEventListener('click',e=>{
    const best=e.target.closest?.('#reviewShowBest');if(best){e.preventDefault();e.stopImmediatePropagation();showBest();return}
    const count=e.target.closest?.('#reviewBreakdown .left,#reviewBreakdown .right');if(count){const n=Number(count.textContent)||0;if(!n)return;e.preventDefault();e.stopImmediatePropagation();jumpToSummaryMove(count.closest('.reviewBreakRow'),count.classList.contains('left')?'white':'black')}
  },true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
