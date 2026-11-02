import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicPlayerClient, publicCachePolicy } from '../js/player-public-data.js';
function harness(handler,clock=()=>1800000000000){const data=new Map(),calls=[];const client=createPublicPlayerClient({now:clock,read:async(ns,key)=>data.get(ns+'|'+key),write:async(ns,key,value)=>data.set(ns+'|'+key,value),fetcher:async(url,options)=>{calls.push(url);return handler(url,options)}});return{client,data,calls};}
const json=(data,headers={})=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json',...headers}});
test('cache policy respects max-age, Age, no-cache and no-store',()=>{
 assert.equal(publicCachePolicy(new Headers({'Cache-Control':'public,max-age=120','Age':'20'}),1000).expiresAt,101000);
 assert.equal(publicCachePolicy(new Headers({'Cache-Control':'no-cache'}),1000).expiresAt,1000);
 assert.equal(publicCachePolicy(new Headers({'Cache-Control':'no-store'}),1000).store,false);
});
test('metadata caches profile and stats, refresh remains explicit, and no undocumented endpoints are used',async()=>{
 const h=harness(url=>json(url.endsWith('/stats')?{chess_rapid:{}}:{username:'alice',avatar:'https://images.chesscomfiles.com/avatar.png'}));
 await h.client.metadata('Alice');await h.client.metadata('alice');assert.equal(h.calls.length,2);
 await h.client.metadata('alice',{refresh:true});assert.equal(h.calls.length,4);
 assert.ok(h.calls.every(url=>/^https:\/\/api.chess.com\/pub\/player\/alice(?:\/stats)?$/.test(url)));
});
test('bounded samples cache each resource and reuse old comparison snapshots without changing the game library',async()=>{
 const h=harness(url=>json(url.endsWith('/archives')?{archives:[1,2,3,4].map(n=>`https://api.chess.com/pub/player/alice/games/2026/0${n}`)}:{games:[{url,end_time:1000}]}));
 const a=await h.client.sample('alice'),b=await h.client.sample('alice');assert.equal(a.games.length,3);assert.equal(b.games.length,3);assert.equal(h.calls.length,4);
 h.data.set('player-comparison|bob',{version:1,updated:1800000000000,archives:1,games:[{url:'old'}]});
 assert.equal((await h.client.sample('bob')).games[0].url,'old');assert.equal(h.calls.length,4);
});
test('no-store responses are never persisted and expired caches are explicitly labelled stale offline',async()=>{
 let online=true,time=1800000000000;
 const h=harness(url=>{if(!online)throw new TypeError('offline');return json(url.endsWith('/stats')?{}:{username:'alice'},{'Cache-Control':'max-age=1'});},()=>time);
 await h.client.metadata('alice');online=false;time+=2000;
 const stale=await h.client.metadata('alice');assert.equal(stale.stale,true);assert.equal(stale.profile.username,'alice');assert.ok(stale.warnings.length>0);
 const n=harness(url=>json(url.endsWith('/stats')?{}:{username:'alice'},{'Cache-Control':'no-store'}));await n.client.metadata('alice');assert.equal(n.data.size,0);
});
test('requests are sequential, Retry-After suppresses repeat requests and cancellation stops queued work',async()=>{
 let running=0,max=0;
 const h=harness(async url=>{running++;max=Math.max(max,running);await new Promise(resolve=>setTimeout(resolve,5));running--;return json(url.endsWith('/stats')?{}:{username:url.includes('alice')?'alice':'bob'});});
 await Promise.all([h.client.metadata('alice'),h.client.metadata('bob')]);assert.equal(max,1);
 const limited=harness(()=>new Response('{}',{status:429,headers:{'Retry-After':'60'}}));await limited.client.metadata('alice');assert.equal(limited.calls.length,1);
 const abort=new AbortController();abort.abort();await assert.rejects(()=>h.client.sample('alice',{signal:abort.signal}),{name:'AbortError'});
});

test('a no-store refresh retires an older cached body and a 304 retains no-cache policy',async()=>{
 let mode='initial';
 const h=harness(url=>{
  if(mode==='not-modified')return new Response(null,{status:304});
  return json(url.endsWith('/stats')?{}:{username:'alice'},{'Cache-Control':mode==='private'?'no-store':'no-cache'});
 });
 await h.client.metadata('alice');mode='not-modified';await h.client.metadata('alice');
 assert.equal(h.data.get('player-public-profile|alice').expiresAt,1800000000000);
 mode='private';await h.client.metadata('alice',{refresh:true});assert.equal(h.data.get('player-public-profile|alice').data,null);
});
