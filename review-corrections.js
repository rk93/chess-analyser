import './import-fix.js';
import './review-summary-navigation.js';
import './review-reliability.js';
import './puzzles.js';
import './ux-shell.js';
import './settings-fix.js';
import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm';
import { cacheSet,simpleHash } from './analysis-store.js';

const $=id=>document.getElementById(id);
const LABELS=['Brilliant','Great','Best','Excellent','Good','Book','Inaccuracy','Mistake','Blunder'];
const SYMBOL={Brilliant:'!!',Great:'!',Best:'★',Excellent:'👍',Good:'✓',Book:'📖',Inaccuracy:'?!',Mistake:'?',Blunder:'??'};
const BADGE={Brilliant:'brilliant',Great:'great',Best:'best',Excellent:'excellent',Good:'good',Book:'book',Inaccuracy:'inaccuracy',Mistake:'mistake',Blunder:'blunder'};
const VALUES={p:1,n:3,b:3,r:5,q:9,k:100};

function moveEls(){return [...document.querySelectorAll('#moves .move')]}
function sans(){return moveEls().map(e=>e.childNodes[0]?.textContent?.trim()||e.textContent.trim())}
function reviewKey(){return simpleHash(`${$('gameTitle')?.textContent||''}|${sans().join(' ')}`)}
function build(){const c=new Chess(),positions=[c.fen()],ucis=[];for(const san of sans()){try{const m=c.move(san);ucis.push(m.from+m.to+(m.promotion||''));positions.push(c.fen())}catch{return{positions:[],ucis:[]}}}return{positions,ucis}}
function terminalCp(fen){try{const c=new Chess(fen);if(c.isCheckmate())return c.turn()==='w'?-10000:10000;if(c.isDraw()||c.isStalemate()||c.isInsufficientMaterial())return 0}catch{}return null}
function cpLoss(before,after,ply){before=Number(before)||0;after=Number(after)||0;return Math.max(0,ply%2===1?before-after:after-before)}
function winProb(cp){return 1/(1+Math.exp(-0.00368208*(Number(cp)||0)))}
function winLoss(before,after,ply){const a=winProb(before),b=winProb(after);return Math.max(0,ply%2===1?a-b:b-a)}
function moverGain(before,after,ply){return ply%2===1?after-before:before-after}
function accuracy(cpls){if(!cpls.length)return 100;const xs=cpls.map(x=>Math.max(0,Math.min(1000,Number(x)||0))),mean=xs.reduce((a,b)=>a+b,0)/xs.length,rms=Math.sqrt(xs.reduce((a,b)=>a+b*b,0)/xs.length),effective=.65*mean+.35*rms;return Math.round(Math.max(0,Math.min(100,100*Math.exp(-effective/180)))*10)/10}
function sacrificeSequence(i,ctx,data){if(i+1>=ctx.ucis.length)return false;const played=ctx.ucis[i],next=ctx.ucis[i+1],s=sans();if(!played||!next||!s[i+1]?.includes('x'))return false;if(next.slice(2,4)!==played.slice(2,4))return false;if(data.bestMoves?.[i]!==played)return false;try{const c=new Chess(ctx.positions[i]),moving=c.get(played.slice(0,2)),captured=c.get(played.slice(2,4));if(!moving)return false;const invested=VALUES[moving.type]||0,won=VALUES[captured?.type]||0;if(invested<3||invested-won<2)return false;const afterReply=data.evals?.[i+2];if(afterReply==null)return false;return moverGain(data.evals[i],afterReply,i+1)>=-35}catch{return false}}
function classify(i,ctx,data){const ply=i+1,before=data.evals[i],after=data.evals[i+1],cpl=cpLoss(before,after,ply),wpl=winLoss(before,after,ply),played=ctx.ucis[i],best=data.bestMoves?.[i]||'',verified=!!data.positionExact?.[i]&&!!data.positionExact?.[i+1],san=sans()[i]||'',matched=!!best&&best===played;
  if(verified&&matched&&san.endsWith('#'))return'Best';
  if(verified&&matched&&sacrificeSequence(i,ctx,data)&&cpl<=35)return'Brilliant';
  if(verified&&matched&&cpl<=8&&Math.abs(moverGain(before,after,ply))>=70)return'Great';
  if(verified&&matched)return'Best';
  if(wpl>=.28||cpl>=260)return'Blunder';
  if(wpl>=.14||cpl>=160)return'Mistake';
  if(wpl>=.06||cpl>=80)return'Inaccuracy';
  if(!verified)return cpl<=50?'Good':'Inaccuracy';
  if(cpl<=12)return'Excellent';
  if(cpl<=45)return'Good';
  return'Inaccuracy';
}
function recalc(data,ctx){for(let i=0;i<ctx.positions.length;i++){const t=terminalCp(ctx.positions[i]);if(t!==null){data.evals[i]=t;data.positionExact[i]=true;if(i<data.bestMoves.length)data.bestMoves[i]=''}}const cpls=[],losses=[],labels=[],verified=[],wc=[],bc=[];for(let i=0;i<ctx.ucis.length;i++){const ply=i+1,cpl=cpLoss(data.evals[i],data.evals[i+1],ply),loss=winLoss(data.evals[i],data.evals[i+1],ply),v=!!data.positionExact?.[i]&&!!data.positionExact?.[i+1];cpls.push(cpl);losses.push(loss);verified.push(v);labels.push(classify(i,ctx,data));(ply%2?wc:bc).push(cpl)}data.cpLosses=cpls;data.losses=losses;data.labels=labels;data.moveVerified=verified;data.whiteAccuracy=accuracy(wc);data.blackAccuracy=accuracy(bc);data.correctionVersion=2;data.accuracyMethod='centipawn-loss-v2';return data}
function countBySide(data){const out={white:Object.fromEntries(LABELS.map(x=>[x,0])),black:Object.fromEntries(LABELS.map(x=>[x,0]))};data.labels.forEach((x,i)=>out[i%2===0?'white':'black'][x]++);return out}
function refreshMoveTags(data){const els=moveEls();els.forEach((el,i)=>{const tag=el.querySelector('.moveTag');if(tag){tag.className='moveTag tag-'+String(data.labels[i]||'Good').toLowerCase();tag.textContent=data.labels[i]||'Good';tag.title=data.moveVerified[i]?'Engine-verified classification':'Estimated classification'}const practice=el.querySelector('.practiceMove');if(practice&&!(data.moveVerified[i]&&(data.labels[i]==='Mistake'||data.labels[i]==='Blunder')))practice.remove()})}
function refreshSummary(data){if($('whiteAccuracy'))$('whiteAccuracy').textContent=Number(data.whiteAccuracy).toFixed(1);if($('blackAccuracy'))$('blackAccuracy').textContent=Number(data.blackAccuracy).toFixed(1);const names=($('gameTitle')?.textContent||'White — Black').split(' — '),players=$('reviewSummaryPlayers');if(players)players.innerHTML=`<div class="reviewSummaryPlayer"><div class="name">${names[0]||'White'}</div><div class="accuracy">${Number(data.whiteAccuracy).toFixed(1)}</div></div><div class="reviewSummaryPlayer"><div class="name">${names[1]||'Black'}</div><div class="accuracy">${Number(data.blackAccuracy).toFixed(1)}</div></div>`;const counts=countBySide(data),breakdown=$('reviewBreakdown');if(breakdown)breakdown.innerHTML=LABELS.map(label=>`<div class="reviewBreakRow"><span class="label">${label}</span><span class="left">${counts.white[label]||0}</span><span class="reviewBreakIcon badge-${BADGE[label]}">${SYMBOL[label]}</span><span class="right">${counts.black[label]||0}</span></div>`).join('')}
async function correct(detail){const data=detail?.data;if(!data?.evals?.length)return;const ctx=build();if(ctx.positions.length!==data.evals.length)return;recalc(data,ctx);refreshMoveTags(data);refreshSummary(data);await cacheSet('review',reviewKey(),data);window.dispatchEvent(new CustomEvent('reviewNavigation'));}
window.addEventListener('gameReviewReady',e=>{correct(e.detail).catch(()=>{})});
