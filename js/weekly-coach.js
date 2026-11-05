import {buildWeeklyCoach,updateCoachStudy,COACH_COMPARISON_MIN} from './weekly-coach-core.js';
import {startExercise,readPersonalTrainingProgress} from './personal-training.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const title=value=>value[0].toUpperCase()+value.slice(1);
const utc=value=>new Date(value*1000).toISOString().slice(0,10);
const currentUser=()=>String(localStorage.getItem('chess-username')||'').trim().toLowerCase();
const storageKey=user=>'chess-weekly-coach:'+user;
function readStudy(user){try{const value=JSON.parse(localStorage.getItem(storageKey(user))||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}}
function resultBar(record,label){
  const values=[['wins','Wins'],['draws','Draws'],['losses','Losses'],['unknown','Unknown']],total=record.games;
  return `<div class="weeklyResultRow"><span>${label}</span><div class="weeklyResultBar" role="img" aria-label="${label}: ${record.wins} wins, ${record.draws} draws, ${record.losses} losses, ${record.unknown} unknown">${values.map(([key])=>`<i class="weeklyResult-${key}" style="width:${total?100*record[key]/total:0}%"></i>`).join('')}</div><small>${record.wins}W · ${record.draws}D · ${record.losses}L${record.unknown?` · ${record.unknown}?`:''}</small></div>`;
}

export function createWeeklyCoach(view,{openGame,checkReviews,cancelReviews}) {
  const card=view.querySelector('.homeWeekCard'),root=document.createElement('div');root.id='weeklyCoach';root.className='weeklyCoach';
  view.querySelector('.homeDailyInsight').after(card);
  card.querySelector('h2').textContent='Your weekly coach';card.querySelector('.homeSectionTop>span').textContent='Last 7 days · all formats';
  card.querySelector('.homeDataNote').before(root);
  let games=[],user='',pool='rapid',reviews=[],progress={},report=null,scanBusy=false,status='',practice=null,practiceId='',practiceReady=false,generation=0;
  function cancelPractice(){generation++;practice?.abort();practice=null;practiceId='';practiceReady=false;}
  function pause(){const was=!!practice,ready=practiceReady;cancelPractice();if(was&&!ready)status='Practice check paused. Select an action when ready.';if(was)render();}
  function render(){
    const focus=document.activeElement?.dataset.coachStudy,selectFocused=document.activeElement?.id==='weeklyCoachPool';
    const opened=[...root.querySelectorAll('details[open]')].map(node=>node.dataset.coachDetails||node.id);
    report=buildWeeklyCoach(games,user,{pool,reviews,progress,trainingProgress:readPersonalTrainingProgress(user)});const c=report.coverage;
    const sourceNames={'engine-review':'Saved Stockfish evidence','game-history':'Game-history observation','review-coverage':'Review coverage'};
    root.innerHTML=`<div class="weeklyCoachTop"><div><span class="homeEyebrow">One week. A little focus.</span><h3>Your study plan</h3></div><label>Focus format<select id="weeklyCoachPool" aria-label="Weekly coach time control">${report.pools.map(item=>`<option value="${item.pool}" ${item.pool===pool?'selected':''}>${title(item.pool)} · ${item.games}</option>`).join('')}</select></label></div><p class="homeDataNote">${utc(report.start)} – ${utc(report.now)} UTC · rolling 7 days · ${title(pool)} only</p><details id="weeklyCoachEvidence" class="weeklyCoachEvidence"><summary>${c.inspected?`${c.reviewed} eligible reviews / ${c.games} saved games`:`Review evidence not checked · ${c.games} saved games`} <span>Results &amp; coverage</span></summary><div class="weeklyResults">${resultBar(report.current,'Last 7 days')}${resultBar(report.previous,'Previous 7 days')}</div><p id="weeklyCoachComparison" class="homeDataNote">${report.comparison?`${report.comparison.delta>0?'+':''}${Math.round(report.comparison.delta)} percentage points in score · ${report.current.known} recent / ${report.previous.known} previous known results. Opponents and colours may differ.`:`A score comparison needs ${COACH_COMPARISON_MIN} known results in each week. Unknown outcomes are excluded from score.`}</p><div class="weeklyCoverage"><div><strong>${c.inspected?`${c.reviewed} eligible reviews`:'Review evidence not checked'}</strong><span>${c.inspected} inspected / ${c.games} saved ${pool} games this week${c.inspected?` · ${c.unavailable} without eligible evidence`:''} · ${c.unchecked} unchecked</span></div><p class="homeDataNote">This check reads up to 60 saved reviews from this format’s last 14 days. Complete, exact Stockfish reviews at depth 8 or greater can support the plan.</p><div class="weeklyCoverageBar" role="img" aria-label="${c.reviewed} eligible reviews, ${c.unavailable} inspected without eligible evidence, ${c.unchecked} unchecked games"><i style="width:${c.games?100*c.reviewed/c.games:0}%"></i><b style="width:${c.games?100*c.unavailable/c.games:0}%"></b></div></div></details><div class="weeklyEvidenceActions"><button id="weeklyCoachCheck" class="homeTextButton" type="button" ${scanBusy||!user||report.current.games+report.previous.games===0?'disabled':''}>${scanBusy?'Checking saved reviews…':'Check saved review evidence'}</button><button id="weeklyCoachCancel" class="homeTextButton" type="button" ${scanBusy?'':'hidden'}>Cancel check</button></div><p id="weeklyCoachStatus" role="status" class="homeDataNote">${esc(status)}</p><div id="weeklyCoachActions" class="weeklyCoachActions">${report.actions.map((action,index)=>`<article class="weeklyAction ${action.completed?'isStudied':''}" data-coach-action="${index}"><div class="weeklyActionTop"><span class="weeklyStep">${index+1}</span><small>${sourceNames[action.source]}</small></div><h4>${esc(action.title)}</h4><p class="weeklyActionEvidence">${esc(action.evidence)}</p>${action.practiceStatus?`<small class="weeklyPracticeHistory">${esc(action.practiceStatus)}</small>`:''}<details data-coach-details="${action.id}"><summary>Why this action?</summary><p>${esc(action.text)}</p>${action.kind==='practice'||action.kind==='opening'?`<button type="button" class="homeTextButton weeklySourceGame" data-coach-source="${index}">Source game</button>`:''}</details><div class="weeklyActionControls"><button type="button" class="weeklyActionGo" data-coach-go="${index}" ${practiceId===action.id?'disabled':''}>${practiceId===action.id?'Checking solution…':action.kind==='practice'?'Practise this position':action.kind==='opening'?'Explore the opening':'Review the game'} <span aria-hidden="true">→</span></button><label class="weeklyStudy"><input type="checkbox" data-coach-study="${action.id}" aria-label="Mark ${esc(action.title)} as studied" ${action.completed?'checked':''}> Studied</label></div></article>`).join('')||`<div class="weeklyCoachEmpty"><strong>No saved ${pool} games in this rolling week.</strong><p>Open Games to import recent games. Your personal plan uses those saved games and any eligible reviews.</p><button type="button" class="homeTextButton" id="weeklyCoachGames">Open Games →</button></div>`}</div>${report.actions.length&&report.actions.length<3?'<p class="homeDataNote">A shorter plan this week: more evidence is needed for another distinct recommendation.</p>':''}<p class="homeDataNote">Study checkmarks record your review activity for seven days. Playing improvement needs further games.</p><button type="button" class="homeTextButton" id="weeklyPracticeCancel" ${practice?'':'hidden'}>Cancel practice check</button>`;
    for(const node of root.querySelectorAll('details'))if(opened.includes(node.dataset.coachDetails||node.id))node.open=true;
    if(focus)root.querySelector(`[data-coach-study="${focus}"]`)?.focus({preventScroll:true});if(selectFocused)root.querySelector('#weeklyCoachPool')?.focus({preventScroll:true});
  }
  root.addEventListener('change',event=>{
    if(event.target.id==='weeklyCoachPool'){cancelReviews();cancelPractice();pool=event.target.value;status='';render();return;}
    const id=event.target.dataset.coachStudy;if(!id||!user||user!==currentUser()||!report.actions.some(action=>action.id===id))return;
    progress=updateCoachStudy(progress,id,event.target.checked);
    try{localStorage.setItem(storageKey(user),JSON.stringify(progress));status=event.target.checked?'Study marked on this device.':'Study mark removed.';}
    catch{status='This study mark could not be saved. Your games are unchanged.';}
    render();
  });
  root.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(report?.user!==currentUser())return;
    if(button.id==='weeklyCoachCheck'){cancelPractice();checkReviews({pool,days:14});return;}
    if(button.id==='weeklyCoachCancel'){cancelReviews();return;}
    if(button.id==='weeklyPracticeCancel'){cancelPractice();status='Practice check paused.';render();return;}
    if(button.id==='weeklyCoachGames'){document.getElementById('gamesTab')?.click();return;}
    const index=button.dataset.coachGo??button.dataset.coachSource;if(index===undefined)return;
    const action=report.actions[Number(index)];if(!action||report.user!==currentUser())return;
    if(button.dataset.coachSource!==undefined){openGame(action.target.key);return;}
    if(action.kind==='practice'){
      if(practice)return;practice=new AbortController();practiceId=action.id;const token=++generation,signal=practice.signal;
      render();const currentButton=root.querySelector(`[data-coach-go="${index}"]`);
      void startExercise(action.practice,currentButton,{signal,onStatus:(message,phase)=>{if(token===generation&&user===currentUser()){status=message;practiceReady=phase==='ready';const node=root.querySelector('#weeklyCoachStatus');if(node)node.textContent=message;}}}).finally(()=>{if(token===generation){practice=null;practiceId='';render();}});
    }else if(action.kind==='opening'){
      const row=action.target;document.getElementById('boardLabTab')?.click();window.dispatchEvent(new CustomEvent('loadLabPgn',{detail:{pgn:row.game.pgn,label:row.opening,orientation:row.white?'white':'black',maxPlies:24}}));
    }else openGame(action.target.key);
  });
  window.addEventListener('storage',event=>{if(event.key===storageKey(user)){progress=readStudy(user);render();}});
  window.addEventListener('personalTrainingScanStarted',()=>{if(practice)pause();});
  window.addEventListener('personalTrainingAttempt',()=>{if(user&&user===currentUser())render();});
  return {
    update(nextGames,nextUser){
      if(games!==nextGames||user!==nextUser){cancelPractice();games=nextGames;user=nextUser;reviews=[];progress=readStudy(user);status='Saved reviews have not been checked for this plan.';scanBusy=false;
        const initial=buildWeeklyCoach(games,user);pool=initial.pools.slice().sort((a,b)=>b.games-a.games||['rapid','blitz','bullet','daily'].indexOf(a.pool)-['rapid','blitz','bullet','daily'].indexOf(b.pool))[0]?.pool||'rapid';}
      render();
    },
    setReviews(next){reviews=next;status='Saved review check complete. Choose one action to study.';render();},
    setBusy(value,message){scanBusy=value;if(value)cancelPractice();if(message!==undefined)status=message;render();},
    invalidate(){cancelPractice();reviews=[];scanBusy=false;status='Saved review evidence changed. Check again to refresh the plan.';render();},
    reset(){cancelPractice();games=[];user='';reviews=[];progress={};scanBusy=false;status='Loading saved games…';render();},
    pause,
  };
}
