import './opening-insights.js';
import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm';

const $=id=>document.getElementById(id);

function moveElements(){return [...document.querySelectorAll('#moves .move')]}
function moveSan(el){return el?.childNodes?.[0]?.textContent?.trim()||el?.textContent?.trim()||''}
function currentPly(){const moves=moveElements();const i=moves.findIndex(m=>m.classList.contains('active'));return i<0?0:i+1}
function fenAtPly(ply){try{const c=new Chess(),moves=moveElements();for(let i=0;i<Math.min(ply,moves.length);i++)c.move(moveSan(moves[i]));return c.fen()}catch{return null}}
function announcePosition(){const fen=fenAtPly(currentPly());if(fen)window.dispatchEvent(new CustomEvent('chessPositionChanged',{detail:{fen,context:'game',ply:currentPly()}}))}
function showWaitingForReview(){const source=$('engineSource'),mobileSource=$('mobileSource'),line=$('bestLine'),mobileLine=$('mobileLine');if(source)source.textContent='Run Game Review';if(mobileSource)mobileSource.textContent='Game Review';if(line)line.textContent='Run Game Review once, then use Next / Previous to browse the completed review instantly.';if(mobileLine)mobileLine.textContent='Run Game Review to load move feedback.'}
function afterNavigation(){setTimeout(()=>{announcePosition();window.dispatchEvent(new CustomEvent('reviewNavigation',{detail:{ply:currentPly()}}))},0)}
function init(){['start','prev','next','end','resetVariation'].forEach(id=>$(id)?.addEventListener('click',afterNavigation));$('moves')?.addEventListener('click',e=>{if(e.target.closest('.move'))afterNavigation()});document.addEventListener('click',e=>{if(e.target.closest?.('#games .game'))setTimeout(()=>{announcePosition();showWaitingForReview();window.dispatchEvent(new CustomEvent('reviewNavigation',{detail:{ply:0}}))},180)});window.addEventListener('gameReviewReady',()=>afterNavigation());}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
