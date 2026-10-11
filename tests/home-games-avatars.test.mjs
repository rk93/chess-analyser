import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const app=await readFile('js/app.js','utf8'),ui=await readFile('js/ux-shell.js','utf8');
test('mobile page contains five games, desktop twenty',()=>{
 assert.match(ui,/PAGE_SIZE=\(\)=>window\.matchMedia\('\(max-width:800px\)'\)\.matches\?5:20/);
 assert.match(ui,/matches\.slice\(\(page-1\)\*PAGE_SIZE\(\),page\*PAGE_SIZE\(\)\)/);
});
test('external player names are assigned as text, not interpolated in html',()=>{
 const section=app.slice(app.indexOf('function renderGames('),app.indexOf('function formatTimeControl('));
 assert.match(section,/title\.textContent=/);
 assert.doesNotMatch(section,/innerHTML=/);
});
test('avatars load lazily and retain initials for profiles without images',()=>{
 assert.match(app,/IntersectionObserver/);
 assert.match(app,/api\.chess\.com\/pub\/player\//);
 assert.match(app,/avatar\.textContent=/);
 assert.match(app,/image\.onerror=/);
});
test('game cards support keyboard activation',()=>{
 assert.match(app,/d\.tabIndex=0/);
 assert.match(app,/e\.key==='Enter'\|\|e\.key===' '/);
});
