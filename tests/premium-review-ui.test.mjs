import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const app=await readFile('js/app.js','utf8'),review=await readFile('review-experience.css','utf8'),css=await readFile('ux-shell.css','utf8'),shell=await readFile('js/ux-shell.js','utf8');
test('first-page avatars load eagerly despite pagination hiding items',()=>{
 assert.match(app,/if\(root\.children\.length<=5\)d\.loadAvatar\(\)/);
 assert.match(app,/avatar\.classList\.add\('hasAvatar'\)/);
 assert.match(css,/\.gamePlayerAvatar\.hasAvatar/);
});
test('premium review provides large three-button primary transport on phones',()=>{
 assert.match(review,/#reviewPrev\{grid-column:1\/span 2;grid-row:1\}/);
 assert.match(review,/#reviewAutoPlay\{grid-column:3\/span 2;grid-row:1\}/);
 assert.match(review,/#reviewNext\{grid-column:5\/span 2;grid-row:1\}/);
 assert.match(review,/min-height:56px!important/);
});
test('all primary buttons provide press animation and keyboard focus',()=>{
 assert.match(shell,/function installPressFeedback\(\)/);
 assert.match(shell,/addEventListener\('pointerdown'/);
 assert.match(css,/\.premiumTapped/);
 assert.match(css,/:focus-visible/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});
