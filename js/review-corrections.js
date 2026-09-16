import './import-fix.js';
import './review-quality.js';
import './review-summary-navigation.js';
import './review-reliability.js';
import './review-pro.js';
import './review-polish.js';
import './puzzles.js';
import './ux-shell.js';
import './settings-fix.js';
import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm';
import { cacheSet,simpleHash } from './analysis-store.js';
import { getLocalStockfish,localStockfishAvailable } from './local-stockfish.js';
import { gameAccuracy,lichessJudgement,moveAccuracy,classifyReviewedMove } from './lichess-review.js';

const $=id=>document.getElementById(id);
const LABELS=['Brilliant','Great','Best','Excellent','Good','Book','Inaccuracy','Mistake','Blunder'];
const SYMBOL={Brilliant:'!!',Great:'!',Best:'★',Excellent:'✓',Good:'✓',Book:'📖',Inaccuracy:'?!',Mistake:'?',Blunder:'??'};
const BADGE={Brilliant:'brilliant',Great:'great',Best:'best',Excellent:'excellent',Good:'good',Book:'book',Inaccuracy:'inaccuracy',Mistake:'mistake',Blunder:'blunder'};
const LOCAL_REVIEW_VERSION=19;
let auditing=false;

function moveEls(){return [...document.querySelectorAll('#moves .move')]}
function sans(){return moveEls().map(e=>e.childNodes[0]?.textContent?.trim()||e.textContent.trim())}
function reviewKey(){return simpleHash(`${$('gameTitle')?.textContent||''}|${sans().join(' ')}`)}
function build(){const c=new Chess(),positions=[c.fen()],ucis=[];for(const san of sans()){try{const m=c.move(san);ucis.push(m.from+m.to+(m.promotion||''));positions.push(c.fen())}catch{return{positions:[],ucis:[]}}}return{positions,ucis}}
function terminalEval(fen){try{const c=new Chess(fen);if(c.isCheckmate())return c.turn()==='w'?-100000:100000;if(c.isDraw()||c.isStalemate()||c.isInsufficientMaterial())return 0}catch{}return null}
function queenCaptureAvailable(fen){try{return new Chess(fen).moves({verbose:true}).some(m=>m.captured==='q')}catch{return false}}

function countBySide(data){const out={white:Object.fromEntries(LABELS.map(x=>[x,0])),black:Object.fromEntries(LABELS.map(x=>[x,0]))};data.labels.forEach((x,i)=>out[i%2===0?'white':'black'][x]=(out[i%2===0?'white':'black'][x]||0)+1);return out}
function refreshMoveTags(data){const els=moveEls();els.forEach((el,i)=>{let tag=el.querySelector('.moveTag');if(!tag){tag=document.createElement('span');el.appendChild(tag)}const label=data.labels[i]||'Good';tag.className='moveTag tag-'+label.toLowerCase();tag.textContent=label;tag.title='Stockfish 19 local · Lichess-style classification';const practice=el.querySelector('.practiceMove');if(practice&&!(label==='Mistake'||label==='Blunder'))practice.remove()})}
function refreshSummary(data){
  if($('whiteAccuracy'))$('whiteAccuracy').textContent=Number(data.whiteAccuracy).toFixed(1);
  if($('blackAccuracy'))$('blackAccuracy').textContent=Number(data.blackAccuracy).toFixed(1);
  const names=($('gameTitle')?.textContent||'White — Black').split(' — '),players=$('reviewSummaryPlayers');
  if(players)players.innerHTML=`<div class="reviewSummaryPlayer"><div class="name">${names[0]||'White'}</div><div class="accuracy">${Number(data.whiteAccuracy).toFixed(1)}</div></div><div class="reviewSummaryPlayer"><div class="name">${names[1]||'Black'}</div><div class="accuracy">${Number(data.blackAccuracy).toFixed(1)}</div></div>`;
  const counts=countBySide(data),breakdown=$('reviewBreakdown');
  if(breakdown)breakdown.innerHTML=LABELS.map(label=>`<div class="reviewBreakRow"><span class="label">${label}</span><span class="left">${counts.white[label]||0}</span><span class="reviewBreakIcon badge-${BADGE[label]}">${SYMBOL[label]}</span><span class="right">${counts.black[label]||0}</span></div>`).join('');
  const headline=$('reviewHeadlineCard'),blunders=data.labels.filter(x=>x==='Blunder').length,mistakes=data.labels.filter(x=>x==='Mistake').length;
  if(headline)headline.textContent=blunders?`${blunders} blunder${blunders===1?'':'s'} found by local Stockfish. Review the largest evaluation swings.`:mistakes?`No blunders, but ${mistakes} mistake${mistakes===1?'':'s'} found by local Stockfish.`:'A clean Stockfish review with no major evaluation drops.';
}

async function analyseAllPositions(ctx){
  const engine=getLocalStockfish();await engine.ready();engine.newGame();
  const evals=new Array(ctx.positions.length),bestMoves=new Array(ctx.positions.length).fill(''),depths=new Array(ctx.positions.length).fill(0),pvs=new Array(ctx.positions.length).fill('');
  let completed=0;
  for(let i=ctx.positions.length-1;i>=0;i--){
    const t=terminalEval(ctx.positions[i]);
    if(t!==null){evals[i]=t;depths[i]=99;completed++;continue}
    const status=$('reviewStatus');if(status)status.textContent=`Local Stockfish review ${completed+1}/${ctx.positions.length} · depth 14…`;
    const r=await engine.analyse(ctx.positions[i],{depth:14});evals[i]=r.cp;bestMoves[i]=r.best||'';depths[i]=r.depth||14;pvs[i]=r.pv||'';completed++;
  }
  const deep=new Set();
  for(let ply=1;ply<evals.length;ply++){
    const judgement=lichessJudgement(evals[ply-1],evals[ply],ply);
    if(judgement||moveAccuracy(evals[ply-1],evals[ply],ply)<85||queenCaptureAvailable(ctx.positions[ply])){deep.add(ply-1);deep.add(ply)}
  }
  const indexes=[...deep].filter(i=>i>=0&&i<ctx.positions.length&&terminalEval(ctx.positions[i])===null).sort((a,b)=>b-a);
  for(let n=0;n<indexes.length;n++){
    const i=indexes[n],status=$('reviewStatus');if(status)status.textContent=`Deep tactical verification ${n+1}/${indexes.length} · Stockfish depth 18…`;
    const r=await engine.analyse(ctx.positions[i],{depth:18});evals[i]=r.cp;bestMoves[i]=r.best||bestMoves[i];depths[i]=r.depth||18;pvs[i]=r.pv||pvs[i];
  }
  return{evals,bestMoves,depths,pvs};
}

function buildReview(engineData,ctx,prior){
  const labels=[],losses=[],moveAccuracies=[],verified=new Array(ctx.ucis.length).fill(true);
  for(let i=0;i<ctx.ucis.length;i++){
    const ply=i+1,before=engineData.evals[i],after=engineData.evals[i+1],best=engineData.bestMoves[i]||'',played=ctx.ucis[i],isBook=ply<=10;
    let label=classifyReviewedMove({before,after,ply,played,best,isBook});
    if(label==='Best'&&(prior?.labels?.[i]==='Brilliant'||prior?.labels?.[i]==='Great'))label=prior.labels[i];
    labels.push(label);losses.push(Math.max(0,1-moveAccuracy(before,after,ply)/100));moveAccuracies.push(moveAccuracy(before,after,ply));
  }
  return{
    ...prior,
    evals:engineData.evals,
    bestMoves:engineData.bestMoves,
    positionExact:new Array(engineData.evals.length).fill(true),
    moveVerified:verified,
    labels,losses,moveAccuracies,
    whiteAccuracy:gameAccuracy(engineData.evals,'white'),
    blackAccuracy:gameAccuracy(engineData.evals,'black'),
    localDepths:engineData.depths,
    localPvs:engineData.pvs,
    localStockfishVersion:LOCAL_REVIEW_VERSION,
    reviewMethod:'Stockfish 19 local + Lichess winning-chance thresholds',
    updated:Date.now()
  };
}

async function deepCorrect(detail){
  if(auditing)return;const prior=detail?.data;if(!prior?.evals?.length)return;
  const ctx=build();if(ctx.positions.length!==prior.evals.length)return;
  if(prior.localStockfishVersion===LOCAL_REVIEW_VERSION){refreshMoveTags(prior);refreshSummary(prior);return}
  if(!await localStockfishAvailable()){const status=$('reviewStatus');if(status)status.textContent='Local Stockfish engine is not available yet; using network review.';return}
  auditing=true;
  try{
    const status=$('reviewStatus');if(status)status.textContent='Starting full local Stockfish 19 review…';
    const engineData=await analyseAllPositions(ctx),data=buildReview(engineData,ctx,prior);
    refreshMoveTags(data);refreshSummary(data);await cacheSet('review',reviewKey(),data);
    if(status)status.textContent=`Deep review ready · every position evaluated by Stockfish 19 · ${data.labels.filter(x=>x==='Blunder').length} blunder${data.labels.filter(x=>x==='Blunder').length===1?'':'s'} found.`;
    window.dispatchEvent(new CustomEvent('reviewNavigation'));
  }catch(e){const status=$('reviewStatus');if(status)status.textContent=`Local Stockfish review failed: ${e?.message||e}`}
  finally{auditing=false}
}

window.addEventListener('gameReviewReady',e=>{deepCorrect(e.detail).catch(()=>{})});
