import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm';
import { cacheSet,getPositionEval,setPositionEval,simpleHash } from './analysis-store.js';
import { moverExpectedPointLoss,classifyReviewedMove,sideAccuracy,moverCentipawnDrop } from './review-scoring.js';

const $=id=>document.getElementById(id);
const AUDIT_VERSION=1;
let auditing=false;

function sans(){return[...document.querySelectorAll('#moves .move')].map(e=>e.childNodes[0]?.textContent?.trim()||e.textContent.trim())}
function buildGame(){
  const c=new Chess(),positions=[c.fen()],moves=[];
  for(const san of sans()){
    try{const m=c.move(san);moves.push(m);positions.push(c.fen())}catch{return null}
  }
  return{positions,moves};
}
function uci(m){return m?m.from+m.to+(m.promotion||''):''}
function keyForReview(){return simpleHash(`${$('gameTitle')?.textContent||''}|${sans().join(' ')}`)}
function firstUci(moves){const u=String(moves||'').trim().split(/\s+/)[0]||'';return/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(u)?u:''}
function cpFromPv(pv){if(pv?.mate!==undefined&&pv?.mate!==null&&Number(pv.mate)!==0)return Number(pv.mate)>0?10000:-10000;return Number(pv?.cp)||0}

async function fetchTimeout(url,options={},ms=6500){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),ms);
  try{return await fetch(url,{...options,signal:controller.signal})}finally{clearTimeout(timer)}
}
async function deepEval(fen){
  let data=await getPositionEval('review-quality-deep-v1',fen).catch(()=>null);
  if(!data?.pvs?.length){
    const r=await fetchTimeout('https://chess-api.com/v1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fen,depth:16,variants:1,maxThinkingTime:100})});
    if(!r.ok)throw new Error(`Deep engine ${r.status}`);
    const j=await r.json(),best=j.move||j.lan||'',cont=Array.isArray(j.continuationArr)?j.continuationArr.filter(Boolean):[],moves=[best,...cont.filter((m,i)=>!(i===0&&m===best))].filter(Boolean).join(' '),cp=j.eval!=null?Math.round(Number(j.eval)*100):Number(j.centipawns)||0;
    data={source:'Stockfish quality audit',depth:j.depth||16,pvs:[{cp,mate:j.mate,moves}]};
    await setPositionEval('review-quality-deep-v1',fen,data).catch(()=>{});
  }
  const pv=data.pvs[0];
  return{cp:cpFromPv(pv),best:firstUci(pv.moves),depth:data.depth||16};
}

function tacticalFacts(game){
  const facts=[];
  for(let ply=1;ply<game.positions.length;ply++){
    try{
      const after=new Chess(game.positions[ply]);
      const queenCaptures=after.moves({verbose:true}).filter(m=>m.captured==='q');
      if(!queenCaptures.length)continue;
      facts.push({ply,queenCaptures:queenCaptures.map(uci),queenTrade:game.moves[ply-1]?.captured==='q'});
    }catch{}
  }
  return facts;
}

function counts(labels){const out={};for(const l of labels)out[l]=(out[l]||0)+1;return out}
function countsBySide(labels){const w={},b={};labels.forEach((l,i)=>{const o=i%2===0?w:b;o[l]=(o[l]||0)+1});return{w,b}}
function refreshMoveTags(labels){
  const els=[...document.querySelectorAll('#moves .move')];
  els.forEach((el,i)=>{
    const old=el.querySelector('.moveTag');if(old)old.remove();
    if(!labels[i])return;
    const tag=document.createElement('span');tag.className='moveTag tag-'+labels[i].toLowerCase();tag.textContent=labels[i];tag.title='Quality-audited move classification';el.appendChild(tag);
  });
}
function refreshSummary(data){
  if($('whiteAccuracy'))$('whiteAccuracy').textContent=Number(data.whiteAccuracy).toFixed(1);
  if($('blackAccuracy'))$('blackAccuracy').textContent=Number(data.blackAccuracy).toFixed(1);
  const c=counts(data.labels),root=$('reviewSummary');
  if(root)root.innerHTML=['Brilliant','Great','Best','Excellent','Good','Book','Inaccuracy','Mistake','Blunder'].filter(k=>c[k]).map(k=>`<span class="reviewCount tag-${k.toLowerCase()}"><b>${c[k]}</b> ${k}</span>`).join('');
  const screen=$('reviewSummaryScreen');
  if(screen&&!screen.hidden){
    const {w,b}=countsBySide(data.labels);
    screen.querySelectorAll('#reviewBreakdown .reviewBreakRow').forEach(row=>{
      const label=row.querySelector('.label')?.textContent?.trim();if(!label)return;
      const left=row.querySelector('.left'),right=row.querySelector('.right');if(left)left.textContent=w[label]||0;if(right)right.textContent=b[label]||0;
    });
    const players=screen.querySelectorAll('#reviewSummaryPlayers .accuracy');if(players[0])players[0].textContent=Number(data.whiteAccuracy).toFixed(1);if(players[1])players[1].textContent=Number(data.blackAccuracy).toFixed(1);
    const headline=$('reviewHeadlineCard');if(headline&&data.labels.includes('Blunder'))headline.textContent='The game had important tactical swings. Review the moves that lost material or changed the result.';
  }
}

async function audit(data){
  if(auditing||!data)return;
  const game=buildGame();if(!game||game.positions.length!==data.evals?.length)return;
  if(data.qualityAuditVersion===AUDIT_VERSION){refreshMoveTags(data.labels);refreshSummary(data);return}
  auditing=true;
  const status=$('reviewStatus');if(status)status.textContent='Running deep tactical quality audit…';
  try{
    const facts=tacticalFacts(game),critical=new Set();
    for(const f of facts){critical.add(f.ply-1);critical.add(f.ply);if(f.ply+1<game.positions.length)critical.add(f.ply+1)}
    const ordered=[...critical].sort((a,b)=>a-b);
    for(let n=0;n<ordered.length;n++){
      const i=ordered[n];if(status)status.textContent=`Deep tactical audit ${n+1}/${ordered.length}…`;
      try{const e=await deepEval(game.positions[i]);data.evals[i]=e.cp;data.bestMoves[i]=e.best||data.bestMoves[i]||'';data.positionExact[i]=true}catch{}
    }

    const losses=[],labels=[],whiteLoss=[],blackLoss=[];
    const byPly=new Map(facts.map(f=>[f.ply,f]));
    for(let ply=1;ply<data.evals.length;ply++){
      const before=data.evals[ply-1],after=data.evals[ply],loss=moverExpectedPointLoss(before,after,ply),fact=byPly.get(ply),played=uci(game.moves[ply-1]),replyBest=data.bestMoves[ply]||'',queenHangConfirmed=!!fact&&!fact.queenTrade&&fact.queenCaptures.includes(replyBest),drop=moverCentipawnDrop(before,after,ply);
      losses.push(loss);
      labels.push(classifyReviewedMove({loss,ply,played,best:data.bestMoves[ply-1]||'',previousLabel:data.labels?.[ply-1],queenHangConfirmed:queenHangConfirmed&&(drop>=100||loss>=0.05),queenTrade:fact?.queenTrade}));
      (ply%2?whiteLoss:blackLoss).push(loss);
    }
    data.losses=losses;data.labels=labels;data.whiteAccuracy=sideAccuracy(whiteLoss);data.blackAccuracy=sideAccuracy(blackLoss);data.moveVerified=data.moveVerified||new Array(labels.length).fill(false);
    for(const i of critical){if(i>0&&i<data.positionExact.length&&data.positionExact[i-1]&&data.positionExact[i])data.moveVerified[i-1]=true}
    data.qualityAuditVersion=AUDIT_VERSION;data.qualityAudit={queenHangCandidates:facts.length,deepPositions:ordered.length,updated:Date.now()};
    await cacheSet('review',keyForReview(),data);
    refreshMoveTags(labels);refreshSummary(data);
    if(status)status.textContent=`Deep quality audit complete · ${ordered.length} tactical positions verified · ${labels.filter(x=>x==='Blunder').length} blunder${labels.filter(x=>x==='Blunder').length===1?'':'s'} found.`;
  }catch(e){if(status)status.textContent=`Review ready · deep tactical audit could not finish (${e?.message||e}).`}finally{auditing=false}
}

window.addEventListener('gameReviewReady',e=>audit(e.detail?.data));
