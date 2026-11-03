import {playFeedback} from './feedback.js';
import {simpleHash} from './analysis-store.js';
import {reviewProgressState,REVIEW_STUDY_TIPS} from './review-progress.js';
const $=id=>document.getElementById(id);
function currentKey(){const moves=[...document.querySelectorAll('#moves .move')].map(el=>el.childNodes[0]?.textContent?.trim()||el.textContent.trim());return simpleHash(`${$('gameTitle')?.textContent||''}|${moves.join(' ')}`);}
function init(){
  const view=$('analysisView');if(!view||$('reviewWaitPanel'))return;
  const panel=document.createElement('section');panel.id='reviewWaitPanel';panel.className='reviewWaitPanel';panel.hidden=true;panel.setAttribute('aria-labelledby','reviewWaitTitle');
  panel.innerHTML='<div class="reviewWaitHeading"><span class="coachAvatar coachThinking reviewWaitPip" aria-hidden="true"></span><div><span class="homeEyebrow">Pip is finding your next lesson</span><h2 id="reviewWaitTitle"></h2></div></div><p id="reviewWaitCount" role="status"></p><progress id="reviewWaitProgress" max="100" aria-label="Current analysis phase"></progress><p class="reviewWaitPhaseNote">Progress is for this phase. Deeper checks follow the first pass.</p><div class="reviewWaitStudy"><span>While you wait · general study tip</span><p id="reviewWaitTip"></p><button id="reviewWaitNextTip" class="btn" type="button">Another tip</button></div><div class="reviewWaitActions"><button id="reviewWaitCancel" class="btn" type="button">Stop review</button><button id="reviewWaitRetry" class="btn primary" type="button" hidden>Retry review</button><button id="reviewWaitPreview" class="btn" type="button" hidden>Explore preview</button></div>';
  view.querySelector('.topbar').after(panel);
  let state=reviewProgressState(),key=null,tip=0,run=0,local=false;
  function place(){
    if(matchMedia('(min-width:1100px)').matches){const layout=$('reviewDesktopLayout');if(layout&&panel.parentElement!==layout)layout.prepend(panel);}
    else {const bar=view.querySelector('.topbar');if(bar.nextElementSibling!==panel)bar.after(panel);}
  }
  function render(detail){
    state=reviewProgressState(detail);panel.hidden=false;panel.dataset.phase=state.phase;
    view.dataset.reviewWaiting='true';place();
    $('reviewWaitTitle').textContent=state.title;$('reviewWaitCount').textContent=state.caption;
    const progress=$('reviewWaitProgress');progress.hidden=!state.busy;
    if(state.indeterminate)progress.removeAttribute('value');else progress.value=state.percent;
    $('reviewWaitCancel').hidden=!state.busy;$('reviewWaitRetry').hidden=state.busy;
    $('reviewWaitPreview').hidden=state.busy;
    panel.querySelector('.reviewWaitStudy').hidden=!state.busy;panel.querySelector('.reviewWaitPhaseNote').hidden=!state.busy;
    panel.setAttribute('aria-busy',String(state.busy));
  }
  function reset(){key=null;local=false;panel.hidden=true;view.dataset.reviewWaiting='false';}
  $('reviewWaitTip').textContent=REVIEW_STUDY_TIPS[0];
  $('reviewWaitNextTip').onclick=()=>{$('reviewWaitTip').textContent=REVIEW_STUDY_TIPS[++tip%REVIEW_STUDY_TIPS.length];};
  $('reviewWaitCancel').onclick=()=>{window.dispatchEvent(new Event('cancelGameReview'));render({phase:'cancelled'});};
  $('reviewWaitRetry').onclick=()=>{$('runReview')?.click();};
  $('reviewWaitPreview').onclick=reset;
  window.addEventListener('resize',()=>{if(!panel.hidden)place();},{passive:true});
  window.addEventListener('gameReviewRunning',event=>{
    if(event.detail?.running){key=currentKey();local=false;render({phase:'preview'});void playFeedback('reviewStart',{context:'analysisView',id:'review-start:'+ ++run});}
    else if(key===currentKey()&&!local&&state.busy&&$('reviewStatus')?.textContent.startsWith('Game Review failed'))render({phase:'error'});
  });
  window.addEventListener('reviewAnalysisProgress',event=>{
    const detail=event.detail;if(!detail?.key||detail.key!==currentKey()||!view.getClientRects().length)return;
    key=detail.key;local=true;
    if(detail.phase==='complete'){reset();return;}render(detail);
  });
  window.addEventListener('gameReviewVerified',event=>{if(event.detail?.key===currentKey())reset();});
  window.addEventListener('feedbackCleanup',()=>{if(state.busy&&!panel.hidden)window.dispatchEvent(new Event('cancelGameReview'));reset();});
  window.addEventListener('savedGameOpened',reset);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
