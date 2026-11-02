import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverPlayers, readPlayerDirectory, validPlayerName, writePlayerDirectory } from '../js/player-directory.js';
const game = (id, opponent, user = 'alice', time = id) => ({ url:String(id), end_time:time, rules:'chess', white:{username:user,result:'win'},black:{username:opponent,result:'resigned'} });
function storage() { const data=new Map(); return { getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value) }; }
test('discovery labels favourites, searches and actual opponents without importing other accounts',()=>{
 const rows=discoverPlayers([game(1,'bob'),game(2,'bob'),game(3,'cara'),game(4,'private-opponent','other')],'ALICE',{favourites:['saved'],searches:['past','bob']});
 assert.equal(rows[0].name,'saved');assert.deepEqual(rows[0].sources,['Favourite']);
 assert.equal(rows.find(row=>row.name==='bob').games,2);
 assert.deepEqual(rows.find(row=>row.name==='bob').sources,['Recent search','Recent opponent']);
 assert.ok(!rows.some(row=>row.name==='private-opponent'||row.name==='alice'));
 assert.ok(rows.every(row=>!row.sources.includes('Chess.com friend')));
 assert.deepEqual(discoverPlayers([game(1,'bob')],'alice',{favourites:[],searches:[]},'BO').map(row=>row.name),['bob']);
});
test('directory survives reload, is account scoped, deduplicates and bounds saved names',()=>{
 const store=storage();writePlayerDirectory(store,'Alice',{favourites:['BOB','bob',...Array.from({length:30},(_,i)=>'user'+i)],searches:['past']});
 assert.equal(readPlayerDirectory(store,'alice').favourites.length,24);
 assert.equal(readPlayerDirectory(store,'alice').favourites[0],'bob');
 assert.deepEqual(readPlayerDirectory(store,'other'),{favourites:[],searches:[]});
 store.setItem('chess-player-directory:alice','{bad');assert.deepEqual(readPlayerDirectory(store,'alice'),{favourites:[],searches:[]});
});
test('username matching rejects URLs, scripts and whitespace rather than generating network searches',()=>{
 assert.equal(validPlayerName(' RK93 '),'rk93');
 for(const value of ['', '<script>', 'https://site.test', 'a b', 'x'.repeat(51)])assert.equal(validPlayerName(value),null);
});
