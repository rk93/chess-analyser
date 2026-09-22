import './import-fix.js';
import './review-summary-navigation.js';
import './review-context.js';
import './review-reliability.js';
import './review-pro.js';
import './review-polish.js';
import './puzzles.js';
import './ux-shell.js';
import './settings-fix.js';
import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm';
import { cacheSet,simpleHash } from './analysis-store.js';
import { getLocalStockfish,localStockfishAvailable } from './local-stockfish.js';
import { classifyStockfishMove,gameAccuracy,moverWinLossPct,moveAccuracyFromLoss } from './review-v2-core.js';

const $=id=>document.getElementById(id);
const LABELS=['Brilliant','Great','Best','Excellent','Good','Book','Inaccuracy','Mistake','Blunder'];
const SYMBOL={Brilliant:'!!',Great:'!',Best:'★',Excellent:'✓',Good:'✓',Book:'📖',Inaccuracy:'?!',Mistake:'?',Blunder:'??'};
const BADGE={Brilliant:'brilliant',Great:'great',Best:'best',Excellent:'excellent',Good:'good',Book:'book',Inaccuracy:'inaccuracy',Mistake:'mistake',Blunder:'blunder'};
const LOCAL_REVIEW_VERSION=21;
const BASE_DEPTH=16;
const DEEP_DEPTH=20;
let auditing=false;

function moveEls(){return [...document.querySelectorAll('#moves .move')]}
function sans(){return moveEls().map(e=>e.childNodes[0]?.textContent?.trim()||e.textContent.trim())}
function reviewKey(){return simpleHash(`${$('gameTitle')?.textContent||''}|${sans().join(' ')}`)}
function build(){
  const c=new Chess(),positions=[c.fen()],ucis=[],moves=[];
  for(const san of sans()){
    try{const m=c.move(san);moves.push(m);ucis.push(m.from+m.to+(m.promotion||''));positions.push(c.fen())}
    catch{return{positions:[],ucis:[],moves:[]}}
  }
  return{positions,ucis,moves};
}
function terminalEval(fen){
  try{
    const c=new Chess(fen);
    if(c.isCheckmate())return c.turn()==='w'?-100000:100000;
    if(c.isDraw()||c.isStalemate()||c.isInsufficientMaterial())return 0;
  }catch{}
  return null;
}
function legalMoveCount(fen){try{return new Chess(fen).moves().length}catch{return null}}
function queenCaptureAvailable(fen){try{return new Chess(fen).moves({verbose:true}).some(m=>m.captured==='q')}catch{return false}}

function countBySide(data){
  const out={white:Object.fromEntries(LABELS.map(x=>[x,0])),black:Object.fromEntries(LABELS.map(x=>[x,0]))};
  data.labels.forEach((x,i)=>out[i%2===0?'white':'black'][x]=(out[i%2===0?'white':'black'][x]||0)+1);
  return out;
}
function refreshMoveTags(data){
  const els=moveEls();
  els.forEach((el,i)=>{
    let tag=el.querySelector('.moveTag');if(!tag){tag=document.createElement('span');el.appendChild(tag)}
    const label=data.labels[i]||'Good';
    tag.className='moveTag tag-'+label.toLowerCase();tag.textContent=label;
    const loss=Number(data.lossPct?.[i]);
    tag.title=`Stockfish 19 · depth ${data.moveDepths?.[i]||BASE_DEPTH}${Number.isFinite(loss)?` · Win% loss ${loss.toFixed(1)}`:''}`;
    const practice=el.querySelector('.practiceMove');
    if(practice&&!(label==='Mistake'||label==='Blunder'))practice.remove();
  });
}
function refreshSummary(data){
  if($('whiteAccuracy'))$('whiteAccuracy').textContent=Number(data.whiteAccuracy).toFixed(1);
  if($('blackAccuracy'))$('blackAccuracy').textContent=Number(data.blackAccuracy).toFixed(1);
  const names=($('gameTitle')?.textContent||'White — Black').split(' — '),players=$('reviewSummaryPlayers');
  if(players)players.innerHTML=`<div class="reviewSummaryPlayer"><div class="name">${names[0]||'White'}</div><div class="accuracy">${Number(data.whiteAccuracy).toFixed(1)}</div></div><div class="reviewSummaryPlayer"><div class="name">${names[1]||'Black'}</div><div class="accuracy">${Number(data.blackAccuracy).toFixed(1)}</div></div>`;
  const counts=countBySide(data),breakdown=$('reviewBreakdown');
  if(breakdown)breakdown.innerHTML=LABELS.map(label=>`<div class="reviewBreakRow"><span class="label">${label}</span><span class="left">${counts.white[label]||0}</span><span class="reviewBreakIcon badge-${BADGE[label]}">${SYMBOL[label]}</span><span class="right">${counts.black[label]||0}</span></div>`).join('');
  const headline=$('reviewHeadlineCard'),blunders=data.labels.filter(x=>x==='Blunder').length,mistakes=data.labels.filter(x=>x==='Mistake').length;
  if(headline)headline.textContent=blunders?`${blunders} blunder${blunders===1?'':'s'} found by local Stockfish. Review the largest Win% swings.`:mistakes?`No blunders, but ${mistakes} mistake${mistakes===1?'':'s'} found by local Stockfish.`:'A clean local Stockfish review with no major Win% drops.';
}

async function analysePosition(engine,fen,{depth,multipv}){
  const t=terminalEval(fen);
  if(t!==null)return{cp:t,best:'',depth:99,pv:'',lines:[{cp:t,depth:99,pv:'',best:''}]};
  return engine.analyse(fen,{depth,multipv,clearHash:true});
}

async function firstPass(ctx){
  const engine=getLocalStockfish();await engine.ready();
  const n=ctx.positions.length,evals=new Array(n),bestMoves=new Array(n).fill(''),depths=new Array(n).fill(0),pvs=new Array(n).fill(''),secondCps=new Array(n).fill(null);
  for(let i=0;i<n;i++){
    const status=$('reviewStatus');if(status)status.textContent=`Stockfish review ${i+1}/${n} · depth ${BASE_DEPTH}…`;
    const r=await analysePosition(engine,ctx.positions[i],{depth:BASE_DEPTH,multipv:i<n-1?2:1});
    evals[i]=r.cp;bestMoves[i]=r.best||r.lines?.[0]?.best||'';depths[i]=r.depth||BASE_DEPTH;pvs[i]=r.pv||r.lines?.[0]?.pv||'';
    if(r.lines?.[1]&&Number.isFinite(r.lines[1].cp))secondCps[i]=r.lines[1].cp;
  }
  return{engine,evals,bestMoves,depths,pvs,secondCps};
}

function classifyAll(engineData,ctx,prior){
  const labels=[],lossPct=[],moveAccuracies=[],moveDepths=[],onlyGapPct=[];
  for(let i=0;i<ctx.ucis.length;i++){
    const ply=i+1,before=engineData.evals[i],after=engineData.evals[i+1];
    const provisionalLoss=moverWinLossPct(before,after,ply);
    const priorBook=prior?.labels?.[i]==='Book'&&provisionalLoss<2;
    const row=classifyStockfishMove({
      beforeCp:before,afterCp:after,ply,played:ctx.ucis[i],best:engineData.bestMoves[i]||'',
      secondBestCp:engineData.secondCps[i],legalMoveCount:legalMoveCount(ctx.positions[i]),isBook:priorBook
    });
    labels.push(row.label);lossPct.push(row.lossPct);moveAccuracies.push(row.accuracy);
    moveDepths.push(Math.min(engineData.depths[i]||BASE_DEPTH,engineData.depths[i+1]||BASE_DEPTH));
    onlyGapPct.push(row.onlyGapPct);
  }
  return{labels,lossPct,moveAccuracies,moveDepths,onlyGapPct};
}

function deepTargets(engineData,ctx,classification){
  const set=new Set();
  for(let i=0;i<ctx.ucis.length;i++){
    const loss=classification.lossPct[i],label=classification.labels[i],afterFen=ctx.positions[i+1];
    const nearBoundary=(loss>=8&&loss<12)||(loss>=18&&loss<22)||(loss>=28&&loss<32);
    if(['Inaccuracy','Mistake','Blunder'].includes(label)||nearBoundary||moveAccuracyFromLoss(loss)<90||queenCaptureAvailable(afterFen)){
      set.add(i);set.add(i+1);
    }
  }
  return [...set].filter(i=>i>=0&&i<ctx.positions.length&&terminalEval(ctx.positions[i])===null).sort((a,b)=>a-b);
}

async function deepen(engineData,ctx,indexes){
  for(let n=0;n<indexes.length;n++){
    const i=indexes[n],status=$('reviewStatus');if(status)status.textContent=`Deep verification ${n+1}/${indexes.length} · depth ${DEEP_DEPTH}…`;
    const r=await analysePosition(engineData.engine,ctx.positions[i],{depth:DEEP_DEPTH,multipv:i<ctx.positions.length-1?2:1});
    engineData.evals[i]=r.cp;engineData.bestMoves[i]=r.best||r.lines?.[0]?.best||engineData.bestMoves[i];engineData.depths[i]=r.depth||DEEP_DEPTH;engineData.pvs[i]=r.pv||r.lines?.[0]?.pv||engineData.pvs[i];
    engineData.secondCps[i]=r.lines?.[1]&&Number.isFinite(r.lines[1].cp)?r.lines[1].cp:null;
  }
}

function buildReview(engineData,ctx,prior){
  let classification=classifyAll(engineData,ctx,prior);
  const result={
    evals:engineData.evals,bestMoves:engineData.bestMoves,
    positionExact:new Array(engineData.evals.length).fill(true),
    moveVerified:new Array(ctx.ucis.length).fill(true),
    labels:classification.labels,
    losses:classification.lossPct.map(x=>x/100),
    lossPct:classification.lossPct,
    moveAccuracies:classification.moveAccuracies,
    moveDepths:classification.moveDepths,
    onlyGapPct:classification.onlyGapPct,
    whiteAccuracy:gameAccuracy(engineData.evals,'white'),
    blackAccuracy:gameAccuracy(engineData.evals,'black'),
    localDepths:engineData.depths,localPvs:engineData.pvs,secondBestCps:engineData.secondCps,
    localStockfishVersion:LOCAL_REVIEW_VERSION,
    reviewMethod:`Stockfish 19 local · every position depth ${BASE_DEPTH}, critical positions depth ${DEEP_DEPTH} · MultiPV 2 · Lichess Win% loss`,
    updated:Date.now()
  };
  Object.assign(prior,result);
  return prior;
}

async function deepCorrect(detail){
  if(auditing)return;
  const prior=detail?.data;if(!prior?.evals?.length)return;
  const ctx=build();if(ctx.positions.length!==prior.evals.length)return;
  if(prior.localStockfishVersion===LOCAL_REVIEW_VERSION){refreshMoveTags(prior);refreshSummary(prior);return}
  if(!await localStockfishAvailable()){const status=$('reviewStatus');if(status)status.textContent='Local Stockfish is unavailable; the quick review remains visible.';return}
  auditing=true;
  try{
    const status=$('reviewStatus');if(status)status.textContent='Starting authoritative local Stockfish review…';
    const engineData=await firstPass(ctx);
    const provisional=classifyAll(engineData,ctx,prior),targets=deepTargets(engineData,ctx,provisional);
    await deepen(engineData,ctx,targets);
    const data=buildReview(engineData,ctx,prior);
    refreshMoveTags(data);refreshSummary(data);await cacheSet('review',reviewKey(),data);
    if(status)status.textContent=`Stockfish Review v2 ready · all ${ctx.positions.length} positions evaluated · ${targets.length} deeply rechecked · ${data.labels.filter(x=>x==='Blunder').length} blunder${data.labels.filter(x=>x==='Blunder').length===1?'':'s'}.`;
    window.dispatchEvent(new CustomEvent('reviewNavigation'));
  }catch(e){
    const status=$('reviewStatus');if(status)status.textContent=`Local Stockfish review failed: ${e?.message||e}`;
  }finally{auditing=false}
}

window.addEventListener('gameReviewReady',e=>{deepCorrect(e.detail).catch(()=>{})});
