const $=id=>document.getElementById(id);
let timer=null;
let requested=false;

function analysisVisible(){
  const view=$('analysisView');
  return view && getComputedStyle(view).display!=='none';
}

function runWhenReady(){
  if(!requested||!analysisVisible())return;
  const btn=$('analyse');
  if(!btn)return;
  if(btn.disabled){setTimeout(runWhenReady,120);return;}
  requested=false;
  btn.click();
}

function scheduleAutoAnalysis(){
  requested=true;
  clearTimeout(timer);
  const source=$('engineSource');
  const mobileSource=$('mobileSource');
  if(source)source.textContent='Updating evaluation…';
  if(mobileSource)mobileSource.textContent='Updating…';
  timer=setTimeout(runWhenReady,180);
}

function init(){
  ['start','prev','next','end','resetVariation'].forEach(id=>{
    const el=$(id);
    if(el)el.addEventListener('click',scheduleAutoAnalysis);
  });

  const moves=$('moves');
  if(moves){
    moves.addEventListener('click',e=>{
      if(e.target.closest('.move'))scheduleAutoAnalysis();
    });
  }
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
