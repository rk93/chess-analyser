// Reuse the Home reports in focused destinations. Global screen visibility stays
// with app-navigation; ux-shell owns the browser history for these destinations.
const TOPICS=[['overview','Overview'],['openings','Openings'],['growth','Growth areas'],['coach','Weekly coach'],['training','Practice']];

export function mountHomeSections(view,{pause}) {
  const $=id=>view.querySelector('#'+id);
  let topic=null,returnFormat=null;
  const summary=document.createElement('div');summary.id='homeSummary';
  summary.append(...view.children);view.append(summary);
  const detail=document.createElement('div');detail.id='homeStats';detail.hidden=true;
  detail.innerHTML=`<header class="homeStatsHeader"><div class="homeStatsTitle"><button id="homeStatsBack" type="button" aria-label="Back to Home"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m14 5-7 7 7 7M7 12h14"/></svg></button><div><span class="homeEyebrow">YOUR CHESS, IN FOCUS</span><h2 id="homeStatsTitle" tabindex="-1">Personal stats</h2></div><button id="homeLibraryReport" type="button" class="homeTextButton">All analytics <span aria-hidden="true">→</span></button></div><div id="homeStatsFormat"></div><div class="homeTopicTabs" role="tablist" aria-label="Personal stats topics">${TOPICS.map(([id,label])=>`<button type="button" role="tab" id="homeTopic-${id}" data-home-topic="${id}" aria-controls="homePanel-${id}" aria-selected="false" tabindex="-1">${label}</button>`).join('')}</div></header>${TOPICS.map(([id])=>`<section class="homeTopicPanel" id="homePanel-${id}" role="tabpanel" aria-labelledby="homeTopic-${id}" tabindex="0" hidden></section>`).join('')}`;
  view.append(detail);
  const panel=id=>$('homePanel-'+id);
  // One set of controls, charts and controllers; no duplicate data calculations.
  const pulse=view.querySelector('.homePulse'),chart=document.createElement('section');chart.className='homeStatsChart';
  chart.setAttribute('aria-label','Saved rating history');
  for(const node of [...pulse.children])if(!node.classList.contains('homeSectionTop')&&node.id!=='homePulsePools'&&node!==pulse.lastElementChild)chart.append(node);
  panel('overview').append(chart);
  const dna=view.querySelector('.homeDnaCard'),results=document.createElement('section');results.className='homeStatsResults';
  results.innerHTML='<h3>Results &amp; rating records</h3><p class="homeDataNote" id="homeResultsScope"></p>';
  for(const id of ['homeColorResults','homeStreak'])results.append($(id));
  panel('overview').append(results);
  const records=document.createElement('details');records.className='homeStatsRecords';records.innerHTML='<summary>Personal records &amp; rating trends</summary>';records.append(view.querySelector('.homeMilestones'),$('homeRatingTrends'));panel('overview').append(records);
  $('homeStatsFormat').append(dna.querySelector('.homePoolLabel'));
  $('homeDnaTitle').textContent='Your opening repertoire';
  panel('openings').append(dna,view.querySelector('.homeOpeningCard'),$('homeContinueOpening'));
  panel('growth').append(view.querySelector('.homeGrowth'));
  panel('coach').append(view.querySelector('.homeWeekCard'));
  panel('training').append(view.querySelector('.homeTrainingCard'),view.querySelector('.homeDailyCard'));
  const shortcuts=document.createElement('nav');shortcuts.className='homeShortcuts';shortcuts.setAttribute('aria-label','Your study spaces');
  shortcuts.innerHTML=[['openings','Openings'],['coach','Coach'],['training','Practice']].map(([id,label])=>`<button type="button" id="homeOpen-${id}" data-home-open="${id}">${label}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg></button>`).join('');
  view.querySelector('.homeContinue').after(shortcuts);
  const patterns=document.createElement('button');patterns.id='homeOpen-growth';patterns.type='button';patterns.className='homeTextButton';patterns.dataset.homeOpen='growth';patterns.textContent='Explore patterns →';
  $('homeReviewSuggestion').after(patterns);
  const state=()=>({topic,format:$('homeTimeClass').value});
  function notify(){window.dispatchEvent(new CustomEvent('homeSectionChanged',{detail:topic?state():null}));}
  function show(next,{format,focus=true,history=true}={}) {
    if(!TOPICS.some(([id])=>id===next))return;
    const entering=topic===null;
    if(entering)returnFormat=format||null;
    if(topic!==next)pause();
    topic=next;
    summary.hidden=true;detail.hidden=false;
    for(const [id] of TOPICS){const chosen=id===topic;panel(id).hidden=!chosen;const tab=$('homeTopic-'+id);tab.setAttribute('aria-selected',String(chosen));tab.tabIndex=chosen?0:-1;}
    if(format&&[...$('homeTimeClass').options].some(option=>option.value===format)){
      $('homeTimeClass').value=format;$('homeTimeClass').dispatchEvent(new Event('change'));
    }
    // Weekly coach and Practice retain their own clearly labelled time scopes.
    $('homeStatsFormat').hidden=!['overview','openings'].includes(topic);
    if(history)notify();
    window.scrollTo({top:0,behavior:'instant'});
    if(focus){const target=entering?$('homeStatsTitle'):$('homeTopic-'+topic);target.focus({preventScroll:true});}
  }
  function home({focus=false}={}) {
    if(topic!==null)pause();topic=null;detail.hidden=true;summary.hidden=false;
    if(focus)($('homePulsePools').querySelector(`[data-pulse-format="${returnFormat}"]`)||$('homeAnalyticsLink')).focus({preventScroll:true});
  }
  view.addEventListener('requestHomeSection',event=>show(event.detail?.topic,event.detail||{}));
  view.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.homeTopic)show(button.dataset.homeTopic);
    if(button.dataset.homeOpen)show(button.dataset.homeOpen);
    if(button.id==='homeAnalyticsLink')show('overview');
    if(button.id==='homeStatsBack'){home({focus:true});notify();window.scrollTo({top:0,behavior:'instant'});}
    if(button.id==='homeLibraryReport')document.getElementById('analyticsTab')?.click();
  });
  detail.querySelector('[role=tablist]').addEventListener('keydown',event=>{
    const index=TOPICS.findIndex(([id])=>'homeTopic-'+id===event.target.id);if(index<0)return;
    let next;if(event.key==='ArrowRight')next=(index+1)%TOPICS.length;if(event.key==='ArrowLeft')next=(index+TOPICS.length-1)%TOPICS.length;if(event.key==='Home')next=0;if(event.key==='End')next=TOPICS.length-1;
    if(next!==undefined){event.preventDefault();show(TOPICS[next][0]);$('homeTopic-'+TOPICS[next][0]).scrollIntoView({block:'nearest',inline:'nearest'});}
  });
  window.addEventListener('restoreHomeSection',event=>{if(event.detail)show(event.detail.topic,{...event.detail,history:false});else home({focus:true});});
  return {home,syncFormat(){if(topic)notify();}};
}
