import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
import {createGameImportClient,normalizeLichessGame,normalizeChessGame,chessArchives,planChessArchives,mergeImportedGames,importPlayer,IMPORT_LIMITS} from '../js/game-import-core.js';
const pgn='[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 1-0';
const lichess=(extra={})=>({id:'abcdefgh',variant:'standard',speed:'blitz',status:'resign',winner:'white',rated:true,createdAt:1800000000000,lastMoveAt:1800000300000,clock:{initial:180,increment:2},players:{white:{user:{name:'Alice'},rating:1800},black:{user:{name:'Bob'},rating:1750}},pgn,...extra});
const chess=(extra={})=>({url:'https://www.chess.com/game/live/123',rules:'chess',end_time:1800000000,white:{username:'Alice',result:'win'},black:{username:'Bob',result:'resigned'},pgn,...extra});
const archive=n=>`https://api.chess.com/pub/player/alice/games/${2020+Math.floor(n/12)}/${String(n%12+1).padStart(2,'0')}`;
const json=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
const stream=(lines,chunks=11)=>{const data=new TextEncoder().encode(lines);let offset=0;return new Response(new ReadableStream({pull(c){if(offset===data.length){c.close();return;}c.enqueue(data.slice(offset,offset+chunks));offset=Math.min(offset+chunks,data.length);}}));};
test('Lichess games normalize into legal existing-review inputs with exact result, clock and site identity',()=>{
 const value=normalizeLichessGame(lichess(),'alice');assert.equal(value.source,'lichess');assert.equal(value.url,'https://lichess.org/abcdefgh');assert.equal(value.white.result,'win');assert.equal(value.black.result,'resigned');assert.equal(value.time_control,'180+2');assert.equal(value.end_time,1800000300);const board=new Chess();board.loadPgn(value.pgn);assert.equal(board.history().length,4);
});
test('finished Lichess result semantics preserve draws, mates, timeout losses and correspondence',()=>{
 for(const [status,winner,result] of [['mate','black','checkmated'],['outoftime','black','timeout'],['stalemate',undefined,'stalemate'],['draw',undefined,'agreed'],['outoftime',undefined,'timevsinsufficient']])assert.equal(normalizeLichessGame(lichess({status,winner}),'alice').white.result,result);
 const value=normalizeLichessGame(lichess({speed:'correspondence',clock:undefined,daysPerTurn:3}),'alice');assert.equal(value.time_class,'daily');assert.equal(value.time_control,'1/259200');assert.equal(normalizeLichessGame(lichess({speed:'classical'}),'alice').time_class,'classical');
});
test('ongoing, variant, anonymous, unrelated, malformed and unknown-result games are not imported',()=>{
 for(const extra of [{status:'started'},{status:'created'},{variant:'chess960'},{pgn:''},{winner:'nobody'},{status:'resign',winner:undefined},{id:'../oops!'},{players:{white:{user:{name:'<script>'}},black:{user:{name:'Bob'}}}}])assert.equal(normalizeLichessGame(lichess(extra),'alice'),null);
 assert.equal(normalizeLichessGame(lichess(),'someone-else'),null);assert.equal(normalizeChessGame(chess({rules:'chess960'}),'alice'),null);assert.equal(normalizeChessGame(chess({url:'javascript:alert(1)'}),'alice'),null);assert.equal(normalizeChessGame(chess(),'bob').source,'chesscom');
});
test('same username on two sites retains separate URLs and repeated imports deduplicate',()=>{
 const a=normalizeChessGame(chess(),'alice'),b=normalizeLichessGame(lichess(),'alice');const first=mergeImportedGames([a],[b,b]);assert.equal(first.games.length,2);assert.equal(first.added,1);assert.equal(mergeImportedGames(first.games,[a,b]).added,0);assert.equal(mergeImportedGames(first.games,[a,b],1).games.length,1);
});
test('archive URLs are restricted to the requested official public player and month',()=>{
 const good=archive(0);assert.deepEqual(chessArchives([good,good,good+'?x',good.replace('alice','bob'),good.replace('api.chess.com','evil.example'),'https://api.chess.com@evil.example/pub/player/alice/games/2026/01'],'alice'),[good]);assert.throws(()=>chessArchives({},'alice'));
});
test('all history uses resumable 12-month batches; latest rechecks boundary months',()=>{
 const archives=Array.from({length:30},(_,n)=>archive(n));const one=planChessArchives(archives,'all');assert.equal(one.targets.length,12);assert.equal(one.remaining,18);const two=planChessArchives(archives,'all',one.targets);assert.equal(two.targets.length,12);assert.ok(two.targets.every(x=>!one.targets.includes(x)));assert.deepEqual(planChessArchives(archives,'month').targets,archives.slice(-2).reverse());assert.equal(planChessArchives(archives,'month',archives).targets.length,2);assert.equal(planChessArchives(archives,'month',archives.slice(-2)).targets.length,2);
});
test('invalid user input is rejected before requests',async()=>{
 let calls=0;const c=createGameImportClient({fetcher:()=>{calls++;}});for(const value of ['','@alice','https://lichess.org/@/alice','a/b','<x>']){assert.equal(importPlayer(value),'');await assert.rejects(c.run({source:'lichess',username:value}));}assert.equal(calls,0);
});
test('Chess.com batches run sequentially and retain completed callbacks before cancellation',async()=>{
 const controller=new AbortController(),saved=[],calls=[];const c=createGameImportClient({fetcher:async url=>{calls.push(url);return json(url.endsWith('archives')?{archives:[archive(0),archive(1)]}:{games:[chess()]});}});
 await assert.rejects(c.run({source:'chesscom',username:'alice',signal:controller.signal,onBatch:async(games,meta)=>{saved.push(meta.archive);controller.abort();}}),{name:'AbortError'});assert.equal(saved.length,1);assert.equal(calls.length,2);
});
test('Lichess exports use documented anonymous, bounded, finished-only options and parse fragmented UTF-8 NDJSON',async()=>{
 let options,url;const saved=[];const c=createGameImportClient({fetcher:async(u,o)=>{url=new URL(u);options=o;return stream('\n'+JSON.stringify(lichess({pgn:'[Event "Étude ♟"]\n'+pgn}))+'\r\n'+JSON.stringify(lichess({id:'ijklmnop',speed:'classical'})),7);}});
 const result=await c.run({source:'lichess',username:'Alice',onBatch:async games=>saved.push(...games)});assert.equal(saved.length,2);assert.equal(result.nextUntil,1799999999999);assert.equal(url.pathname,'/api/games/user/alice');assert.equal(url.searchParams.get('max'),'300');assert.equal(url.searchParams.get('pgnInJson'),'true');assert.equal(url.searchParams.get('ongoing'),'false');assert.equal(options.credentials,'omit');assert.equal(options.headers.Authorization,undefined);assert.equal(options.headers.Accept,'application/x-ndjson');
});
test('Lichess export limits are enforced even if a server sends extra records',async()=>{
 let saved=[];const text=Array.from({length:305},()=>JSON.stringify(lichess())).join('\n');const c=createGameImportClient({fetcher:async()=>stream(text,40000)});const r=await c.run({source:'lichess',username:'alice',until:1800000000010,onBatch:async games=>saved=games});assert.equal(r.received,IMPORT_LIMITS.lichessGames);assert.equal(saved.length,300);assert.equal(r.remaining,1);
});
test('Retry-After prevents immediate repeats and does not persist a failed batch',async()=>{
 let time=1800000000000,calls=0,saved=0;const c=createGameImportClient({now:()=>time,fetcher:async()=>{calls++;return new Response('',{status:429,headers:{'Retry-After':'120'}});}});const options={source:'lichess',username:'alice',onBatch:async()=>saved++};await assert.rejects(c.run(options),/Rate limit/);await assert.rejects(c.run(options),/rate limiting/);assert.equal(calls,1);time+=120001;await assert.rejects(c.run(options),/Rate limit/);assert.equal(calls,2);assert.equal(saved,0);
});
test('malformed exports, HTTP errors and aborts cannot publish a Lichess collection',async()=>{
 for(const response of [()=>stream('{broken json}\n'),()=>new Response('',{status:404}),()=>new Response('',{status:503})]){let saved=false;const c=createGameImportClient({fetcher:async()=>response()});await assert.rejects(c.run({source:'lichess',username:'alice',onBatch:async()=>saved=true}));assert.equal(saved,false);}
 const controller=new AbortController();controller.abort();let calls=0;const c=createGameImportClient({fetcher:()=>calls++});await assert.rejects(c.run({source:'lichess',username:'alice',signal:controller.signal}),{name:'AbortError'});assert.equal(calls,0);
});
test('only one import can use a client at a time, including a pending stream',async()=>{
 let release;const gate=new Promise(r=>release=r);const c=createGameImportClient({fetcher:async()=>{await gate;return stream('');}});const one=c.run({source:'lichess',username:'alice'});await assert.rejects(c.run({source:'chesscom',username:'bob'}),/already running/);release();await one;
});
