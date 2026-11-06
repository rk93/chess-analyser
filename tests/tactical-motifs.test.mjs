import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
import {classifyTacticalMotif} from '../js/tactical-motifs.js';
import {savedReviewFacts,buildWeaknessReport} from '../js/weakness-core.js';
import {buildWeeklyCoach} from '../js/weekly-coach-core.js';

const FORK='2q1k3/8/8/8/2N5/8/8/4K3 w - - 0 1';
const PIN='4k3/4n3/8/8/8/8/6K1/3R4 w - - 0 1';
const classify=(fen,move)=>classifyTacticalMotif(fen,move,value=>new Chess(value));
function mirror(fen){
  const parts=fen.split(' ');parts[0]=parts[0].split('/').reverse().map(row=>[...row].map(c=>/[a-z]/.test(c)?c.toUpperCase():/[A-Z]/.test(c)?c.toLowerCase():c).join('')).join('/');parts[1]='b';return parts.join(' ');
}
test('checking knight fork verifies every legal defence and identifies the actual major-piece target',()=>{
  const motif=classify(FORK,'c4d6');assert.equal(motif.kind,'knight-fork');assert.deepEqual(motif.targets,['c8']);assert.equal(motif.king,'e8');assert.match(motif.explanation,/Every legal reply/);
  assert.equal(classify(FORK.replace('2q1k3','2r1k3'),'c4d6').kind,'knight-fork');
  const black=classify(mirror(FORK),'c5d3');assert.equal(black.kind,'knight-fork');assert.equal(black.king,'e1');assert.deepEqual(black.targets,['c1']);
});
test('apparent forks are rejected if the knight is capturable or a legal target capture disappears',()=>{
  assert.equal(classify(FORK.replace('2q1k3','2qrk3'),'c4d6'),null); // Rd8 can take Nd6.
  assert.equal(classify('2q1k3/8/8/8/2N5/8/8/2r1K3 w - - 0 1','c4d6'),null); // Own king remains checked.
  assert.equal(classify(FORK.replace('2q1k3','4k3'),'c4d6'),null);
  assert.equal(classify(FORK,'c4b6'),null); // Attacks the queen, but not the king.
  // ...Kf8/Ke7 uncovers a pin on Nd6. ...Kd7 permits Nxb7, so testing only
  // one favourable defence would incorrectly call this a reliable fork.
  assert.equal(classify('R2rk3/1r6/8/8/2N5/8/8/3K4 w - - 0 1','c4d6'),null);
});
test('an absolute pin requires an unobstructed slider-piece-king line and a new pin',()=>{
  const pin=classify(PIN,'d1e1');assert.equal(pin.kind,'absolute-pin');assert.deepEqual(pin.targets,['e7']);assert.equal(pin.king,'e8');assert.match(pin.explanation,/not a forced material win/);
  assert.equal(classify(mirror(PIN),'d8e8').kind,'absolute-pin');
  assert.equal(classify('4k3/4n3/8/8/8/8/4R1K1/8 w - - 0 1','e2e1'),null); // Existing pin.
  assert.equal(classify('4k3/8/2n5/8/B7/8/4B3/6K1 w - - 0 1','e2b5'),null); // Another bishop already pins the same target.
  assert.equal(classify(PIN.replace('4k3','3k4'),'d1e1'),null); // Relative attack, no king behind.
  assert.equal(classify(PIN.replace('4n3/8','4n3/4p3'),'d1e1'),null); // Pawn blocks the ray.
});
test('diagonal pins identify bishops and queens; blocked opening lines and removable pinners stay unnamed',()=>{
  assert.equal(classify('4k3/8/2n5/8/2B5/8/8/6K1 w - - 0 1','c4b5').kind,'absolute-pin');
  assert.equal(classify('4k3/8/2n5/8/2Q5/8/8/6K1 w - - 0 1','c4b5').kind,'absolute-pin');
  assert.equal(classify('r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3','f1b5'),null);
  assert.equal(classify(PIN.replace('4n3','4q3'),'d1e1'),null); // Pinned queen can capture the rook.
  assert.equal(classify('4k3/4n3/8/8/7b/8/6K1/3R4 w - - 0 1','d1e1'),null); // ...Bxe1 removes the pinner.
});
test('invalid, unavailable, illegal, already-checking and ordinary positions produce no speculative motif',()=>{
  for(const [fen,move] of [['invalid','c4d6'],[FORK,'bad'],[FORK,'c4c5'],[FORK.replace('2N5','2N1R3'),'c4d6'],[new Chess().fen(),'e2e4']])assert.equal(classify(fen,move),null);
  assert.equal(classifyTacticalMotif(FORK,'c4d6'),null);
  assert.equal(classifyTacticalMotif(FORK,'c4d6',()=>{throw Error('unavailable')}),null);
  assert.equal(classify('4k3/8/8/8/3q4/8/6K1/3R4 w - - 0 1','d1d4'),null); // A capture does not prove a hanging-piece motif.
});
test('absolute-pin findings also require three distinct complete reviewed games',()=>{
  const now=1800000000,{moves,data}=review(PIN,'d1e1','Rd2'),facts=savedReviewFacts(moves,data,true,describe,classify);
  assert.equal(facts.events[0].motif.kind,'absolute-pin');
  const games=Array.from({length:3},(_,i)=>({url:'pin-'+i,end_time:now-i*60,rules:'chess',time_class:'rapid',white:{username:'alice',result:'resigned'},black:{username:'bob',result:'win'},pgn:'1. e4 e5'}));
  const rows=buildWeaknessReport(games,'alice',{now}).rows,reviews=rows.map(row=>({row,facts}));
  assert.equal(buildWeaknessReport(games,'alice',{now,reviews}).engine.find(item=>item.kind==='absolute-pin').games,3);
  assert.equal(buildWeaknessReport(games,'alice',{now,reviews:reviews.slice(0,2)}).engine.some(item=>item.kind==='absolute-pin'),false);
});

function review(fen=FORK,best='c4d6',played='Kf1'){
  const board=new Chess(fen);board.move(played);const moves=board.history({verbose:true});
  return {moves,data:{localStockfishVersion:21,verifiedReviewVersion:1,labels:['Blunder'],evals:[0,-400],bestMoves:[best],positionExact:[true,true],moveVerified:[true],localDepths:[12,12]}};
}
const describe=(fen,uci)=>new Chess(fen).move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});
test('named motifs require a complete exact review, the player side, positive loss and a legal stronger move',()=>{
  const {moves,data}=review();const facts=savedReviewFacts(moves,data,true,describe,classify);
  assert.equal(facts.events[0].motif.kind,'knight-fork');assert.equal(facts.events[0].ply,1);
  for(const patch of [{verifiedReviewVersion:0},{positionExact:[true,false]},{localDepths:[12,7]},{moveVerified:[false]},{evals:[0]},{bestMoves:['c4c5']}])assert.equal(savedReviewFacts(moves,{...data,...patch},true,describe,classify),null);
  assert.equal(savedReviewFacts(moves,data,false,describe,classify),null);
  assert.equal(savedReviewFacts(moves,{...data,evals:[0,200]},true,describe,classify).events.length,0);
});
test('recurrence counts distinct saved games in one format with reviewed denominators and exact source positions',()=>{
  const now=1800000000,{moves,data}=review(),facts=savedReviewFacts(moves,data,true,describe,classify);
  const games=Array.from({length:4},(_,i)=>({url:'motif-'+i,end_time:now-i*60,rules:'chess',time_class:'rapid',white:{username:'alice',result:'resigned'},black:{username:'bob',result:'win'},pgn:'1. e4 e5'}));
  const rows=buildWeaknessReport(games,'alice',{now}).rows,reviews=rows.map((row,i)=>({row,facts:i<3?facts:{events:[],phases:['opening']}}));
  const report=buildWeaknessReport(games,'alice',{now,reviews:[...reviews,reviews[0]]}),finding=report.engine.find(item=>item.kind==='knight-fork');
  assert.equal(finding.games,3);assert.equal(finding.denominator,4);assert.equal(finding.depth,12);assert.equal(finding.representatives[0].fen,FORK);assert.match(finding.text,/not establish a forced win/);
  assert.equal(buildWeaknessReport(games,'alice',{now,reviews:reviews.slice(0,2)}).engine.some(item=>item.kind==='knight-fork'),false);
  assert.equal(buildWeaknessReport(games,'other',{now,reviews}).engine.length,0);
  const split=games.map((game,i)=>i>=2?{...game,time_class:'blitz'}:game);
  assert.equal(buildWeaknessReport(split,'alice',{now,reviews:buildWeaknessReport(split,'alice',{now}).rows.map(row=>({row,facts}))}).engine.some(item=>item.kind==='knight-fork'),false);
});
test('weekly plan prioritises a supported specific motif over generic blunders without relaxing the three-game minimum',()=>{
  const now=1800000000,{moves,data}=review(),facts=savedReviewFacts(moves,data,true,describe,classify);
  const games=Array.from({length:5},(_,i)=>({url:'weekly-motif-'+i,end_time:now-i*60,rules:'chess',time_class:'rapid',white:{username:'alice',result:'resigned'},black:{username:'bob',result:'win'},pgn:'1. e4 e5'}));
  const rows=buildWeaknessReport(games,'alice',{now}).rows;
  const generic={...facts,events:facts.events.map(event=>({...event,motif:null}))};
  const reviews=rows.map((row,i)=>({row,facts:i<3?facts:generic}));
  const action=buildWeeklyCoach(games,'alice',{now,reviews}).actions[0];
  assert.equal(action.title,'Practise a checking knight fork');assert.equal(action.practice.motif.kind,'knight-fork');assert.match(action.evidence,/3 supporting \/ 5 reviewed/);
  reviews[2].facts=generic;
  assert.equal(buildWeeklyCoach(games,'alice',{now,reviews}).actions[0].title,'Revisit one verified decision');
  const pin=review(PIN,'d1e1','Rd2'),pinFacts=savedReviewFacts(pin.moves,pin.data,true,describe,classify);
  for(let i=0;i<3;i++)reviews[i].facts=pinFacts;
  assert.equal(buildWeeklyCoach(games,'alice',{now,reviews}).actions[0].title,'Study an absolute pin');
});
