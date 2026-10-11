import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const css=await readFile('review-experience.css','utf8');
const section=css.split('/* One-screen guided review:')[1]||'';
test('guided mobile board scales to viewport height instead of exceeding phone screen',()=>{
 assert.match(section,/--review-square-size:max\(160px,min\(calc\(100vw - 34px\),calc\(100dvh - 385px\)\)\)/);
 assert.match(section,/height:var\(--review-square-size\)!important/);
 assert.match(section,/height:calc\(100dvh - env\(safe-area-inset-bottom\)\)/);
});
test('coach explanations stay readable through internal scrolling, preserving best lines',()=>{
 assert.match(section,/overflow-y:auto!important;overscroll-behavior:contain!important/);
 assert.doesNotMatch(section,/#reviewAutoBest,\s*body.*display:none/);
});
test('move strip and transport stay on screen while unrelated sidebar is hidden',()=>{
 assert.match(section,/#reviewProMoveStrip\{/);
 assert.match(section,/bottom:calc\(158px \+ env\(safe-area-inset-bottom\)\)/);
 assert.match(section,/\.sidePanel > :not\(#reviewProMoveStrip\)/);
 assert.match(section,/\.reviewGuideActions\{/);
});
