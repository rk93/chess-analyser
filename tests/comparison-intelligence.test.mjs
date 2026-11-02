import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPARISON_POOLS, formatSummary, headToHead, openingGroups, publicFormatStats, selectSample } from '../js/comparison-intelligence.js';
const now=1800000000;
function game(i,options={}){return {url:'game'+i,end_time:now-i*86400,time_class:'rapid',rules:'chess',rated:true,white:{username:'alice',rating:1400+i,result:'win'},black:{username:'bob',rating:1500,result:'resigned'},pgn:'[Opening "Italian Game"]\n\n1. e4 e5',...options};}
test('all four lifetime pools are distinct and missing or malformed records stay unknown',()=>{
 const stats={chess_rapid:{last:{rating:1500,date:now},record:{win:20,draw:5,loss:25}},chess_bullet:{last:{rating:900},record:{win:4,draw:2,loss:4}}};
 assert.equal(COMPARISON_POOLS.length,4);assert.equal(publicFormatStats(stats,'rapid').winRate,40);
 assert.equal(publicFormatStats(stats,'bullet').rating,900);assert.equal(publicFormatStats(stats,'daily').games,null);
 assert.equal(publicFormatStats({chess_blitz:{record:{win:10,draw:-1,loss:0}}},'blitz').games,null);
 assert.equal(publicFormatStats({chess_daily:{record:{win:0,draw:0,loss:0}}},'daily').winRate,null);
});
test('a common date window excludes older, future and undated games while explicit all includes undated',()=>{
 const games=[game(1),game(70),game(-1),game(3,{end_time:null})];
 assert.deepEqual(selectSample(games,'alice',{now,days:60}).map(row=>row.key),['game1']);
 assert.equal(selectSample(games,'alice',{now,days:'all'}).length,3);
});
test('format detail uses that pool alone and requires dated rated observations for trends',()=>{
 const games=[game(1),game(2),game(3,{time_class:'bullet'}),game(4,{rated:false})];
 const stats=formatSummary(selectSample(games,'alice',{now}),'rapid');
 assert.equal(stats.games,3);assert.equal(stats.points.length,2);assert.equal(stats.rating,1401);assert.equal(stats.delta,-1);
 assert.equal(stats.white.known,3);assert.equal(stats.black.known,0);
});
test('opening evidence separates colour and pool and requires five outcomes, with explicit rating bands',()=>{
 const games=Array.from({length:5},(_,i)=>game(i));games.push(game(9,{time_class:'blitz'}));
 const groups=openingGroups(selectSample(games,'alice',{now}));
 assert.equal(groups[0].eligible,true);assert.equal(groups[0].known,5);assert.equal(groups[0].strength.higher.known,5);
 assert.equal(groups[1].eligible,false);assert.equal(groups[1].pool,'blitz');
});
test('head to head deduplicates the same encounter in both samples, retains colours, and filters format',()=>{
 const games=[game(1),game(2,{time_class:'daily'}),game(3,{white:{username:'bob',rating:1400,result:'win'},black:{username:'alice',rating:1400,result:'resigned'}}),game(4,{black:{username:'someone',result:'resigned'}})];
 const a=selectSample(games,'alice',{now}),b=selectSample(games,'bob',{now});
 const match=headToHead(a,b,'alice','bob');assert.equal(match.games,3);assert.equal(match.wins,2);assert.equal(match.losses,1);assert.equal(match.black.games,1);
 assert.equal(headToHead(a,b,'alice','bob','daily').games,1);
 assert.equal(headToHead(a,b,'alice','absent').games,0);
});
