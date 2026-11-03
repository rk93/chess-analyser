import {FEEDBACK_PREFIX,readFeedbackPreferences,createFeedbackController,moveFeedbackEvent} from './feedback-core.js';
import {createSynthPlayer} from './feedback-audio.js';

const $=id=>document.getElementById(id),animations=new Set(),timers=new Set();
let installed=false,pressInstalled=false,activePress=null,playback={playing:false,interval:0};
const motion=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch{return false}};
export function feedbackPreferences(){try{return readFeedbackPreferences(localStorage)}catch{return readFeedbackPreferences(null)}}
function visible(context){return !document.hidden&&(!context||!!$(context)?.getClientRects().length)}
export const feedback=createFeedbackController({read:feedbackPreferences,createPlayer:()=>createSynthPlayer(),isActive:visible,
  now:()=>performance.now(),vibrate:pattern=>navigator.vibrate?.(pattern)??false});
export function reducedFeedbackMotion(){return motion()||feedbackPreferences().reducedAnimations}
function later(fn,delay){const timer=setTimeout(()=>{timers.delete(timer);fn()},delay);timers.add(timer);return timer;}
function animate(node,keyframes,options){
  if(!node?.animate||reducedFeedbackMotion())return;
  try{const animation=node.animate(keyframes,options);animations.add(animation);animation.finished.then(()=>animations.delete(animation),()=>animations.delete(animation));}catch{}
}
export function feedbackPulse(node,success=true){
  if(!node?.getClientRects().length||reducedFeedbackMotion())return;
  animate(node,success?[{filter:'brightness(1)'},{filter:'brightness(1.13)'},{filter:'brightness(1)'}]:[{translate:'0 0'},{translate:'-3px 0'},{translate:'3px 0'},{translate:'0 0'}],{duration:success?260:150,easing:'ease-out'});
}
export function playFeedback(type,options={}){return feedback.emit(type,options)}
export function selectionFeedback(boardId){void playFeedback('selection',{context:boardId});}
export function markLegalTargets(boardId,moves=[]) {
  const targets=new Map(moves.map(move=>[move.to,!!move.captured]));
  $(boardId)?.querySelectorAll('[data-square]').forEach(square=>{square.classList.toggle('feedbackLegalTarget',targets.has(square.dataset.square)&&!targets.get(square.dataset.square));square.classList.toggle('feedbackLegalCapture',targets.get(square.dataset.square)===true);});
}
export function moveFeedback(move,{boardId,automatic=false,sound=true,type}={}) {
  if(!move||!visible(boardId))return;
  automatic=automatic||(boardId==='board'&&playback.playing);
  const board=$(boardId);
  if(!automatic&&sound)void playFeedback(type||moveFeedbackEvent(move),{context:boardId,haptic:type?.startsWith('puzzle')?type:move.captured?'capture':undefined});
  else if(automatic&&sound)void playFeedback(type||moveFeedbackEvent(move),{context:boardId,automatic:true});
  if(!board||reducedFeedbackMotion()||(automatic&&(!playback.playing||playback.interval<=500)))return;
  function slide(from,to){const source=board.querySelector(`[data-square="${from}"]`),target=board.querySelector(`[data-square="${to}"]`),piece=target?.querySelector('.piece');if(!source||!piece)return;const a=source.getBoundingClientRect(),b=target.getBoundingClientRect();animate(piece,[{transform:`translate(${a.x-b.x}px,${a.y-b.y}px)`},{transform:'translate(0,0)'}],{duration:125,easing:'cubic-bezier(.2,.7,.3,1)'});}
  slide(move.from,move.to);
  if(/[kq]/.test(move.flags||''))slide((move.flags.includes('k')?'h':'a')+move.from[1],(move.flags.includes('k')?'f':'d')+move.from[1]);
  if(move.captured||move.promotion)feedbackPulse(board.querySelector(`[data-square="${move.to}"]`));
}
function cleanup(){
  playback={playing:false,interval:0};
  feedback.stop();
  feedback.playback({playing:false});
  for(const animation of animations){try{animation.cancel()}catch{}}animations.clear();
  for(const timer of timers)clearTimeout(timer);timers.clear();
  activePress?.classList.remove('premiumTapped');activePress=null;
  window.dispatchEvent(new Event('feedbackCleanup'));
}
function applyMotion(){document.documentElement.dataset.reducedAnimations=String(reducedFeedbackMotion());if(reducedFeedbackMotion()){for(const animation of animations){try{animation.cancel()}catch{}}animations.clear();}}
function save(key,value){try{localStorage.setItem(FEEDBACK_PREFIX+key,value);window.dispatchEvent(new CustomEvent('chessPreference',{detail:{key,value}}));}catch{$('feedbackSettingsStatus').textContent='Storage is unavailable; these preferences could not be saved.';}}
function syncSettings(){
  const p=feedbackPreferences();
  for(const [id,value] of [['soundMode',p.sound?'on':'off'],['soundVolume',p.volume],['soundTheme',p.theme]])if($(id))$(id).value=String(value);
  for(const [id,value] of [['hapticMode',p.haptics],['uiSoundMode',p.uiSounds],['reducedAnimations',p.reducedAnimations||motion()]])if($(id))$(id).checked=value;
  if($('reducedAnimations'))$('reducedAnimations').disabled=motion();
  if($('soundVolumeValue'))$('soundVolumeValue').textContent=p.volume+'%';
  applyMotion();
}
function installSettings(){
  for(const [id,key] of [['soundMode','sound'],['soundTheme','soundTheme']])$(id)?.addEventListener('change',event=>save(key,event.target.value));
  $('soundVolume')?.addEventListener('input',event=>{save('soundVolume',event.target.value);});
  for(const [id,key] of [['hapticMode','haptics'],['uiSoundMode','uiSounds'],['reducedAnimations','reducedAnimations']])$(id)?.addEventListener('change',event=>save(key,event.target.checked?'on':'off'));
  $('feedbackPreview')?.addEventListener('click',()=>{
    const p=feedbackPreferences();$('feedbackSettingsStatus').textContent=p.sound&&p.volume>0?'Previewing your capture sound.':'Enable chess sounds and raise volume to hear a preview.';
    if(p.sound&&p.volume>0)void playFeedback('capture',{context:'settingsView',haptic:'none'});
  });syncSettings();
}
export function installPressFeedback(){
  if(pressInstalled)return;pressInstalled=true;
  document.addEventListener('pointerdown',event=>{
    const node=event.target.closest?.('button,.btn,.ctrl,[role="tab"],.gameWithAvatar');if(!node||node.disabled)return;
    activePress?.classList.remove('premiumTapped');activePress=node;
    if(!reducedFeedbackMotion()){node.classList.remove('premiumTapped');void node.offsetWidth;node.classList.add('premiumTapped');later(()=>node.classList.remove('premiumTapped'),200);}
  },{passive:true});
  const release=()=>{activePress?.classList.remove('premiumTapped');activePress=null;};
  document.addEventListener('pointercancel',release,{passive:true});document.addEventListener('pointerup',()=>later(release,100),{passive:true});
}
function init(){
  if(installed)return;installed=true;installSettings();installPressFeedback();
  const unlock=event=>{if(event.isTrusted&&(['pointerdown','click'].includes(event.type)||['Enter',' ','ArrowLeft','ArrowRight'].includes(event.key)))feedback.unlock();};
  document.addEventListener('pointerdown',unlock,{capture:true,passive:true});document.addEventListener('keydown',unlock,true);document.addEventListener('click',unlock,true);
  document.addEventListener('click',event=>{if(event.target.closest?.('.homeTab,#back,#explorerHome')){cleanup();const target=event.target.closest('.homeTab');if(target&&!reducedFeedbackMotion())later(()=>{const route={homeDashboardTab:'homeView',gamesTab:'libraryView',boardLabTab:'boardLabView',explorerTab:'explorerView',puzzlesTab:'puzzlesView',analyticsTab:'analyticsView',topPlayersTab:'topPlayersView',settingsNav:'settingsView'}[target.id],view=$(route);if(view?.getClientRects().length)animate(view,[{opacity:.92},{opacity:1}],{duration:120,easing:'ease-out'});},0);}},true);
  document.addEventListener('click',event=>{
    const node=event.target.closest?.('button,[role="tab"]');if(!event.isTrusted||!node||node.disabled||node.matches('.ctrl,#reviewAutoPlay,#reviewPrev,#reviewNext,#labBack,#labForward,#feedbackPreview'))return;
    void playFeedback('uiTap');
  });
  for(const event of ['popstate','requestOpenSettingsPage','requestOpenSavedGame'])window.addEventListener(event,cleanup);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cleanup();});
  window.addEventListener('pagehide',()=>{cleanup();feedback.dispose();});
  window.addEventListener('chessPreference',event=>{if(['sound','soundVolume','soundTheme','haptics','uiSounds','reducedAnimations'].includes(event.detail?.key)){feedback.stop();syncSettings();}});
  window.addEventListener('storage',event=>{if(event.key===null||event.key?.startsWith(FEEDBACK_PREFIX)){feedback.stop();syncSettings();}});
  try{matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',()=>{cleanup();syncSettings();});}catch{}
  window.addEventListener('reviewFeedbackPlayback',event=>{playback=event.detail;feedback.playback(event.detail);});
  window.addEventListener('gameReviewVerified',event=>{
    if(event.detail?.cached!==false)return;
    later(()=>{void playFeedback('reviewComplete',{context:'board',id:'review:'+event.detail.key});feedbackPulse($('reviewStatus'));},0);
  });
  window.addEventListener('personalTrainingAttempt',event=>{
    if(!event.detail?.trainingUser)return;
    feedbackPulse($('labPracticeCoachDock'),event.detail.correct===true);
  });
}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();}
