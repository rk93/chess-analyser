import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile('js/game-review.js','utf8');
const css=await readFile('review-experience.css','utf8');
test('wide review docks card before the analysis shell',()=>{
  const fn=source.split('function positionReviewCard(){')[1].split('function ensureGuideCard(){')[0];
  assert.match(fn,/min-width: 1100px/);
  assert.match(fn,/layout\.prepend\(card\)/);
  assert.match(fn,/layout\.append\(shell\)/);
});
test('review wrapper persists across breakpoints',()=>{
  const fn=source.split('function positionReviewCard(){')[1].split('function ensureGuideCard(){')[0];
  assert.match(fn,/layout\.before\(shell\)/);
  assert.match(fn,/shell\.before\(card\)/);
  assert.match(fn,/layout\.remove\(\)/);
  assert.match(source,/addEventListener\('resize',positionReviewCard/);
});
test('desktop layout limits coach height and retains room for chessboard',()=>{
  assert.match(css,/@media\(min-width:1100px\)/);
  assert.match(css,/grid-template-columns:minmax\(255px,300px\) minmax\(0,1fr\)/);
  assert.match(css,/max-height:calc\(100dvh - 24px\)/);
  assert.match(css,/:has\(> #reviewGuideCard\[hidden\]\)/);
});
