import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {AUTO_PLAY_SPEEDS,DEFAULT_AUTO_PLAY_MS,getAutoPlayMs} from '../js/review-playback-settings.js';
test('default remains 300ms and setting accepts advertised intervals',()=>{
 assert.equal(DEFAULT_AUTO_PLAY_MS,300);
 assert.deepEqual(AUTO_PLAY_SPEEDS,[300,500,1000,2000,3000]);
 assert.equal(getAutoPlayMs({getItem:()=>null}),300);
 assert.equal(getAutoPlayMs({getItem:()=> '500'}),500);
 assert.equal(getAutoPlayMs({getItem:()=> '1000'}),1000);
 assert.equal(getAutoPlayMs({getItem:()=> '999'}),300);
});
test('speed setting is persisted and dynamically applied',async()=>{
 const page=await readFile('index.html','utf8');
 const settings=await readFile('js/settings-fix.js','utf8');
 const review=await readFile('js/game-review.js','utf8');
 assert.match(page,/id="reviewAutoplaySpeed"/);
 assert.match(settings,/localStorage\.setItem\(AUTO_PLAY_SPEED_KEY,String\(ms\)\)/);
 assert.match(review,/COACH_MAX_WAIT_MS:getAutoPlayMs\(\)/);
 assert.match(review,/reviewAutoPlaySpeedChanged/);
});
