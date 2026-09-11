import { cacheGet,cacheSet,simpleHash } from './analysis-store.js';

const $=id=>document.getElementById(id);
const LABEL_SCORE={Brilliant:100,Great:100,Best:100,Excellent:96,Good:90,Book:100,Inaccuracy:76,Mistake:52,Blunder:24};
let applying=false,lastKey='';

function moveEls(){return [...document.querySelectorAll('#moves .move')]}
function sans(){return moveEls().map(e=>e.childNodes[0]?.textContent?.trim()||e.textContent.trim())}
function reviewKey(){return simpleHash(`${$('gameTitle')?.textContent||''}|${sans().join(' ')}`)}
function winPct(cp){const x=Math.max(-1000,Math.min(1000,Number(cp)||0));return 100/(1+Math.exp(-0.00368208*x))}
function moveWinLoss(before,after,ply){const a=winPct(before),b=winPct(after);return Math.max(0,ply%2===1?a-b:b-a)}
function verifiedMoveAccuracy(lossPct){const v=103.1668*Math.exp(-0.04354*Math.max(0,lossPct))-3.1668;return Math.max(0,Math.min(100,v))}
function fallbackAccuracy(label){return LABEL_SCORE[label]??90}
function sideAccuracy(data,side){const values=[];for(let i=side;i<(data.labels?.length||0);i+=2){const verified=!!data.moveVerified?.[i]&&Number.isFinite(Number(data.evals?.[i]))&&Number.isFinite(Number(data.evals?.[i+1]));if(verified){values.push(verifiedMoveAccuracy(moveWinLoss(data.evals[i],data.evals[i+1],i+1)))}else values.push(fallbackAccuracy(data.labels[i]))}if(!values.length)return 100;const arithmetic=values.reduce((a,b)=>a+b,0)/values.length;const harmonic=values.length/values.reduce((s,v)=>s+1/Math.max(20,v),0);const severe=values.filter(v=>v<45).length,weak=values.filter(v=>v>=45&&v<70).length;const score=.78*arithmetic+.22*harmonic-Math.min(4,severe*.65+weak*.18);return Math.round(Math.max(0,Math.min(100,score))*10)/10}
function updateAccuracyDom(data){const wa=Number(data.whiteAccuracy),ba=Number(data.blackAccuracy);if($('whiteAccuracy'))$('whiteAccuracy').textContent=wa.toFixed(1);if($('blackAccuracy'))$('blackAccuracy').textContent=ba.toFixed(1);const cards=$('reviewSummaryPlayers')?.querySelectorAll('.reviewSummaryPlayer .accuracy');if(cards?.[0])cards[0].textContent=wa.toFixed(1);if(cards?.[1])cards[1].textContent=ba.toFixed(1)}
function ensureBackButton(){const actions=document.querySelector('#reviewGuideCard .reviewGuideActions');if(!actions||$('reviewPrev'))return;const next=$('reviewNext'),b=document.createElement('button');b.id='reviewPrev';b.className='btn';b.type='button';b.textContent='Previous';b.addEventListener('click',()=>{$('prev')?.click();setTimeout(updateBackState,0)});actions.insertBefore(b,next||actions.firstChild);updateBackState()}
function updateBackState(){const b=$('reviewPrev');if(!b)return;const els=moveEls(),i=els.findIndex(x=>x.classList.contains('active'));b.disabled=i<=0;b.setAttribute('aria-disabled',String(i<=0))}
async function polish(){if(applying)return;const k=reviewKey();if(!k)return;const data=await cacheGet('review',k).catch(()=>null);if(!data?.labels?.length)return;applying=true;try{const white=sideAccuracy(data,0),black=sideAccuracy(data,1);const changed=Math.abs(Number(data.whiteAccuracy)-white)>.05||Math.abs(Number(data.blackAccuracy)-black)>.05||data.accuracyMethod!=='contextual-winloss-v7';data.whiteAccuracy=white;data.blackAccuracy=black;data.accuracyMethod='contextual-winloss-v7';data.correctionVersion=Math.max(7,Number(data.correctionVersion)||0);updateAccuracyDom(data);ensureBackButton();updateBackState();if(changed)await cacheSet('review',k,data).catch(()=>{});lastKey=k}finally{applying=false}}
function schedule(){clearTimeout(schedule.t);schedule.t=setTimeout(()=>polish().catch(()=>{}),80)}
window.addEventListener('gameReviewReady',schedule);
window.addEventListener('reviewNavigation',schedule);
document.addEventListener('click',e=>{if(e.target.closest?.('#reviewStartBtn,#reviewNext,#reviewPrev,#reviewBreakdown .left,#reviewBreakdown .right,.reviewProMoveChip'))setTimeout(()=>{ensureBackButton();updateBackState()},0)},true);
new MutationObserver(()=>{if(document.getElementById('reviewGuideCard')){ensureBackButton();updateBackState()}}).observe(document.documentElement,{childList:true,subtree:true});
