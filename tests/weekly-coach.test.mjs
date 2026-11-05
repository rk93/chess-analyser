import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWeeklyCoach,updateCoachStudy,COACH_WINDOW,COACH_DAY} from '../js/weekly-coach-core.js';
import {playerGames} from '../js/player-insights.js';
const now=1800000000;
function game(id,{age=1,pool='rapid',white=true,result='resigned',opening='Italian Game',...rest}={}){
  const me={username:'alice',result,rating:1400},other={username:'bob-'+id,result:result==='win'?'resigned':'win',rating:1450};
  return {_key:'week-'+id,url:'week-'+id,rules:'chess',rated:true,time_class:pool,time_control:'600',end_time:now-age*COACH_DAY,white:white?me:other,black:white?other:me,pgn:`[Opening "${opening}"]\n\n1. e4 e5`,...rest};
}
function reviewed(games,{events=true}={}){return playerGames(games,'alice').map(row=>({row,facts:{phases:['opening'],events:events?[{fen:'8/8/8/8/8/6k1/8/R5K1 w - - 0 1',bestMove:'a1a8',bestSan:'Ra8',badMove:'Ra2',label:'Blunder',ply:1,side:row.white?'White':'Black',depth:12,theme:'capture'}]:[]}}));}
const plan=(games,options={})=>buildWeeklyCoach(games,' ALICE ',{now,...options});

test('weekly report uses disjoint matching windows, deduplicates and excludes unsupported data',()=>{
  const current=game(1,{age:0}),boundary=game(2,{age:7}),previous=game(3,{age:14}),old=game(4,{age:14.01});
  const extras=[current,game(5,{age:-1}),game(6,{end_time:null}),game(7,{rules:'chess960'}),{...game(8),white:{username:'stranger',result:'win'}}];
  const value=plan([current,boundary,previous,old,...extras]);assert.equal(value.current.games,2);assert.equal(value.previous.games,1);
  assert.equal(plan([game(1)],{pool:'blitz'}).current.games,0);assert.equal(buildWeeklyCoach([game(1)],'other',{now}).actions.length,0);
});
test('unknown results stay visible but cannot become losses, scores or diagnoses',()=>{
  const value=plan([game(1,{result:'unknown'})]);assert.equal(value.current.known,0);assert.equal(value.current.unknown,1);assert.equal(value.current.score,null);assert.equal(value.comparison,null);
  assert.ok(value.actions.every(action=>action.source!=='engine-review'));assert.equal(value.coverage.inspected,0);
});
test('score changes need ten known results in both weeks of the selected format',()=>{
  const games=Array.from({length:20},(_,i)=>game(i,{age:i<10?1:8,result:i<10?'win':'resigned'}));
  assert.equal(plan(games).comparison.delta,100);assert.equal(plan(games.slice(1)).comparison,null);
  assert.equal(plan(games.map((g,i)=>i>=10?{...g,time_class:'blitz'}:g)).comparison,null);
  assert.equal(plan(games.map((g,i)=>i===0?{...g,white:{...g.white,result:'unknown'}}:g)).comparison,null);
});
test('opening actions require five known games in the same colour, format and week',()=>{
  const games=Array.from({length:5},(_,i)=>game(i));assert.ok(plan(games).actions.some(a=>a.kind==='opening'));
  for(const changed of [games.slice(1),games.map((g,i)=>i===0?{...g,time_class:'blitz'}:g),games.map((g,i)=>i===0?{...g,white:g.black,black:g.white}:g),games.map((g,i)=>i===0?{...g,end_time:now-8*COACH_DAY}:g)])assert.equal(plan(changed).actions.some(a=>a.kind==='opening'),false);
});
test('three distinct eligible reviews support a recurring engine action; one supports only one studied moment',()=>{
  const games=Array.from({length:3},(_,i)=>game(i,{opening:''})),reviews=reviewed(games);
  const value=plan(games,{reviews});assert.equal(value.coverage.reviewed,3);const action=value.actions.find(a=>a.kind==='practice');assert.match(action.text,/3 of 3 eligible reviewed rapid games/);assert.equal(action.practice.trainingUser,'alice');
  const one=plan(games,{reviews:reviews.slice(0,1)}).actions.find(a=>a.kind==='practice');assert.match(one.text,/One game does not establish/);
  assert.equal(plan(games,{reviews:[reviews[0],reviews[0],reviews[0]]}).coverage.reviewed,1);
});
test('coverage separates eligible, inspected-but-unavailable and unchecked games',()=>{
  const games=Array.from({length:4},(_,i)=>game(i)),reviews=reviewed(games).slice(0,2);reviews[1].facts=null;
  const c=plan(games,{reviews}).coverage;assert.deepEqual(c,{games:4,inspected:2,reviewed:1,unavailable:1,unchecked:2});
  assert.equal(plan(games,{reviews:reviews.map(r=>({...r,row:{...r.row,white:false}}))}).coverage.inspected,0);
});
test('foreign, previous-week, stale and malformed review evidence cannot supply weekly engine actions',()=>{
  const games=[game(1),game(2,{age:8}),game(3,{pool:'blitz'})],reviews=reviewed(games);
  assert.equal(plan(games,{reviews:reviews.filter(r=>r.row.key!=='week-1')}).actions.some(a=>a.kind==='practice'),false);
  const stale=structuredClone(reviews);stale.find(r=>r.row.key==='week-1').row.end--;
  assert.equal(plan(games,{reviews:stale}).coverage.reviewed,0);
  for(const facts of [null,{events:[null],phases:[]},{events:[{depth:4}],phases:[]}])assert.equal(plan([games[0]],{reviews:[{row:reviews.find(r=>r.row.key==='week-1').row,facts}]}).coverage.reviewed,0);
});
test('plan offers distinct concrete actions and never fills an empty week with invented weaknesses',()=>{
  const games=Array.from({length:8},(_,i)=>game(i,{opening:i<5?'Italian Game':''}));
  const value=plan(games,{reviews:reviewed(games.slice(5))});assert.deepEqual(value.actions.map(a=>a.kind),['practice','opening','review']);assert.equal(new Set(value.actions.map(a=>a.target.key)).size,3);
  assert.equal(plan([]).actions.length,0);assert.equal(plan([game(1,{age:8})]).actions.length,0);
});
test('existing practice history prioritises unsolved or assisted positions without claiming playing improvement',()=>{
  const games=Array.from({length:3},(_,i)=>game(i,{opening:''})),reviews=reviewed(games),first=reviews[0].facts.events[0];
  for(const review of reviews)review.facts.events.push({...review.facts.events[0],bestMove:'a1a7'});
  const trainingProgress={[first.fen+'|'+first.bestMove]:{correct:1,assisted:0,solvedAt:now*1000}};
  assert.equal(plan(games,{reviews,trainingProgress}).actions[0].practice.bestMove,'a1a7');
  trainingProgress[first.fen+'|a1a7']={correct:1,assisted:1,solvedAt:now*1000};
  assert.equal(plan(games,{reviews,trainingProgress}).actions[0].practiceStatus,'Previously solved with help');
  trainingProgress[first.fen+'|a1a7'].assisted=0;
  assert.equal(plan(games,{reviews,trainingProgress}).actions[0].title,'Revisit a solved position');
  delete trainingProgress[first.fen+'|a1a7'].assisted;
  assert.equal(plan(games,{reviews,trainingProgress}).actions[0].practiceStatus,'Previous solve recorded');
});
test('self-reported study marks persist by action identity for seven days and never create engine improvement claims',()=>{
  const games=[game(1)],action=plan(games).actions[0],progress=updateCoachStudy({},action.id,true,{now});
  assert.equal(plan(games,{progress}).actions[0].completed,true);assert.equal(plan(games,{progress,now:now+COACH_WINDOW+1}).actions.length,0);
  assert.deepEqual(updateCoachStudy(progress,action.id,false,{now}),{});
  const openingGames=Array.from({length:5},(_,i)=>game(i)),openingAction=plan(openingGames).actions.find(a=>a.kind==='opening'),marks=updateCoachStudy({},openingAction.id,true,{now}),later=now+COACH_WINDOW+1;
  const fresh=openingGames.map(g=>({...g,end_time:later-COACH_DAY}));assert.equal(plan(fresh,{now:later,progress:marks}).actions.find(a=>a.kind==='opening').completed,false);
  assert.deepEqual(updateCoachStudy({bad:{completedAt:now},'coach-v1:future':{completedAt:now+1}},'bad',true,{now}),{});
  const many=Object.fromEntries(Array.from({length:130},(_,i)=>['coach-v1:'+i,{completedAt:now-i}]));assert.equal(Object.keys(updateCoachStudy(many,action.id,true,{now})).length,100);
});
