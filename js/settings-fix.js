import './review-perspective-fix.js';
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
function init(){installReviewDepthSetting();document.addEventListener('click',e=>{const trigger=e.target.closest?.('#settingsToggleLibrary,#settingsToggleAnalysis,#settingsToggleLab,#gamesSettings');if(!trigger)return;e.preventDefault();e.stopPropagation();window.dispatchEvent(new CustomEvent('requestOpenSettingsPage'))},true)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
