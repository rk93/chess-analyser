import './practice-progress.js';
import {loadPracticeHistory,practiceHistoryKey} from './practice-history-store.js';
import {buildPracticePlan} from './practice-plan-core.js';
import {loadPracticeResume,clearPracticeResume,practiceResumeKey} from './practice-plan-store.js';

export function mountPracticeStudio(view,{startPractice}={}){
  const component=view.querySelector('chess-practice-progress');let user='',controller=null,generation=0,launching=false;
  const refresh=()=>{component.history=loadPracticeHistory(user);component.resumeState=loadPracticeResume(user)};
  function cancelPlan(message=''){
    controller?.abort();controller=null;generation++;launching=false;
    component.planBusy=false;component.planStatus=message;
  }
  async function practise(position){
    if(controller||!startPractice||view.hidden)return;
    const plan=buildPracticePlan(component.history),resume=component.resumeState?.entry;
    if(resume?.position!==position&&!plan.positions.some(row=>row.position===position))return;
    controller=new AbortController();const signal=controller.signal,token=++generation,currentUser=user;
    component.planBusy=true;component.planStatus='Checking your saved position…';
    try{
      const opened=await startPractice(position,{signal,onStatus:(message,phase)=>{if(token===generation&&user===currentUser){launching=phase==='ready';component.planStatus=message;}}});
      if(token===generation&&!opened&&!signal.aborted&&launching)component.planStatus='This practice check did not open. Try again.';
    }catch(error){if(token===generation&&user===currentUser)component.planStatus=error.name==='AbortError'?'Practice check paused.':error.message||'This position could not be checked. Try again.';}
    finally{if(token===generation){controller=null;component.planBusy=false;launching=false;}}
  }
  component.addEventListener('practice-studio-action',event=>{
    const {action,position}=event.detail||{};
    if(!user||user!==String(localStorage.getItem('chess-username')||'').trim().toLowerCase())return;
    if(action==='practise'){void practise(position);return;}
    if(action==='dismiss'){if(!controller&&clearPracticeResume(user,position))component.planStatus='';return;}
    if(action==='cancel-plan'){cancelPlan('Practice check paused. Your position is still available.');return;}
    if(!['check','cancel'].includes(action))return;
    view.querySelector(action==='cancel'?'#homeCancelWeaknesses':'#homeCheckWeaknesses')?.click();
  });
  window.addEventListener('practiceHistoryChanged',event=>{if(event.detail?.user===user)refresh()});
  window.addEventListener('practiceResumeChanged',event=>{if(event.detail?.user===user){component.resumeWarning='';refresh();}});
  window.addEventListener('practiceResumeUnavailable',event=>{if(event.detail?.user===user)component.resumeWarning='Resume couldn’t be saved. You can still find this position again in your practice list.';});
  window.addEventListener('personalTrainingAttempt',event=>{if(event.detail?.trainingUser===user&&event.detail.correct===true)component.resumeWarning='';});
  window.addEventListener('storage',event=>{if([practiceHistoryKey(user),practiceResumeKey(user),null].includes(event.key))refresh()});
  window.addEventListener('appScreenChanged',event=>{if(event.detail.screen==='home')refresh();else if(controller)cancelPlan(launching?'':'Practice check paused. Return here when ready.');});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&controller)cancelPlan('Practice check paused. Return here when ready.');else if(!document.hidden)refresh();});
  return {
    cancelPlan,
    update(nextUser){if(user!==nextUser){cancelPlan();user=nextUser;component.resumeWarning='';component.evidence=null;component.notice='';component.view='practice';component.selected=-1;}refresh();},
    reset(nextUser=''){cancelPlan();user=nextUser;component.resumeWarning='';component.evidence=null;component.notice='';component.busy=false;component.view='practice';component.selected=-1;refresh();},
    setEvidence(nextUser,report){if(nextUser===user){component.evidence=report;component.notice='';}},
    setNotice(message){component.notice=message;},
    setBusy(value,message=''){if(value)component.notice='';component.busy=value;component.message=message;},
  };
}
