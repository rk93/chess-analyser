import {readPracticeResume} from './practice-plan-core.js';
export const practiceResumeKey=user=>'chess-practice-resume:'+user;
const notify=user=>window.dispatchEvent(new CustomEvent('practiceResumeChanged',{detail:{user}}));
const failed=user=>{try{window.dispatchEvent(new CustomEvent('practiceResumeUnavailable',{detail:{user}}))}catch{}return false;};
export function loadPracticeResume(user){try{return readPracticeResume(localStorage.getItem(practiceResumeKey(user)))}catch{return {available:false,entry:null}}}
export function savePracticeResume(user,entry){
  try{
    if(!user)return false;
    if(!loadPracticeResume(user).available)return failed(user);
    const value=readPracticeResume({...entry,version:1});if(!value.available||!value.entry)return failed(user);
    localStorage.setItem(practiceResumeKey(user),JSON.stringify(value.entry));notify(user);return true;
  }catch{return failed(user);}
}
export function clearPracticeResume(user,position){
  try{
    const value=loadPracticeResume(user);if(!value.available||!value.entry||position&&value.entry.position!==position)return false;
    localStorage.removeItem(practiceResumeKey(user));notify(user);return true;
  }catch{return failed(user);}
}
