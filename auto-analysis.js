import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm';
const $=id=>document.getElementById(id);
const PREF='chess-analyser-pref:';
const pref=(k,f)=>localStorage.getItem(PREF+k)||f;
let timer=null,requested=false,prefetchTimer=null;
const prefetched=new Map();

function analysisVisible(){const view=$('analysisView');return view&&getComputedStyle(view).display!=='none'}
function moveElements(){return [...document.querySelectorAll('#moves .move')]}
function currentPly(){const moves=moveElements();const i=moves.findIndex(m=>m.classList.contains('active'));return i<0?0:i+1}
function fenAtPly(ply){try{const c=new Chess(),moves=moveElements();for(let i=0;i<Math.min(ply,moves.length);i++)c.move(moves[i].textContent.trim());return c.fen()}catch{return null}}
function cacheKey(mode,fen){return `${mode}|${fen}`}

async function cloud(fen){const r=await fetch(`https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=3&variant=standard`,{headers:{Accept:'application/json'}});if(r.status===404)return null;if(!r.ok)throw new Error(`Cloud ${r.status}`);const j=await r.json();return j.pvs?.length?{source:'Lichess cloud',depth:j.depth,pvs:j.pvs.slice(0,3)}:null}
async function stockfish(fen){const r=await fetch('https://chess-api.com/v1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fen,depth:14,variants:1,maxThinkingTime:180})});if(!r.ok)throw new Error(`Live engine ${r.status}`);const j=await r.json(),best=j.move||j.lan||'',cont=Array.isArray(j.continuationArr)?j.continuationArr.filter(Boolean):[],moves=[best,...cont.filter((m,i)=>!(i===0&&m===best))].filter(Boolean).join(' '),cp=j.eval!=null?Math.round(Number(j.eval)*100):Number(j.centipawns)||0;return{source:'Stockfish live',depth:j.depth||14,pvs:[{cp,mate:j.mate,moves}]}}
async function fetchForMode(fen,mode,prefetch=false){if(mode==='cloud')return cloud(fen);if(mode==='stockfish')return stockfish(fen);if(prefetch)return cloud(fen);let data=null;try{data=await cloud(fen)}catch{}return data||stockfish(fen)}
function score(pv){if(pv?.mate!==undefined&&pv?.mate!==null&&Number(pv.mate)!==0){const m=Number(pv.mate);return{n:m>0?20:-20,label:(m<0?'-':'')+'M'+Math.abs(m)}}const n=(Number(pv?.cp)||0)/100;return{n,label:(n>=0?'+':'')+n.toFixed(2)}}
function squarePoint(sq){const board=$('board'),el=board?.querySelector(`[data-square="${sq}"]`);if(!board||!el)return null;const br=board.getBoundingClientRect(),r=el.getBoundingClientRect();return{x:((r.left+r.width/2-br.left)/br.width)*800,y:((r.top+r.height/2-br.top)/br.height)*800}}
function draw(pvs){const svg=$('analysisArrows');if(!svg)return;svg.innerHTML='<defs><marker id="prefetchArrow" markerWidth="5" markerHeight="5" refX="4.1" refY="2.5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L5,2.5 L0,5 Z" fill="#8bc34a"/></marker></defs>';pvs.slice(0,3).forEach((pv,i)=>{const u=String(pv.moves||'').trim().split(/\s+/)[0];if(!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(u))return;const a=squarePoint(u.slice(0,2)),b=squarePoint(u.slice(2,4));if(!a||!b)return;svg.insertAdjacentHTML('beforeend',`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${['#8bc34a','#f4c542','#58a6ff'][i]}" stroke-width="${i?12:16}" stroke-linecap="round" opacity=".88" marker-end="url(#prefetchArrow)"/>`)})}
function show(data){if(!data?.pvs?.length)return false;const s=score(data.pvs[0]);$('engineScore').textContent=$('mobileScore').textContent=s.label;$('engineSource').textContent=`${data.source} · depth ${data.depth??'—'} · prefetched`;$('mobileSource').textContent=data.source;$('bestLine').textContent='Best: '+(data.pvs[0].moves||'');$('mobileLine').textContent='Best: '+(data.pvs[0].moves||'');$('evalFill').style.height=`${Math.max(3,Math.min(97,50+45*(2/Math.PI)*Math.atan(s.n/3)))}%`;draw(data.pvs);return true}

async function prefetchAhead(){if(!analysisVisible())return;const mode=pref('engine','auto'),ply=currentPly(),count=mode==='stockfish'?1:2;for(let offset=1;offset<=count;offset++){const fen=fenAtPly(ply+offset);if(!fen)continue;const key=cacheKey(mode,fen);if(prefetched.has(key))continue;prefetched.set(key,{loading:true});try{const data=await fetchForMode(fen,mode,true);if(data)prefetched.set(key,data);else prefetched.delete(key)}catch{prefetched.delete(key)}}}
function schedulePrefetch(){clearTimeout(prefetchTimer);prefetchTimer=setTimeout(prefetchAhead,350)}

function runWhenReady(){if(!requested||!analysisVisible())return;const mode=pref('engine','auto'),fen=fenAtPly(currentPly()),cached=fen&&prefetched.get(cacheKey(mode,fen));if(cached&&!cached.loading&&show(cached)){requested=false;schedulePrefetch();return}const btn=$('analyse');if(!btn)return;if(btn.disabled){setTimeout(runWhenReady,120);return}requested=false;btn.click();schedulePrefetch()}
function scheduleAutoAnalysis(){requested=true;clearTimeout(timer);const source=$('engineSource'),mobileSource=$('mobileSource');if(source)source.textContent='Updating evaluation…';if(mobileSource)mobileSource.textContent='Updating…';timer=setTimeout(runWhenReady,180)}

function init(){['start','prev','next','end','resetVariation'].forEach(id=>{const el=$(id);if(el)el.addEventListener('click',scheduleAutoAnalysis)});const moves=$('moves');if(moves)moves.addEventListener('click',e=>{if(e.target.closest('.move'))scheduleAutoAnalysis()});window.addEventListener('chessPreference',e=>{if(e.detail?.key==='engine'){prefetched.clear();scheduleAutoAnalysis()}})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
