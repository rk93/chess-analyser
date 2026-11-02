import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWeaknessReport, reliableReview, savedReviewFacts, estimatedPhase } from '../js/weakness-core.js';
import { buildChessPulse } from '../js/chess-pulse.js';
const now=1800000000,DAY=86400;
function game(i,{pool='rapid',white=true,result='resigned',age=i,opening='Italian Game',rating=1400,other=1500,...rest}={}) {
  const me={username:'alice',rating,result},opponent={username:'bob',rating:other,result:result==='win'?'resigned':'win'};
  return {url:'weakness-'+i,time_class:pool,rules:'chess',rated:true,end_time:now-age*DAY,white:white?me:opponent,black:white?opponent:me,pgn:`[Opening "${opening}"]\n\n1. e4 e5`,...rest};
}
const report=(games,options={})=>buildWeaknessReport(games,'alice',{now,...options});
test('opening observations need five known outcomes and poor results in one colour and format',()=>{
  const games=Array.from({length:5},(_,i)=>game(i));
  assert.equal(report(games.slice(0,4)).findings.length,0);
  const finding=report(games).history[0];assert.equal(finding.games,5);assert.equal(finding.denominator,5);assert.equal(finding.reliability,'Small sample');
  assert.equal(finding.representatives.length,3);assert.match(finding.text,/Italian Game/);
  assert.equal(report(games.map((g,i)=>i<2?{...g,time_class:'blitz'}:g)).findings.length,0);
  assert.equal(report(games.map((g,i)=>i<2?{...g,white:g.black,black:g.white}:g)).findings.length,0);
});
test('future, undated, old, variant, duplicate and foreign games cannot support a recent weakness',()=>{
  const games=Array.from({length:4},(_,i)=>game(i));
  const extras=[game(20,{age:-1}),game(21,{age:91}),game(22,{end_time:null}),game(23,{rules:'chess960'}),{...game(24),white:{username:'stranger',result:'resigned'}},games[0]];
  assert.equal(report([...games,...extras]).rows.length,4);assert.equal(report([...games,...extras]).findings.length,0);
  assert.equal(buildWeaknessReport(games,'someone',{now}).findings.length,0);
});
test('unknown outcomes and missing ratings do not become performance or engine diagnoses',()=>{
  const games=Array.from({length:12},(_,i)=>game(i,{result:'unknown',rating:null,other:null}));
  assert.equal(report(games).findings.length,0);assert.equal(report(games).engine.length,0);
});
test('colour differences need ten outcomes on each side and disclose descriptive context',()=>{
  const games=Array.from({length:20},(_,i)=>game(i,{white:i<10,result:i<10?'resigned':'win'}));
  const value=report(games).history.find(item=>item.kind==='colour');assert.equal(value.games,10);assert.match(value.text,/Opponents and openings/);
  assert.equal(report(games.slice(1)).history.some(item=>item.kind==='colour'),false);
});
test('timeouts need explicit losses, ten known outcomes and a material fraction',()=>{
  const games=Array.from({length:10},(_,i)=>game(i,{result:i<3?'timeout':'win'}));
  assert.equal(report(games).history.find(item=>item.kind==='timeout').games,3);
  assert.equal(report(games.map(g=>({...g,white:{...g.white,result:'resigned'}}))).history.some(item=>item.kind==='timeout'),false);
  assert.equal(report(games.slice(1)).history.some(item=>item.kind==='timeout'),false);
});
test('short-loss evidence excludes games with unknown length rather than assuming they were long',()=>{
  const games=Array.from({length:10},(_,i)=>game(i,{result:i<3?'resigned':'win',pgn:`[PlyCount "${i<3?30:80}"]\n\n1. e4 e5`}));
  assert.equal(report(games).history.find(item=>item.kind==='short-loss').games,3);
  assert.equal(report(games.map((g,i)=>i>=3?{...g,pgn:'1. e4 e5'}:g)).history.some(item=>item.kind==='short-loss'),false);
  assert.equal(report(games.map(g=>({...g,pgn:'1. e4 e5',time_control:'60'}))).history.some(item=>item.kind==='short-loss'),false);
});
test('decline trends use disjoint windows, minimum outcomes and one format',()=>{
  const games=Array.from({length:20},(_,i)=>game(i,{age:i<10?i:31+i-10,result:i<10?'resigned':'win'}));
  const finding=report(games).history.find(item=>item.kind==='decline');assert.equal(finding.trend.delta,-100);assert.equal(finding.trend.direction,'Declining');
  assert.equal(finding.trend.recentGames,10);assert.equal(report(games.slice(1)).history.some(item=>item.kind==='decline'),false);
  assert.equal(report(games.map((g,i)=>i>=10?{...g,time_class:'daily'}:g)).history.some(item=>item.kind==='decline'),false);
});
test('rating-band evidence requires recorded finite ratings and enough same-pool games',()=>{
  const games=Array.from({length:10},(_,i)=>game(i,{other:1250}));assert.match(report(games).history.find(item=>item.kind==='rating-band').title,/lower/);
  assert.equal(report(games.map(g=>({...g,black:{...g.black,rating:null}}))).history.some(item=>item.kind==='rating-band'),false);
});
const fen='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const moves=[{color:'w',from:'a2',to:'a3',san:'a3',before:fen}];
const data=()=>({localStockfishVersion:21,verifiedReviewVersion:1,labels:['Blunder'],evals:[0,-400],bestMoves:['e2e4'],positionExact:[true,true],moveVerified:[true],localDepths:[12,12]});
test('old, partial, shallow, estimated and sparse review arrays cannot count as engine coverage',()=>{
  assert.equal(reliableReview(data(),moves),true);
  for(const patch of [{verifiedReviewVersion:0},{localStockfishVersion:undefined},{localStockfishVersion:'21'},{labels:[]},{evals:[0]},{evals:[0,NaN]},{evals:new Array(2)},{localDepths:[12,7]},{localDepths:[12,undefined]},{positionExact:[true,false]},{moveVerified:[false]},{bestMoves:['invalid']}]){
    assert.equal(reliableReview({...data(),...patch},moves),false);assert.equal(savedReviewFacts(moves,{...data(),...patch},true,()=>({san:'e4'})),null);
  }
});
test('only legal stronger moves for the selected side supply events and precise source positions',()=>{
  const facts=savedReviewFacts(moves,data(),true,()=>({san:'Qh4#'}));assert.equal(facts.events[0].theme,'mate');assert.equal(facts.events[0].ply,1);assert.equal(facts.events[0].fen,fen);
  assert.equal(savedReviewFacts(moves,data(),false,()=>({san:'e4'})),null);assert.equal(savedReviewFacts(moves,data(),true,()=>{throw Error('illegal')}),null);
  assert.equal(savedReviewFacts(moves,{...data(),evals:[0,100]},true,()=>({san:'e4'})).events.length,0);
});
test('Black evidence uses Black perspective and never assigns the opponent move to White',()=>{
  const blackMoves=[{color:'b',from:'a7',to:'a6',san:'a6',before:fen.replace(' w ',' b ')}];
  const review={...data(),bestMoves:['e7e5'],evals:[0,400]};
  assert.equal(savedReviewFacts(blackMoves,review,false,()=>({san:'e5'})).events.length,1);
  assert.equal(savedReviewFacts(blackMoves,review,true,()=>({san:'e5'})),null);
  assert.equal(savedReviewFacts(blackMoves,{...review,evals:[0,-100]},false,()=>({san:'e5'})).events.length,0);
});
test('phase heuristic distinguishes opening, middlegame and reduced-material endgame',()=>{
  assert.equal(estimatedPhase(fen),'opening');assert.equal(estimatedPhase(fen.replace('0 1','0 15')),'middlegame');
  assert.equal(estimatedPhase('8/8/8/3k4/8/8/4K3/8 w - - 0 40'),'endgame');assert.equal(estimatedPhase('bad'),null);
});
test('engine patterns count distinct games, not duplicate evidence or out-of-window games',()=>{
  const games=Array.from({length:4},(_,i)=>game(i)),facts=savedReviewFacts(moves,data(),true,()=>({san:'e4'})),reviews=report(games).rows.map(row=>({row,facts}));
  assert.equal(report(games,{reviews:reviews.slice(0,2)}).engine.length,0);
  const model=report(games,{reviews:[...reviews,reviews[0]]});assert.equal(model.reviewed,4);assert.equal(model.engine.find(item=>item.kind==='blunders').games,4);
  assert.equal(model.engine[0].denominator,4);assert.equal(model.engine[0].trend,null);assert.equal(model.engine[0].source,'engine-review');assert.equal(report([],{reviews}).engine.length,0);
});
test('complete clean reviews count in denominators while missing reviews do not imply mistake-free games',()=>{
  const games=Array.from({length:10},(_,i)=>game(i)),rows=report(games).rows,facts=savedReviewFacts(moves,data(),true,()=>({san:'e4'}));
  const reviews=rows.slice(0,6).map((row,i)=>({row,facts:i<3?facts:i<5?{events:[],phases:['opening']}:null})),model=report(games,{reviews});
  assert.equal(model.reviewed,5);assert.equal(model.scanned,6);assert.equal(model.engine[0].games,3);assert.equal(model.engine[0].denominator,5);assert.equal(model.rows.length,10);
});
test('pulse isolates formats and needs pre-window baselines for seven/thirty-day changes',()=>{
  const games=[game(1,{age:40,rating:1200}),game(2,{age:10,rating:1250}),game(3,{age:1,rating:1300}),game(4,{pool:'bullet',rating:2400}),game(5,{age:-1,rating:9999}),game(6,{rated:false,rating:9998})];
  const pulse=buildChessPulse(games,'alice',{now}),rapid=pulse.find(item=>item.pool==='rapid');assert.equal(rapid.latest,1300);assert.equal(rapid.best,1300);assert.equal(rapid.weekly,50);assert.equal(rapid.monthly,100);
  assert.equal(pulse.find(item=>item.pool==='bullet').weekly,null);assert.equal(pulse.find(item=>item.pool==='daily').latest,null);
});
test('engine improvement uses affected-game rates and needs five eligible reviews in each period',()=>{
  const games=Array.from({length:10},(_,i)=>game(i,{age:i<5?i+1:31+i-5}));
  const eventFacts=savedReviewFacts(moves,data(),true,()=>({san:'e4'}));
  const reviews=report(games).rows.map((row,i)=>({row,facts:i>=5&&i<8?eventFacts:{events:[],phases:['opening']}}));
  const finding=report(games,{reviews}).engine.find(item=>item.kind==='blunders');
  assert.equal(finding.trend.direction,'Improving');assert.equal(finding.trend.delta,-60);assert.equal(finding.trend.recentGames,5);
  assert.equal(report(games,{reviews:reviews.slice(1)}).engine[0].trend,null);
});
