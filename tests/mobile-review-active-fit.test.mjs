import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const js=await readFile('js/game-review.js','utf8');
const css=await readFile('review-experience.css','utf8');
const rules=css.split('/* Review viewport v2:')[1]||'';
test('all loaded reviews activate the mobile fit mode, not only guided reviews',()=>{
 assert.match(js,/activeReview=data;document\.body\.classList\.add\('review-has-data'\)/);
 assert.match(js,/activeReview=null;document\.body\.classList\.remove\('review-has-data'\)/);
 assert.match(rules,/body\.review-has-data #analysisView\{/);
 assert.doesNotMatch(rules,/body\.review-guided-active/);
});
test('board scales to available device height and commentary stays independently scrollable',()=>{
 assert.match(rules,/--review-board-edge:min\(calc\(100vw - 36px\),max\(135px,calc\(100dvh - 390px\)\)\)/);
 assert.match(rules,/height:var\(--review-board-edge\)!important/);
 assert.match(rules,/max-height:114px!important/);
 assert.match(rules,/overflow-y:auto!important;overscroll-behavior:contain!important/);
});
test('move history and playback remain visible, without the competing bottom dock',()=>{
 assert.match(rules,/#moves,/);
 assert.match(rules,/#reviewProMoveStrip\{/);
 assert.match(rules,/bottom:calc\(142px \+ env\(safe-area-inset-bottom\)\)/);
 assert.match(rules,/#reviewAutoPlay\{grid-column:3\/span 2;grid-row:1\}/);
 assert.match(rules,/\.mobileEngineDock,/);
 assert.match(rules,/\.modernNav\{display:none!important\}/);
});
