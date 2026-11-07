import test from 'node:test';
import assert from 'node:assert/strict';
import {readPracticeHistory,appendPracticeAttempt,buildPracticeSummary,PRACTICE_DAY as DAY,PRACTICE_LIMIT} from '../js/practice-history-core.js';
const now=1800000000000;
const event=(id,age=0,options={})=>({id:'run:'+id,position:'position-'+id+'|a1a8',at:now-age*DAY,correct:true,revealed:false,pool:'rapid',theme:'capture',...options});
const history=(events,options={})=>({version:1,startedAt:now-80*DAY,retainedFrom:now-80*DAY,events,...options});
const summary=(value,options={})=>buildPracticeSummary(value,{now,...options});
test('new history is empty and cannot backfill dated success from lifetime counters',()=>{
  const value=summary(null);assert.equal(value.available,true);assert.equal(value.attempts,0);assert.equal(value.comparison,null);assert.equal(value.startedAt,null);
  assert.equal(summary(readPracticeHistory(null,{now})).available,true);
  assert.equal(summary({attempts:50,correct:40}).available,false);
});
test('append records only necessary typed fields and deduplicates a replayed attempt identity',()=>{
  const first=appendPracticeAttempt(null,{...event(1),unnecessary:'do not persist'},{now});assert.equal(first.changed,true);assert.equal(first.history.events.length,1);assert.equal(first.history.events[0].unnecessary,undefined);
  assert.equal(appendPracticeAttempt(first.history,event(1),{now}).changed,false);assert.equal(first.history.startedAt,now);
});
test('distinct-position outcomes separate reveals, unassisted solves and still-unsolved retries',()=>{
  const value=summary(history([event(1,1,{correct:false}),event(2,1,{position:'position-1|a1a8'}),event(3,1,{revealed:true}),event(4,1,{correct:false})]));
  assert.equal(value.positions,3);assert.equal(value.independent,1);assert.equal(value.assisted,1);assert.equal(value.pending,1);assert.equal(value.attempts,4);
  assert.equal(value.buckets.reduce((n,day)=>n+day.attempts,0),4);
});
test('a position solved both ways is counted once and an unassisted solve takes precedence',()=>{
  const value=summary(history([event(1,1,{revealed:true}),event(2,1,{position:'position-1|a1a8'})]));assert.equal(value.positions,1);assert.equal(value.independent,1);assert.equal(value.assisted,0);
});
test('rolling UTC windows are disjoint and include the exact recent boundary once',()=>{
  const value=summary(history([event(1,7),event(2,7.001),event(3,0)]));assert.equal(value.attempts,2);assert.equal(value.buckets.reduce((n,day)=>n+day.attempts,0),2);assert.equal(value.days,7);
  assert.equal(summary(history([event(1,20)]),{days:30}).attempts,1);assert.equal(summary(history([event(1,20)])).attempts,0);
});
test('comparison uses the same five positions and their first recorded attempt, not later retries',()=>{
  const events=[];for(let i=0;i<5;i++){events.push(event('old'+i,9,{position:'p'+i+'|a1a8',correct:false}));events.push(event('new'+i,2,{position:'p'+i+'|a1a8',correct:i!==0}));}
  events.push(event('retry',1,{position:'p0|a1a8'}));const value=summary(history(events));assert.equal(value.independent,5);assert.equal(value.comparison.positions,5);assert.equal(value.comparison.current,80);assert.equal(value.comparison.previous,0);assert.equal(value.comparison.delta,80);
  assert.equal(summary(history(events.filter(e=>!e.position.startsWith('p4')))).comparison,null);
});
test('different position mixes and assisted first answers cannot manufacture improvement',()=>{
  const events=Array.from({length:5},(_,i)=>event('a'+i,9));events.push(...Array.from({length:5},(_,i)=>event('b'+i,1)));assert.equal(summary(history(events)).comparison,null);
  const matched=events.map((e,i)=>({...e,position:'p'+i%5+'|a1a8',revealed:i>=5}));assert.equal(summary(history(matched)).comparison.current,0);
});
test('incomplete dated coverage withholds comparisons even with five overlapping positions',()=>{
  const events=[];for(let i=0;i<5;i++)events.push(event('old'+i,9,{position:'p'+i+'|a1a8'}),event('new'+i,1,{position:'p'+i+'|a1a8'}));
  const value=summary(history(events,{startedAt:now-10*DAY,retainedFrom:now-10*DAY}));assert.equal(value.matched,5);assert.equal(value.comparison,null);
});
test('retention and the 500-event bound retain a conservative coverage boundary',()=>{
  const events=Array.from({length:510},(_,i)=>event(i,20-i/100));const value=readPracticeHistory(history(events),{now});assert.equal(value.events.length,PRACTICE_LIMIT);assert.ok(value.retainedFrom>now-20*DAY);
  assert.equal(summary(value,{days:30}).comparison,null);assert.equal(summary(value,{days:30}).partial,true);
  const same=readPracticeHistory(history(Array.from({length:501},(_,i)=>event(i))),{now});assert.ok(same.retainedFrom<=now);assert.equal(readPracticeHistory(same,{now}).available,true);
});
test('old events expire while unknown formats and damaged or future data remain unwritable',()=>{
  const old=history([event(1,89),event(2,91)],{startedAt:now-100*DAY,retainedFrom:now-100*DAY});assert.equal(readPracticeHistory(old,{now}).events.length,1);
  for(const raw of ['{bad',history([event(1,-1)]),history([event(1,0,{revealed:undefined})]),{...history([]),version:2}]){assert.equal(readPracticeHistory(raw,{now}).available,false);assert.equal(appendPracticeAttempt(raw,event(2),{now}).changed,false);}
});
test('format filtering remains explicit and does not combine differently sourced practice samples',()=>{
  const value=history([event(1,1),event(2,1,{pool:'blitz'})]);assert.equal(summary(value,{pool:'rapid'}).positions,1);assert.equal(summary(value,{pool:'blitz'}).positions,1);assert.equal(summary(value,{pool:'daily'}).positions,0);
});
test('history normalisation is chronological and never treats a missing assistance flag as independent',()=>{
  const events=[event(2,1,{position:'same|a1a8'}),event(1,2,{position:'same|a1a8',correct:false})];const value=readPracticeHistory(history(events),{now});assert.equal(value.events[0].id,'run:1');
  assert.equal(summary(history([event(1,1,{revealed:null})])).available,false);
});
