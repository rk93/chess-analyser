import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Chess} from 'chess.js';
import {compileOpening,filterOpeningEntries,OpeningLesson} from '../js/opening-lesson-core.js';
const data=JSON.parse(await readFile('data/openings/catalog.json','utf8'));
test('all shipped ECO paths play legally and reach their recorded final positions',()=>{
 const ids=new Set();assert.ok(data.entries.length>3000);assert.equal(data.license,'CC0-1.0');
 for(const entry of data.entries){
  assert.match(entry.eco,/^[A-E]\d\d$/);assert.ok(!ids.has(entry.id));ids.add(entry.id);assert.equal(entry.gambit,/gambit/i.test(entry.name));
  const line=compileOpening(entry,Chess),board=new Chess();for(const move of line.moves)board.move(move.san);assert.equal(board.fen(),line.end,entry.name);
 }
});
test('opening and gambit search cover the whole catalogue with case-insensitive word matching',()=>{
 const openings=filterOpeningEntries(data.entries),gambits=filterOpeningEntries(data.entries,'',true);assert.equal(openings.length+gambits.length,data.entries.length);
 assert.ok(filterOpeningEntries(data.entries,'SICILIAN najdorf').some(entry=>entry.eco==='B90'));
 assert.ok(filterOpeningEntries(data.entries,"king's gambit",true).length>20);assert.deepEqual(filterOpeningEntries(data.entries,'nonexistent chess line'),[]);
});
test('both colours follow the entire line and reject legal deviations without advancing',()=>{
 const entry=data.entries.find(entry=>entry.name==='Italian Game'),line=compileOpening(entry,Chess);
 for(const side of ['white','black']){
  const lesson=new OpeningLesson(line,{side}),board=new Chess();assert.equal(lesson.automatic('w'),side==='black');
  assert.equal(lesson.accepts(board.fen(),'d2d4'),false);assert.equal(lesson.index,0);assert.equal(lesson.advance('bad fen'),false);
  for(const move of line.moves){assert.equal(lesson.accepts(board.fen(),move.uci,{automatic:lesson.automatic(board.turn())}),true);board.move(move.san);assert.equal(lesson.advance(board.fen()),true);}
  assert.equal(board.fen(),line.end);assert.equal(lesson.phase,'complete');assert.equal(lesson.next,null);
 }
});
test('watch mode owns both sides and invalid catalogue data cannot create a session',()=>{
 const lesson=new OpeningLesson(compileOpening(data.entries[0],Chess),{mode:'watch'});assert.equal(lesson.automatic('w'),true);assert.equal(lesson.automatic('b'),true);
 assert.equal(lesson.accepts(lesson.line.start,lesson.next.uci),false);assert.equal(lesson.accepts(lesson.line.start,lesson.next.uci,{automatic:true}),true);
 assert.throws(()=>compileOpening({name:'Broken',pgn:'1. e5'},Chess));assert.throws(()=>compileOpening({name:'Empty',pgn:''},Chess));
});
