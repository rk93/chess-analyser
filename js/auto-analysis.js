import './opening-insights.js';
import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm';

const $=id=>document.getElementById(id);

function moveElements(){return [...document.querySelectorAll('#moves .move')]}
function moveSan(el){return el?.childNodes?.[0]?.textContent?.trim()||el?.textContent?.trim()||''}
function currentPly(){const moves=moveElements();const i=moves.findIndex(m=>m.classList.contains('active'));return i<0?0:i+1}
function fenAtPly(ply){try{const c=new Chess(),moves=moveElements();for(let i=0;i<Math.min(ply,moves.length);i++)c.move(moveSan(moves[i]));return c.fen()}catch{return null}}
function announcePosition(){const fen=fenAtPly(currentPly());if(fen)window.dispatchEvent(new CustomEvent('chessPositionChanged',{detail:{fen,context:'game',ply:currentPly()}}))}
function afterNavigation(){setTimeout(()=>{announcePosition();window.dispatchEvent(new CustomEvent('reviewNavigation',{detail:{ply:currentPly()}}))},0)}
// Game Review owns the game-open UI reset. A delayed instruction rewrite
// can move its Start button between pointer-down and pointer-up.
function init(){['start','prev','next','end','resetVariation'].forEach(id=>$(id)?.addEventListener('click',afterNavigation));$('moves')?.addEventListener('click',e=>{if(e.target.closest('.move'))afterNavigation()});window.addEventListener('savedGameOpened',afterNavigation);window.addEventListener('gameReviewReady',()=>afterNavigation());}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
