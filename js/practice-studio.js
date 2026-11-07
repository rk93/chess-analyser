import './practice-progress.js';
import {loadPracticeHistory,practiceHistoryKey} from './practice-history-store.js';

export function mountPracticeStudio(view){
  const component=view.querySelector('chess-practice-progress');let user='';
  const refresh=()=>{component.history=loadPracticeHistory(user)};
  component.addEventListener('practice-studio-action',event=>{
    if(!['check','cancel'].includes(event.detail?.action))return;
    if(!user||user!==String(localStorage.getItem('chess-username')||'').trim().toLowerCase())return;
    view.querySelector(event.detail?.action==='cancel'?'#homeCancelWeaknesses':'#homeCheckWeaknesses')?.click();
  });
  window.addEventListener('practiceHistoryChanged',event=>{if(event.detail?.user===user)refresh()});
  window.addEventListener('storage',event=>{if(event.key===practiceHistoryKey(user)||event.key===null)refresh()});
  return {
    update(nextUser){if(user!==nextUser){user=nextUser;component.evidence=null;component.notice='';component.view='practice';component.selected=-1;}refresh();},
    reset(nextUser=''){user=nextUser;component.evidence=null;component.notice='';component.busy=false;component.view='practice';component.selected=-1;refresh();},
    setEvidence(nextUser,report){if(nextUser===user){component.evidence=report;component.notice='';}},
    setNotice(message){component.notice=message;},
    setBusy(value,message=''){if(value)component.notice='';component.busy=value;component.message=message;},
  };
}
