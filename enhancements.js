import './ux-shell.js';
const $=id=>document.getElementById(id);
const PREF='chess-analyser-pref:';

if(!localStorage.getItem(PREF+'pieces'))localStorage.setItem(PREF+'pieces','classic');
if(!localStorage.getItem(PREF+'board'))localStorage.setItem(PREF+'board','green');

function pref(key,fallback){return localStorage.getItem(PREF+key)||fallback}
function savePref(key,value){localStorage.setItem(PREF+key,value);window.dispatchEvent(new CustomEvent('chessPreference',{detail:{key,value}}))}
function applyBoardTheme(){const theme=pref('board','green');document.querySelectorAll('.board').forEach(board=>{board.classList.remove('theme-green','theme-brown','theme-blue','theme-grey');board.classList.add('theme-'+theme)})}
function updateSelectedCards(){const pieces=pref('pieces','classic'),board=pref('board','green');document.querySelectorAll('[data-piece-style]').forEach(btn=>{const selected=btn.dataset.pieceStyle===pieces;btn.classList.toggle('selected',selected);btn.setAttribute('aria-pressed',String(selected))});document.querySelectorAll('[data-board-theme]').forEach(btn=>{const selected=btn.dataset.boardTheme===board;btn.classList.toggle('selected',selected);btn.setAttribute('aria-pressed',String(selected))})}
function renderPiecePreviews(){document.querySelectorAll('[data-preview-folder]').forEach(el=>{if(el.dataset.ready)return;el.dataset.ready='1';const folder=el.dataset.previewFolder,imgs=[['wN','♘'],['bK','♚']];for(const [piece,fallback] of imgs){const img=document.createElement('img');img.src=`https://cdn.jsdelivr.net/gh/Kadagaden/chess-pieces@master/${folder}/${piece}.svg`;img.alt='';img.addEventListener('error',()=>{img.remove();const s=document.createElement('span');s.className='pieceFallback';s.textContent=fallback;el.appendChild(s)},{once:true});el.appendChild(img)}})}
function showSettings(e){e?.preventDefault();e?.stopPropagation();window.dispatchEvent(new CustomEvent('requestOpenSettingsPage'))}
function init(){const user=$('user'),range=$('importRange');const saved=localStorage.getItem('chess-username');if(saved&&user)user.value=saved;const savedRange=localStorage.getItem('chess-import-range');if(savedRange&&range)range.value=savedRange;if(user&&!user.value&&$('status'))$('status').textContent='Enter any Chess.com username and choose how much history to import.';
  for(const [id,key,fallback] of [['engineMode','engine','auto'],['soundMode','sound','on']]){const el=$(id);if(!el)continue;el.value=pref(key,fallback);el.addEventListener('change',()=>savePref(key,el.value))}
  document.addEventListener('click',e=>{const piece=e.target.closest?.('[data-piece-style]');if(piece){savePref('pieces',piece.dataset.pieceStyle);updateSelectedCards();return}const board=e.target.closest?.('[data-board-theme]');if(board){savePref('board',board.dataset.boardTheme);updateSelectedCards();applyBoardTheme();return}const trigger=e.target.closest?.('#settingsToggleLibrary,#settingsToggleAnalysis,#settingsToggleLab,#gamesSettings');if(trigger)showSettings(e)},true);
  renderPiecePreviews();updateSelectedCards();applyBoardTheme();
  new MutationObserver(()=>{applyBoardTheme();renderPiecePreviews()}).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('requestOpenSettingsPage',()=>requestAnimationFrame(()=>{renderPiecePreviews();updateSelectedCards()}));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
