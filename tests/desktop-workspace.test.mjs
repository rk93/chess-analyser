import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const review=await readFile('js/game-review.js','utf8');
const styles=await readFile('review-experience.css','utf8');
const nav=await readFile('ux-shell.css','utf8');
test('desktop review card is inside the right panel and mobile stays board first',()=>{
  const fn=review.slice(review.indexOf('function positionReviewCard(){'),review.indexOf('function ensureGuideCard(){'));
  assert.match(fn,/if\(narrow\)/);
  assert.match(fn,/shell\.after\(card\)/);
  assert.match(fn,/panel\.insertBefore\(card,review\)/);
  assert.match(fn,/\.sidePanel/);
});
test('desktop navigation moves to left rail, mobile remains breakpoint-aware',()=>{
  assert.match(nav,/@media\(min-width:1050px\)/);
  assert.match(nav,/\.homeTabs\.modernNav/);
  assert.match(nav,/flex-direction:column!important/);
});
test('board and move list occupy separately sized columns',()=>{
  assert.match(styles,/grid-template-columns:minmax\(450px/);
  assert.match(styles,/\.sidePanel>\.moves/);
  assert.match(styles,/overflow-y:auto;overscroll-behavior:contain/);
  assert.match(styles,/\.sidePanel>\.controls/);
});
test('transport remains usable inside the right panel',()=>{
  assert.match(styles,/#reviewPrev\{grid-column:1;grid-row:1\}/);
  assert.match(styles,/#reviewAutoPlay\{grid-column:2;grid-row:1\}/);
  assert.match(styles,/#reviewNext\{grid-column:3;grid-row:1\}/);
});
