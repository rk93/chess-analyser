import {readPracticeHistory,appendPracticeAttempt} from './practice-history-core.js';
export const practiceHistoryKey=user=>'chess-practice-history:'+user;
export function loadPracticeHistory(user){try{return readPracticeHistory(localStorage.getItem(practiceHistoryKey(user)))}catch{return {available:false,events:[]}}}
export function savePracticeAttempt(user,event){
  try{
    const result=appendPracticeAttempt(localStorage.getItem(practiceHistoryKey(user)),event);
    if(!result.changed)return false;
    const {available,...data}=result.history;localStorage.setItem(practiceHistoryKey(user),JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('practiceHistoryChanged',{detail:{user}}));return true;
  }catch{return false;}
}
