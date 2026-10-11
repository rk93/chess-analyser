import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const app=await readFile('js/app.js','utf8');
const ux=await readFile('js/ux-shell.js','utf8');
const css=await readFile('ux-shell.css','utf8');

test('game cards expose structured result, opponent and speed for filter matching',()=>{
 assert.match(app,/d\.dataset\.result=result\.toLowerCase\(\)/);
 assert.match(app,/d\.dataset\.speed=String\(g\.time_class\|\|''\)/);
 assert.match(app,/d\.dataset\.opponent=String\(opp\.username\|\|''\)/);
});
test('time controls distinguish rapid, blitz and bullet using seconds and increments',()=>{
 assert.match(app,/const effective=seconds\+40\*inc/);
 assert.match(app,/effective<180\?'bullet'/);
 assert.match(app,/effective<600\?'blitz'/);
});
test('filters search game cards and paginate only matched games',()=>{
 assert.match(ux,/querySelectorAll\('#games > \.game\.gameWithAvatar'\)/);
 assert.match(ux,/filterResult==='all'\|\|cardResult\(el\)===filterResult/);
 assert.match(ux,/filterSpeed==='all'\|\|cardSpeed\(el\)===filterSpeed/);
 assert.match(ux,/x\.style\.display='none'/);
 assert.match(css,/#games>\.game\[hidden\]\{display:none!important\}/);
});
test('library introduces the app in a concise sentence without soliciting payments',()=>{
 assert.match(ux,/Your chess journey, decoded/);
 assert.match(ux,/ensureLibraryIntro\(\)/);
 assert.doesNotMatch(ux,/donate now|buy me a coffee/i);
});
