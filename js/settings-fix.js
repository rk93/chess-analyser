import './review-perspective-fix.js';
import {AUTO_PLAY_SPEED_KEY,AUTO_PLAY_SPEEDS,getAutoPlayMs} from './review-playback-settings.js';
import { getReviewDepthPreset,REVIEW_DEPTH_PRESETS,REVIEW_DEPTH_SETTING } from './review-depth.js';
function installReviewDepthSetting(){
  const select=document.getElementById('reviewDepth');
  if(!select)return;
  select.value=getReviewDepthPreset().key;
  select.addEventListener('change',()=>{
    if(!Object.hasOwn(REVIEW_DEPTH_PRESETS,select.value))return;
    localStorage.setItem(REVIEW_DEPTH_SETTING,select.value);
    window.dispatchEvent(new CustomEvent('reviewDepthChanged',{detail:{preset:select.value}}));
  });
}
function installAutoPlaySetting(){const select=document.getElementById('reviewAutoplaySpeed');if(!select)return;select.value=String(getAutoPlayMs());select.addEventListener('change',()=>{const ms=Number(select.value);if(!AUTO_PLAY_SPEEDS.includes(ms))return;localStorage.setItem(AUTO_PLAY_SPEED_KEY,String(ms));window.dispatchEvent(new CustomEvent('reviewAutoPlaySpeedChanged',{detail:{ms}}));});}
function init(){installReviewDepthSetting();installAutoPlaySetting();document.addEventListener('click',e=>{const trigger=e.target.closest?.('#settingsToggleLibrary,#settingsToggleAnalysis,#settingsToggleLab,#gamesSettings');if(!trigger)return;e.preventDefault();e.stopPropagation();window.dispatchEvent(new CustomEvent('requestOpenSettingsPage'))},true)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
