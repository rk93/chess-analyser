import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const src=await readFile('js/lab.js','utf8');

test('analysis arrows are redrawn from last result after flipping the board',()=>{
 assert.match(src,/let displayedAnalysis=null/);
 assert.match(src,/displayedAnalysis=\{fen,pvs:data\.pvs\}/);
 assert.match(src,/labFlip'\)\.addEventListener\('click',[^\n]*render\(\);if\(displayedAnalysis\?\.fen===chess\.fen\(\)\)draw\(displayedAnalysis\.pvs\)/);
});
test('arrows use live board orientation in their square coordinates',()=>{
 assert.match(src,/function squareCenter\(sq\)/);
 assert.match(src,/orientation==='white'\?f:7-f/);
 assert.match(src,/orientation==='white'\?8-r:r-1/);
});
test('moving to a different position clears saved arrows and invalidates outstanding engine requests',()=>{
 assert.match(src,/function clearAnalysis\(\)\{analysisRun\+\+;displayedAnalysis=null/);
 assert.match(src,/if\(run!==analysisRun\)return/);
});
