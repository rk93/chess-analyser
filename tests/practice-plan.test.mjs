import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPracticePlan,readPracticeResume,REVISIT_INTERVALS} from '../js/practice-plan-core.js';
import {loadPracticeResume,savePracticeResume,clearPracticeResume,practiceResumeKey} from '../js/practice-plan-store.js';
import {PRACTICE_DAY as DAY} from '../js/practice-history-core.js';
const now=1800000000000,t0=now-40*DAY;
const position='same|a1a8';
const event=(at,options={})=>({id:'run:'+at,position,at,correct:true,revealed:false,pool:'rapid',theme:'knight-fork',...options});
const history=(events,options={})=>({version:1,startedAt:t0,retainedFrom:t0,events,...options});
const plan=(events,options={})=>buildPracticePlan(history(events),{now,...options});
const reference='2q1k3/8/8/8/2N5/8/8/4K3 w - - 0 1|c4d6';
const resume=(options={})=>({version:1,position:reference,updatedAt:now,pool:'rapid',theme:'knight-fork',revealed:false,...options});

test('empty dated history creates no invented schedule from lifetime totals',()=>{
  assert.equal(buildPracticePlan(null,{now}).positions.length,0);
  assert.equal(buildPracticePlan({attempts:20,solvedAt:t0},{now}).available,false);
});
test('first clean answer suggests one day and is ready exactly at the due time',()=>{
  assert.deepEqual(REVISIT_INTERVALS,[1,3,7,14]);
  const row=plan([event(t0)],{now:t0+DAY-1}).positions[0];assert.equal(row.nextAt,t0+DAY);assert.equal(row.ready,false);
  assert.equal(plan([event(t0)],{now:t0+DAY}).ready.length,1);
});
test('clean first tries after due times advance through capped 1/3/7/14-day intervals',()=>{
  const times=[0,1,4,11,25],events=times.map(days=>event(t0+days*DAY));
  for(let i=0;i<events.length;i++){
    const row=plan(events.slice(0,i+1)).positions[0];assert.equal(row.intervalDays,REVISIT_INTERVALS[Math.min(i,3)]);assert.equal(row.nextAt,events[i].at+row.intervalDays*DAY);
  }
});
test('clean early practice neither extends the interval nor postpones the existing due date',()=>{
  const row=plan([event(t0),event(t0+DAY),event(t0+2*DAY),event(t0+3*DAY)]).positions[0];
  assert.equal(row.level,1);assert.equal(row.nextAt,t0+4*DAY);assert.equal(row.lastAt,t0+3*DAY);
});
test('many clean same-day attempts count as one scheduling visit',()=>{
  const at=Math.floor(t0/DAY)*DAY+DAY+1000,events=Array.from({length:50},(_,i)=>event(at+i*1000));
  const row=plan(events).positions[0];assert.equal(row.level,0);assert.equal(row.nextAt,at+DAY);
});
test('misses and revealed answers reset a long interval even when retried successfully',()=>{
  const first=[event(t0),event(t0+DAY),event(t0+4*DAY),event(t0+11*DAY)];
  for(const failed of [{correct:false},{revealed:true}]){
    const last=t0+12*DAY,row=plan([...first,event(last,failed),event(last+1000)]).positions[0];
    assert.equal(row.level,-1);assert.equal(row.intervalDays,1);assert.equal(row.nextAt,last+1000+DAY);
  }
});
test('the next independent due visit after assistance starts at one day',()=>{
  const row=plan([event(t0,{revealed:true}),event(t0+DAY)]).positions[0];assert.equal(row.level,0);assert.equal(row.nextAt,t0+2*DAY);
});
test('a UTC date boundary alone cannot advance an interval after only a few minutes',()=>{
  const midnight=Math.floor(t0/DAY)*DAY,at=midnight+DAY-60000;
  const row=plan([event(at),event(at+120000)]).positions[0];assert.equal(row.level,0);assert.equal(row.nextAt,at+DAY);
});
test('an early first visit on the due UTC day remains conservative for that whole day',()=>{
  const at=Math.floor(t0/DAY)*DAY+12*3600000;
  const row=plan([event(at),event(at+DAY-3600000),event(at+DAY+3600000)]).positions[0];assert.equal(row.level,0);assert.equal(row.nextAt,at+DAY);
});
test('positions are independent, ordered by due date and retain their actual source format',()=>{
  const value=plan([event(t0+2*DAY,{position:'later|b1c3',pool:'blitz'}),event(t0,{pool:'rapid'}),event(now,{position:'future|c1d2'})]);
  assert.equal(value.ready.length,2);assert.equal(value.upcoming.length,1);assert.equal(value.positions[0].position,position);assert.equal(value.positions[1].pool,'blitz');
});
test('a truncated first day does not imply clean recall before tracking coverage',()=>{
  const at=t0+DAY,raw=history([event(at)],{startedAt:t0-DAY,retainedFrom:at-1000});
  const value=buildPracticePlan(raw,{now});assert.equal(value.limited,true);assert.equal(value.positions[0].level,-1);assert.equal(value.positions[0].reason,'limited');
});
test('unknown, damaged and future attempt histories cannot produce advice',()=>{
  for(const raw of ['bad',{...history([]),version:2},history([event(now+1)]),history([event(t0,{revealed:undefined})])])assert.equal(buildPracticePlan(raw,{now}).available,false);
});
test('resumable references retain only the minimal typed fields including reveal state',()=>{
  const value=readPracticeResume({...resume({revealed:true}),pgn:'private extra'}, {now});assert.equal(value.available,true);assert.equal(value.entry.revealed,true);assert.equal(value.entry.pgn,undefined);
  assert.deepEqual(readPracticeResume(null,{now}),{available:true,entry:null});
});
test('malformed references, unknown versions, missing assistance and future dates stay read-only',()=>{
  for(const raw of ['bad',resume({version:2}),resume({position:'fake|a1a8'}),resume({revealed:undefined}),resume({updatedAt:now+1}),resume({position:reference.replace('/2N5/','/2N6/')}),resume({pool:'all'})])assert.equal(readPracticeResume(raw,{now}).available,false);
});
test('unfinished references expire after 90 days without inventing a completed attempt',()=>{
  assert.equal(readPracticeResume(resume({updatedAt:now-91*DAY}),{now}).entry,null);
  assert.notEqual(readPracticeResume(resume({updatedAt:now-90*DAY}),{now}).entry,null);
});
test('resume storage isolates accounts, preserves unrelated progress and checks the dismissed position',()=>{
  const oldStorage=globalThis.localStorage,oldWindow=globalThis.window,data=new Map([['chess-personal-training:alpha','keep'],['chess-practice-history:alpha','keep history']]),notices=[];
  globalThis.localStorage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};globalThis.window={dispatchEvent:event=>notices.push(event.detail)};
  try{
    assert.equal(savePracticeResume('alpha',resume({updatedAt:Date.now(),extra:'omit'})),true);assert.equal(loadPracticeResume('beta').entry,null);assert.equal(JSON.parse(data.get(practiceResumeKey('alpha'))).extra,undefined);
    assert.equal(clearPracticeResume('alpha',reference.replace('c4d6','c4b6')),false);assert.ok(loadPracticeResume('alpha').entry);
    assert.equal(clearPracticeResume('alpha',reference),true);assert.equal(loadPracticeResume('alpha').entry,null);assert.equal(data.get('chess-personal-training:alpha'),'keep');assert.equal(data.get('chess-practice-history:alpha'),'keep history');assert.equal(notices.length,2);
  }finally{globalThis.localStorage=oldStorage;globalThis.window=oldWindow;}
});
test('unknown resume versions and unavailable storage cannot be overwritten or deleted',()=>{
  const oldStorage=globalThis.localStorage,oldWindow=globalThis.window;let raw='{"version":2,"keep":"future"}';
  globalThis.localStorage={getItem:()=>raw,setItem:()=>{throw Error('must not write')},removeItem:()=>{throw Error('must not delete')}};globalThis.window={dispatchEvent(){}};
  try{
    assert.equal(loadPracticeResume('alpha').available,false);assert.equal(savePracticeResume('alpha',resume({updatedAt:Date.now()})),false);assert.equal(clearPracticeResume('alpha'),false);assert.equal(raw,'{"version":2,"keep":"future"}');
    raw=null;assert.equal(savePracticeResume('alpha',resume({updatedAt:Date.now()})),false);
    globalThis.localStorage.getItem=()=>{throw Error('denied')};assert.equal(loadPracticeResume('alpha').available,false);assert.equal(clearPracticeResume('alpha'),false);
  }finally{globalThis.localStorage=oldStorage;globalThis.window=oldWindow;}
});
