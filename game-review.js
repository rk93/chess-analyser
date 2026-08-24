import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm';
import { cacheGet,cacheSet,getPositionEval,setPositionEval,simpleHash } from './analysis-store.js';

const $=id=>document.getElementById(id);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const REVIEW_VERSION=6;
const MAX_FRESH_CLOUD=36;
const CLOUD_CONCURRENCY=4;
const LIVE_FALLBACK_LIMIT=4;
let running=false,reviewToken=0,restoreTimer=null,activeReview=null,summaryShownForKey='';

const LABELS=['Brilliant','Great','Best','Excellent','Good','Book','Inaccuracy','Mistake','Blunder'];
const SYMBOL={Brilliant:'!!',Great:'!',Best:'★',Excellent:'👍',Good:'✓',Book:'📖',Inaccuracy:'?!',Mistake:'?',Blunder:'??'};
const BADGE={Brilliant:'brilliant',Great:'great',Best:'best',Excellent:'excellent',Good:'good',Book:'book',Inaccuracy:'inaccuracy',Mistake:'mistake',Blunder:'blunder'};

function ensureStyles(){if(document.getElementById('reviewExperienceStyles'))return;const l=document.createElement('link');l.id='reviewExperienceStyles';l.rel='stylesheet';l.href='review-experience.css';document.head.appendChild(l)}
function moveEls(){return [...document.querySelectorAll('#moves .move')]}
function moveSans(){return moveEls().map(e=>e.childNodes[0]?.textContent?.trim()||e.textContent.trim())}
function currentPly(){const els=moveEls(),i=els.findIndex(e=>e.classList.contains('active'));return i<0?0:i+1}
function buildPositions(){const c=new Chess(),out=[{fen:c.fen(),ply:0}];for(const san of moveSans()){try{c.move(san);out.push({fen:c.fen(),ply:out.length})}catch{return []}}return out}
function playedUcis(){const c=new Chess(),out=[];for(const san of moveSans()){try{const m=c.move(san);out.push(m.from+m.to+(m.promotion||''))}catch{out.push('')}}return out}
function cpFromPv(pv){if(pv?.mate!==undefined&&pv?.mate!==null&&Number(pv.mate)!==0)return Number(pv.mate)>0?10000:-10000;return Number(pv?.cp)||0}
function firstMove(moves){const u=String(moves||'').trim().split(/\s+/)[0];return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(u)?u:''}
function sanForUci(fen,uci){if(!uci)return'';try{const c=new Chess(fen),m=c.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]||undefined});return m?.san||uci}catch{return uci}}
function reviewKey(){return simpleHash(`${$('gameTitle')?.textContent||''}|${moveSans().join(' ')}`)}
function canonical(data){return data?.pvs?.length?data:null}
function signalRunning(value){window.dispatchEvent(new CustomEvent('gameReviewRunning',{detail:{running:value}}))}
async function fetchTimeout(url,options={},ms=2400){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),ms);try{return await fetch(url,{...options,signal:controller.signal})}finally{clearTimeout(timer)}}

async function cloudEval(fen,{network=true}={}){
  let data=canonical(await getPositionEval('cloud',fen));
  if(!data&&network){
    const r=await fetchTimeout(`https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=3&variant=standard`,{headers:{Accept:'application/json'}},2200);
    if(r.status===404)return null;
    if(r.status===429)throw Object.assign(new Error('Cloud rate limited'),{rateLimited:true});
    if(!r.ok)throw new Error(`Cloud ${r.status}`);
    const j=await r.json();
    if(!j.pvs?.length)return null;
    data={source:'Lichess cloud',depth:j.depth||0,pvs:j.pvs.slice(0,3)};
    await setPositionEval('cloud',fen,data);
  }
  if(!data)return null;
  const pv=data.pvs[0];
  return{cp:cpFromPv(pv),best:firstMove(pv.moves),depth:data.depth||0,source:'cloud'};
}
async function liveEval(fen){
  let data=canonical(await getPositionEval('live',fen));
  if(!data){
    const r=await fetchTimeout('https://chess-api.com/v1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fen,depth:12,variants:1,maxThinkingTime:110})},4200);
    if(!r.ok)throw new Error(`Live ${r.status}`);
    const j=await r.json(),best=j.move||j.lan||'',cont=Array.isArray(j.continuationArr)?j.continuationArr.filter(Boolean):[],moves=[best,...cont.filter((m,i)=>!(i===0&&m===best))].filter(Boolean).join(' '),cp=j.eval!=null?Math.round(Number(j.eval)*100):Number(j.centipawns)||0;
    data={source:'Stockfish live',depth:j.depth||12,pvs:[{cp,mate:j.mate,moves}]};
    await setPositionEval('live',fen,data);
  }
  const pv=data.pvs[0];
  return{cp:cpFromPv(pv),best:firstMove(pv.moves),depth:data.depth||12,source:'live'};
}

function winProb(cp){const pawns=Math.max(-10,Math.min(10,cp/100));return 1/(1+Math.exp(-1.25*pawns))}
function moveLoss(before,after,ply){const wb=winProb(before),wa=winProb(after);return Math.max(0,ply%2===1?wb-wa:wa-wb)}
function basicClassify(loss){if(loss<=.004)return'Best';if(loss<=.014)return'Excellent';if(loss<=.04)return'Good';if(loss<=.09)return'Inaccuracy';if(loss<=.18)return'Mistake';return'Blunder'}
function moverGainCp(before,after,ply){return ply%2===1?after-before:before-after}
function classifyMove({loss,ply,before,after,played,best,verified}){
  const base=basicClassify(loss);
  if(!verified)return base;
  const matched=!!best&&played===best,gain=moverGainCp(before,after,ply);
  if(ply<=10&&loss<=.04)return'Book';
  if(matched&&loss<=.004&&gain>=150)return'Brilliant';
  if(matched&&loss<=.008&&gain>=70)return'Great';
  return base;
}
function accuracy(losses){if(!losses.length)return 100;const scores=losses.map(l=>100*Math.exp(-4.2*l));return Math.round(Math.max(0,Math.min(100,scores.reduce((a,b)=>a+b,0)/scores.length))*10)/10}
function interpolate(evals){for(let i=0;i<evals.length;i++){if(evals[i]!=null)continue;let a=i-1,b=i+1;while(a>=0&&evals[a]==null)a--;while(b<evals.length&&evals[b]==null)b++;if(a>=0&&b<evals.length)evals[i]=Math.round(evals[a]+(evals[b]-evals[a])*(i-a)/(b-a));else if(a>=0)evals[i]=evals[a];else if(b<evals.length)evals[i]=evals[b];else evals[i]=0}}

function clearTags(){document.querySelectorAll('#moves .moveTag,#moves .practiceMove').forEach(e=>e.remove())}
function launchPractice(e,detail){e?.preventDefault?.();e?.stopPropagation?.();window.dispatchEvent(new CustomEvent('practiceMistake',{detail}))}
function practiceDetail(i,data,positions,sans){const best=data.bestMoves?.[i]||'',before=positions[i]?.fen;if(!best||!before)return null;return{fen:before,badMove:sans[i]||'',label:data.labels[i],ply:i+1,moveNumber:Math.floor(i/2)+1,side:i%2===0?'White':'Black',bestMove:best,bestSan:sanForUci(before,best)}}
function renderTags(data,positions,sans){
  clearTags();
  const els=moveEls();
  data.labels.forEach((label,i)=>{
    if(!els[i])return;
    const verified=!!data.moveVerified?.[i],tag=document.createElement('span');
    tag.className='moveTag tag-'+label.toLowerCase();tag.textContent=label;tag.title=verified?'Engine-verified classification':'Estimated from nearby reviewed positions';els[i].appendChild(tag);
    if(!verified||(label!=='Mistake'&&label!=='Blunder')||!data.bestMoves?.[i])return;
    const detail=practiceDetail(i,data,positions,sans),btn=document.createElement('button');btn.type='button';btn.className='practiceMove';btn.textContent='Practice';btn.addEventListener('click',e=>launchPractice(e,detail));els[i].appendChild(btn);
  });
}
function countBySide(data){const out={white:Object.fromEntries(LABELS.map(x=>[x,0])),black:Object.fromEntries(LABELS.map(x=>[x,0]))};data.labels.forEach((x,i)=>out[i%2===0?'white':'black'][x]=(out[i%2===0?'white':'black'][x]||0)+1);return out}
function renderSummary(labels){const counts=Object.fromEntries(LABELS.map(k=>[k,0]));labels.forEach(x=>counts[x]++);$('reviewSummary').innerHTML=LABELS.filter(k=>counts[k]).map(k=>`<span class="reviewCount tag-${k.toLowerCase()}"><b>${counts[k]}</b> ${k}</span>`).join('')}
function graphSvg(evals,losses){const w=620,h=180,pad=12,clamp=v=>Math.max(-600,Math.min(600,v)),xs=i=>pad+(w-pad*2)*(i/Math.max(1,evals.length-1)),ys=v=>h/2-(clamp(v)/600)*(h/2-pad);let path='';evals.forEach((v,i)=>{path+=(i?' L':'M')+xs(i).toFixed(1)+' '+ys(v).toFixed(1)});let maxIdx=1,maxLoss=-1;losses.forEach((l,i)=>{if(l>maxLoss){maxLoss=l;maxIdx=i+1}});const mx=xs(maxIdx),my=ys(evals[maxIdx]||0);return`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Evaluation graph"><line x1="${pad}" y1="${h/2}" x2="${w-pad}" y2="${h/2}" class="reviewZero"/><path d="${path}" class="reviewLine"/><circle cx="${mx}" cy="${my}" r="6" class="reviewSwing"/></svg>`}
function renderGraph(evals,losses){const root=$('reviewGraph');root.innerHTML=graphSvg(evals,losses);root.hidden=false}
function scoreLabel(cp){const n=(Number(cp)||0)/100;return (n>=0?'+':'')+n.toFixed(2)}
function setEvalBar(cp){const n=(Number(cp)||0)/100;$('evalFill').style.height=`${Math.max(3,Math.min(97,50+45*(2/Math.PI)*Math.atan(n/3)))}%`}
function drawBestArrow(uci){const svg=$('analysisArrows');if(!svg)return;svg.innerHTML='';if(!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci||''))return;const point=sq=>{const board=$('board'),el=board?.querySelector(`[data-square="${sq}"]`);if(!board||!el)return null;const br=board.getBoundingClientRect(),r=el.getBoundingClientRect();return{x:((r.left+r.width/2-br.left)/br.width)*800,y:((r.top+r.height/2-br.top)/br.height)*800}};const a=point(uci.slice(0,2)),b=point(uci.slice(2,4));if(!a||!b)return;svg.innerHTML=`<defs><marker id="reviewArrow" markerWidth="5" markerHeight="5" refX="4.1" refY="2.5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L5,2.5 L0,5 Z" fill="#8bc34a"/></marker></defs><line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#8bc34a" stroke-width="16" stroke-linecap="round" opacity=".88" marker-end="url(#reviewArrow)"/>`}

function ensureGuideCard(){
  let card=$('reviewGuideCard');if(card)return card;
  card=document.createElement('section');card.id='reviewGuideCard';card.className='reviewGuideCard';card.hidden=true;
  card.innerHTML=`<div class="reviewGuideTitle"><span id="reviewGuideIcon"></span><span id="reviewGuideMove">Game review</span><span id="reviewGuideEval" class="reviewGuideEval">—</span></div><div id="reviewGuideComment" class="reviewGuideComment"></div><div id="reviewGuideMeta" class="reviewGuideMeta"></div><div class="reviewGuideActions"><button id="reviewShowBest" class="btn" type="button">Show best</button><button id="reviewPractice" class="btn" type="button">Practice</button><button id="reviewNext" class="btn primary" type="button">Next</button></div>`;
  const shell=document.querySelector('#analysisView .analysisShell');shell?.parentNode?.insertBefore(card,shell);
  $('reviewNext')?.addEventListener('click',()=>$('next')?.click());
  return card;
}
function clearBoardBadge(){document.querySelectorAll('#board .boardReviewBadge').forEach(x=>x.remove())}
function showBoardBadge(label,uci){clearBoardBadge();if(!uci)return;const sq=uci.slice(2,4),el=$('board')?.querySelector(`[data-square="${sq}"]`);if(!el)return;const b=document.createElement('span');b.className=`boardReviewBadge badge-${BADGE[label]||'good'}`;b.textContent=SYMBOL[label]||'✓';b.title=label;el.appendChild(b)}
function commentForMove({label,played,bestSan,verified,before,after,ply}){
  const swing=Math.abs((Number(after)||0)-(Number(before)||0))/100;
  if(label==='Book')return`${played} is a book move. It follows a well-established opening path and keeps the position sound.`;
  if(label==='Brilliant')return`${played} is a brilliant move. It finds the engine's top idea and creates a major tactical improvement.`;
  if(label==='Great')return`${played} is a great move. It finds a strong engine idea and improves the position significantly.`;
  if(label==='Best')return`${played} is the best move. You matched the engine's top choice in this position.`;
  if(label==='Excellent')return`${played} is excellent. It stays very close to the best continuation.`;
  if(label==='Good')return`${played} is a good move. The position remains healthy with only a small loss compared with best play.`;
  if(label==='Inaccuracy')return`${played} is an inaccuracy. The evaluation shifted by about ${swing.toFixed(1)} pawns.${bestSan?` ${bestSan} was stronger.`:''}`;
  if(label==='Mistake')return`${played} is a mistake. It gives away a meaningful part of the position.${bestSan?` A better move was ${bestSan}.`:''}`;
  if(label==='Blunder')return`${played} is a blunder. It causes a large evaluation swing.${bestSan?` The engine preferred ${bestSan}.`:''}`;
  return`${played} has been reviewed.`;
}
function renderGuide(ply,data){
  const card=ensureGuideCard();if(!card)return;
  if(ply===0){card.hidden=false;$('reviewGuideIcon').textContent='✓';$('reviewGuideMove').textContent='Review ready';$('reviewGuideEval').textContent=scoreLabel(data.evals?.[0]);$('reviewGuideComment').textContent='Use Next, Previous, or tap any move to step through the review.';$('reviewGuideMeta').textContent='Move feedback is loaded from the saved review — navigation does not need a new engine request.';$('reviewShowBest').hidden=true;$('reviewPractice').hidden=true;return}
  const i=ply-1,sans=moveSans(),positions=buildPositions(),ucis=playedUcis(),label=data.labels?.[i]||'Good',played=sans[i]||`Move ${ply}`,best=data.bestMoves?.[i]||'',bestSan=best?sanForUci(positions[i]?.fen,best):'',verified=!!data.moveVerified?.[i],before=data.evals?.[i],after=data.evals?.[i+1];
  card.hidden=false;$('reviewGuideIcon').textContent=SYMBOL[label]||'✓';$('reviewGuideMove').textContent=`${played} · ${label}`;$('reviewGuideEval').textContent=scoreLabel(after);$('reviewGuideComment').textContent=commentForMove({label,played,bestSan,verified,before,after,ply});$('reviewGuideMeta').textContent=verified?'Engine-verified move classification':'Estimated classification from nearby reviewed positions';
  const show=$('reviewShowBest'),practice=$('reviewPractice');show.hidden=!best||!verified;practice.hidden=!(verified&&(label==='Mistake'||label==='Blunder')&&best);
  if(show)show.onclick=()=>{drawBestArrow(best);$('reviewGuideComment').textContent=bestSan?`Best move: ${bestSan}. The green arrow shows the engine's preferred move.`:'The green arrow shows the engine preferred move.'};
  if(practice){const detail=practiceDetail(i,data,positions,sans);practice.onclick=e=>launchPractice(e,detail)}
  showBoardBadge(label,ucis[i]);
}
function renderCurrentMove(){const data=activeReview;if(!data)return;const ply=currentPly(),cp=data.evals?.[ply];if(cp==null)return;const score=scoreLabel(cp);$('engineScore').textContent=$('mobileScore').textContent=score;$('engineSource').textContent='Game Review';$('mobileSource').textContent='Game Review';setEvalBar(cp);drawBestArrow('');renderGuide(ply,data)}

function summaryHeadline(data){const diff=(Number(data.whiteAccuracy)||0)-(Number(data.blackAccuracy)||0),blunders=data.labels.filter(x=>x==='Blunder').length;if(blunders===0)return'A clean game with no major blunders. Review the strongest decisions move by move.';if(Math.abs(diff)>=15)return'One side played a much more accurate game. Review the key turning points and missed chances.';return'The game had important swings. Review the moves that changed the evaluation.'}
function ensureSummaryScreen(){let el=$('reviewSummaryScreen');if(el)return el;el=document.createElement('section');el.id='reviewSummaryScreen';el.className='reviewSummaryScreen';el.hidden=true;el.innerHTML=`<div class="reviewSummaryInner"><div class="reviewSummaryTop"><h2>Game Review</h2><button id="reviewSummaryClose" class="reviewSummaryClose" type="button" aria-label="Close">×</button></div><div id="reviewHeadlineCard" class="reviewHeadlineCard"></div><div id="reviewSummaryGraph" class="reviewSummaryGraph"></div><div id="reviewSummaryPlayers" class="reviewSummaryPlayers"></div><div id="reviewBreakdown" class="reviewBreakdown"></div><button id="reviewStartBtn" class="reviewStartBtn" type="button">Start Review</button></div>`;document.body.appendChild(el);$('reviewSummaryClose').onclick=()=>el.hidden=true;$('reviewStartBtn').onclick=()=>startGuidedReview();return el}
function showSummaryScreen(data,{force=false}={}){
  const key=reviewKey();if(!force&&summaryShownForKey===key)return;summaryShownForKey=key;
  const el=ensureSummaryScreen(),names=($('gameTitle')?.textContent||'White — Black').split(' — '),counts=countBySide(data);$('reviewHeadlineCard').textContent=summaryHeadline(data);$('reviewSummaryGraph').innerHTML=graphSvg(data.evals,data.losses);$('reviewSummaryPlayers').innerHTML=`<div class="reviewSummaryPlayer"><div class="name">${escapeHtml(names[0]||'White')}</div><div class="accuracy">${Number(data.whiteAccuracy).toFixed(1)}</div></div><div class="reviewSummaryPlayer"><div class="name">${escapeHtml(names[1]||'Black')}</div><div class="accuracy">${Number(data.blackAccuracy).toFixed(1)}</div></div>`;
  $('reviewBreakdown').innerHTML=LABELS.map(label=>`<div class="reviewBreakRow"><span class="label">${label}</span><span class="left">${counts.white[label]||0}</span><span class="reviewBreakIcon badge-${BADGE[label]}">${SYMBOL[label]}</span><span class="right">${counts.black[label]||0}</span></div>`).join('');el.hidden=false;
}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function startGuidedReview(){const el=$('reviewSummaryScreen');if(el)el.hidden=true;$('start')?.click();setTimeout(()=>{$('next')?.click();setTimeout(renderCurrentMove,0)},20)}

function displayReview(data,{cached=false,showSummary=true}={}){
  const positions=buildPositions(),sans=moveSans();if(positions.length!==data.evals.length||sans.length!==data.labels.length)return false;
  activeReview=data;document.querySelector('.reviewPanel')?.classList.add('reviewReady');$('whiteAccuracy').textContent=Number(data.whiteAccuracy).toFixed(1);$('blackAccuracy').textContent=Number(data.blackAccuracy).toFixed(1);$('accuracyCards').hidden=false;renderTags(data,positions,sans);renderSummary(data.labels);renderGraph(data.evals,data.losses);
  const trainable=(data.bestMoves||[]).filter((m,i)=>m&&data.moveVerified?.[i]&&(data.labels[i]==='Mistake'||data.labels[i]==='Blunder')).length,verified=data.moveVerified?.filter(Boolean).length||0;
  $('reviewStatus').textContent=cached?`Saved review ready · ${verified}/${sans.length} moves engine-verified · ${trainable} practice position${trainable===1?'':'s'}.`:`Review ready · ${verified}/${sans.length} moves engine-verified · ${trainable} practice position${trainable===1?'':'s'}.`;
  $('runReview').textContent='Review summary';$('runReview').disabled=false;renderCurrentMove();if(showSummary)showSummaryScreen(data);window.dispatchEvent(new CustomEvent('gameReviewReady',{detail:{key:reviewKey(),data}}));return true;
}
async function restoreReview(){clearTimeout(restoreTimer);restoreTimer=setTimeout(async()=>{const sans=moveSans();if(!sans.length)return;const key=reviewKey(),data=await cacheGet('review',key);if(data?.version===REVIEW_VERSION)displayReview(data,{cached:true,showSummary:true})},120)}
function sampleIndexes(total,max){if(total<=max)return Array.from({length:total},(_,i)=>i);const set=new Set([0,total-1]);for(let n=0;n<max;n++)set.add(Math.round(n*(total-1)/(max-1)));return [...set].sort((a,b)=>a-b)}
async function fillCached(positions,evals,bestMoves,positionExact){for(let i=0;i<positions.length;i++){const e=await cloudEval(positions[i].fen,{network:false});if(e){evals[i]=e.cp;bestMoves[i]=e.best||'';positionExact[i]=true}if(i%24===23)await sleep(0)}}
async function runCloudPass(positions,evals,bestMoves,positionExact,token){await fillCached(positions,evals,bestMoves,positionExact);const candidates=sampleIndexes(positions.length,MAX_FRESH_CLOUD).filter(i=>evals[i]==null);let next=0,done=0,stop=false;async function worker(){while(!stop){const n=next++;if(n>=candidates.length||token!==reviewToken)return;const i=candidates[n];try{const e=await cloudEval(positions[i].fen);if(e){evals[i]=e.cp;bestMoves[i]=e.best||'';positionExact[i]=true}}catch(e){if(e?.rateLimited)stop=true}done++;$('reviewStatus').textContent=`Quick review ${Math.min(done,candidates.length)}/${candidates.length}…`;if(done%8===0)await sleep(30)}}await Promise.all(Array.from({length:Math.min(CLOUD_CONCURRENCY,candidates.length||1)},worker))}
function missingFallbackIndexes(evals){const missing=[];for(let i=0;i<evals.length;i++)if(evals[i]==null)missing.push(i);if(missing.length<=LIVE_FALLBACK_LIMIT)return missing;const out=[];for(let n=0;n<LIVE_FALLBACK_LIMIT;n++)out.push(missing[Math.round(n*(missing.length-1)/(LIVE_FALLBACK_LIMIT-1))]);return [...new Set(out)]}
async function runReview(){
  if(running)return;
  if(activeReview){showSummaryScreen(activeReview,{force:true});return}
  const positions=buildPositions(),sans=moveSans();if(positions.length<2){$('reviewStatus').textContent='Open a game with moves before running Game Review.';return}
  const key=reviewKey(),saved=await cacheGet('review',key);if(saved?.version===REVIEW_VERSION&&displayReview(saved,{cached:true,showSummary:true}))return;
  running=true;activeReview=null;signalRunning(true);const token=++reviewToken,btn=$('runReview');btn.disabled=true;btn.textContent='Reviewing…';clearTags();$('reviewSummary').innerHTML='';$('accuracyCards').hidden=true;$('reviewGraph').hidden=true;const evals=new Array(positions.length).fill(null),bestMoves=new Array(positions.length).fill(''),positionExact=new Array(positions.length).fill(false);
  try{
    await runCloudPass(positions,evals,bestMoves,positionExact,token);if(token!==reviewToken)return;
    const fallback=missingFallbackIndexes(evals);for(let n=0;n<fallback.length;n++){if(token!==reviewToken)return;const i=fallback[n];$('reviewStatus').textContent=`Finishing review ${n+1}/${fallback.length}…`;try{const e=await liveEval(positions[i].fen);if(e){evals[i]=e.cp;bestMoves[i]=e.best||'';positionExact[i]=true}}catch{}if(n<fallback.length-1)await sleep(35)}
    const exactCount=positionExact.filter(Boolean).length;if(exactCount<2)throw new Error('not enough engine positions were available; try again shortly');
    interpolate(evals);const ucis=playedUcis(),losses=[],labels=[],whiteLoss=[],blackLoss=[],moveVerified=[];
    for(let ply=1;ply<evals.length;ply++){const loss=moveLoss(evals[ply-1],evals[ply],ply),verified=!!positionExact[ply-1]&&!!positionExact[ply];losses.push(loss);moveVerified.push(verified);labels.push(classifyMove({loss,ply,before:evals[ply-1],after:evals[ply],played:ucis[ply-1],best:bestMoves[ply-1],verified}));(ply%2?whiteLoss:blackLoss).push(loss)}
    const data={version:REVIEW_VERSION,evals,losses,labels,bestMoves,positionExact,moveVerified,whiteAccuracy:accuracy(whiteLoss),blackAccuracy:accuracy(blackLoss),updated:Date.now()};await cacheSet('review',key,data);displayReview(data,{showSummary:true});
  }catch(e){$('reviewStatus').textContent='Game Review failed: '+(e?.name==='AbortError'?'engine request timed out':e.message)}finally{running=false;signalRunning(false);btn.disabled=false;if(!activeReview)btn.textContent='Review game'}
}
function resetReviewUI(){reviewToken++;if(running)signalRunning(false);running=false;activeReview=null;summaryShownForKey='';clearTags();clearBoardBadge();document.querySelector('.reviewPanel')?.classList.remove('reviewReady');$('reviewSummary').innerHTML='';$('accuracyCards').hidden=true;$('reviewGraph').hidden=true;$('reviewStatus').textContent='Run one quick review to see accuracy, move classifications and guided feedback.';$('runReview').textContent='Review game';$('engineScore').textContent='—';$('mobileScore').textContent='—';$('engineSource').textContent='Run Game Review';$('mobileSource').textContent='Game Review';$('bestLine').textContent='Run Game Review once to load move feedback.';$('mobileLine').textContent='Run Game Review to load move feedback.';$('analysisArrows').innerHTML='';const guide=$('reviewGuideCard');if(guide)guide.hidden=true;const screen=$('reviewSummaryScreen');if(screen)screen.hidden=true;restoreReview()}
function init(){ensureStyles();ensureGuideCard();const desktop=$('analyse'),mobile=$('analyseMobile');if(desktop)desktop.hidden=true;if(mobile)mobile.hidden=true;const b=$('runReview');if(b)b.addEventListener('click',runReview);['start','prev','next','end','resetVariation'].forEach(id=>$(id)?.addEventListener('click',()=>setTimeout(renderCurrentMove,0)));$('moves')?.addEventListener('click',e=>{if(e.target.closest('.move'))setTimeout(renderCurrentMove,0)});window.addEventListener('reviewNavigation',()=>renderCurrentMove());const title=$('gameTitle');if(title)new MutationObserver(resetReviewUI).observe(title,{childList:true,characterData:true,subtree:true});resetReviewUI()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
