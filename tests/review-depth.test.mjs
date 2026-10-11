import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {getReviewDepthPreset,reviewDepthIsCurrent,REVIEW_DEPTH_PRESETS} from '../js/review-depth.js';
test('Fast 8/12 is the default and ultra fast is explicitly a preview',()=>{
 assert.deepEqual(getReviewDepthPreset({getItem:()=>null}),{base:8,critical:12,label:'Fast (recommended)',key:'fast'});
 assert.deepEqual([REVIEW_DEPTH_PRESETS.ultra.base,REVIEW_DEPTH_PRESETS.ultra.critical],[4,6]);
});
test('depth presets and invalid values are validated',()=>{
 assert.equal(getReviewDepthPreset({getItem:()=> 'deep'}).base,16);
 assert.equal(getReviewDepthPreset({getItem:()=> 'invalid'}).key,'fast');
});
test('cached verified reviews are specific to the selected depth',()=>{
 const data={reviewDepthKey:'fast',reviewBaseDepth:8,reviewCriticalDepth:12};
 assert.equal(reviewDepthIsCurrent(data,getReviewDepthPreset({getItem:()=> 'fast'})),true);
 assert.equal(reviewDepthIsCurrent(data,getReviewDepthPreset({getItem:()=> 'deep'})),false);
 assert.equal(reviewDepthIsCurrent({},getReviewDepthPreset({getItem:()=> 'fast'})),false);
});
test('engine uses depth config for full pass, deep pass and cache validation',async()=>{
 const src=await readFile('js/review-corrections.js','utf8');
 assert.match(src,/firstPass\(ctx,config\)/);
 assert.match(src,/depth:config\.base/);
 assert.match(src,/depth:config\.critical/);
 assert.match(src,/reviewDepthIsCurrent\(prior,config\)/);
});
test('settings show selectable depth and save it',async()=>{
 const html=await readFile('index.html','utf8'),settings=await readFile('js/settings-fix.js','utf8');
 assert.match(html,/id="reviewDepth"/);
 assert.match(settings,/localStorage\.setItem\(REVIEW_DEPTH_SETTING,select\.value\)/);
});
