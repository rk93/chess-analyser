import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm';
import { cacheSet,simpleHash } from './analysis-store.js';

const $=id=>document.getElementById(id);
const LABELS=['Brilliant','Great','Best','Excellent','Good','Book','Inaccuracy','Mistake','Blunder'];
let applying=false,lastFingerprint='';

function moveEls(){return [...document.querySelectorAll('#moves .move')]}
function sans(){return moveEls().map(e=>e.childNodes[0]?.textContent?.trim()||e.textContent.trim())}
function reviewKey(){return simpleHash(`${$('gameTitle')?.textContent||''}|${sans().join(' ')}`)}
function build(){const c=new Chess(),positions=[c.fen()],ucis=[];for(const san of sans()){try{const m=c.move(san);ucis.push(m.from+m.to+(m.promotion||''));positions.push(c.fen())}catch{return null}}return{positions,ucis}}
function cpl(before,after,ply){before=Number(before)||0;after=Number(after)||0;return Math.max(0,ply%2===1?before-after:after-before)}
function moverGain(before,after,ply){return ply%2===1?after-before:before-after}
function terminalCp(fen){try{const c=new Chess(fen);if(c.isCheckmate())return c.turn()==='w'?-10000:10000;if(c.isDraw()||c.isStalemate()||c.isInsufficientMaterial())return 0}catch{}return null}

// Lichess cloud cp and chess-api eval are treated as White-perspective scores.
// Older review-pro builds flipped every Black-to-move position, creating the
// alternating saw-tooth graph and dozens of false blunders. Repair only when
// flipping an odd-index score makes the local evaluation sequence substantially smoother.
function repairPerspective(values){const out=(values||[]).map(v=>Number.isFinite(Number(v))?Number(v):0);let flips=0;for(let i=1;i<out.length;i+=2){const v=out[i],prev=out[i-1],next=i+1<out.length?out[i+1]:null;if(!Number.isFinite(v)||!Number.isFinite(prev))continue;const keep=Math.abs(v-prev)+(next==null?0:Math.abs(next-v));const flipped=-v;const flip=Math.abs(flipped-prev)+(next==null?0:Math.abs(next-flipped));const margin=Math.max(35,Math.min(160,Math.abs(v)*.12));if(flip+margin<keep){out[i]=flipped;flips++}}return{evals:out,flips}}
function classify(i,ctx,data){const ply=i+1,before=data.evals[i],after=data.evals[i+1],loss=cpl(before,after,ply),played=ctx.ucis[i],best=data.bestMoves?.[i]||'',verified=!!data.positionExact?.[i]&&!!data.positionExact?.[i+1],matched=!!best&&best===played;if(verified&&matched){const gain=moverGain(before,after,ply);if(i>8&&loss<=8&&gain>=140)return'Brilliant';if(i>8&&loss<=12&&gain>=65)return'Great';return'Best'}if(i<10&&loss<=28)return'Book';if(loss<=35)return'Excellent';if(loss<=85)return'Good';if(loss<=150)return'Inaccuracy';if(loss<=280)return'Mistake';return'Blunder'}
function countBlunders(labels){return (labels||[]).filter(x=>x==='Blunder').length}
function refreshSummary(data){const counts={white:Object.fromEntries(LABELS.map(x=>[x,0])),black:Object.fromEntries(LABELS.map(x=>[x,0]))};data.labels.forEach((x,i)=>counts[i%2===0?'white':'black'][x]++);const root=$('reviewBreakdown');if(root)root.querySelectorAll('.reviewBreakRow').forEach(row=>{const label=row.querySelector('.label')?.textContent?.trim();if(!label||!counts.white.hasOwnProperty(label))return;const left=row.querySelector('.left'),right=row.querySelector('.right');if(left)left.textContent=counts.white[label]||0;if(right)right.textContent=counts.black[label]||0})}
function refreshTags(data){moveEls().forEach((el,i)=>{const tag=el.querySelector('.moveTag');if(tag){const label=data.labels[i]||'Good';tag.className='moveTag tag-'+label.toLowerCase();tag.textContent=label;tag.title=data.moveVerified?.[i]?'Engine-verified classification':'Estimated classification'}})}
function fingerprint(data){return `${reviewKey()}|${data?.evals?.length||0}|${(data?.evals||[]).slice(0,8).join(',')}|${data?.accuracyMethod||''}|${data?.correctionVersion||0}`}
async function repair(data){if(applying||!data?.evals?.length)return;if(Number(data.localStockfishVersion)>=20)return;const ctx=build();if(!ctx||ctx.positions.length!==data.evals.length)return;const fp=fingerprint(data);if(fp===lastFingerprint&&data.evalPerspective==='white-v2')return;applying=true;try{const repaired=repairPerspective(data.evals),beforeBlunders=countBlunders(data.labels);data.evals=repaired.evals;for(let i=0;i<ctx.positions.length;i++){const t=terminalCp(ctx.positions[i]);if(t!==null)data.evals[i]=t}const labels=[],losses=[];for(let i=0;i<ctx.ucis.length;i++){const loss=cpl(data.evals[i],data.evals[i+1],i+1);losses.push(loss);labels.push(classify(i,ctx,data))}data.labels=labels;data.cpLosses=losses;data.losses=losses;data.evalPerspective='white-v2';data.perspectiveRepairFlips=repaired.flips;data.correctionVersion=Math.max(9,Number(data.correctionVersion)||0);data.accuracyMethod='white-perspective-cpl-v9';refreshTags(data);refreshSummary(data);lastFingerprint=fingerprint(data);await cacheSet('review',reviewKey(),data).catch(()=>{});const afterBlunders=countBlunders(labels);window.dispatchEvent(new CustomEvent('reviewPerspectiveFixed',{detail:{data,flips:repaired.flips,beforeBlunders,afterBlunders}}))}finally{applying=false}}
function schedule(data){clearTimeout(schedule.t);schedule.t=setTimeout(()=>repair(data).catch(()=>{}),35)}
window.addEventListener('gameReviewReady',e=>schedule(e.detail?.data));
window.addEventListener('reviewNavigation',()=>{const data=window.__lastReviewData;if(data)schedule(data)});
window.addEventListener('reviewPerspectiveCandidate',e=>schedule(e.detail?.data));
window.addEventListener('reviewPerspectiveFixed',e=>{window.__lastReviewData=e.detail?.data||window.__lastReviewData});
