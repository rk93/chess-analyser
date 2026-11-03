import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewProgressState,REVIEW_STUDY_TIPS} from '../js/review-progress.js';
import {createFeedbackController,generateSound,readFeedbackPreferences} from '../js/feedback-core.js';

test('review progress distinguishes startup, completed positions and the separate deep phase',()=>{
  assert.equal(reviewProgressState({phase:'starting'}).indeterminate,true);
  const scan=reviewProgressState({phase:'positions',done:8,total:16,depth:8});
  assert.equal(scan.percent,50);assert.match(scan.caption,/8 \/ 16 positions analysed · depth 8/);
  const deep=reviewProgressState({phase:'critical',done:1,total:4,depth:12});
  assert.equal(deep.percent,25);assert.match(deep.caption,/1 \/ 4 critical positions/);
  for(const phase of ['complete','cancelled','error'])assert.equal(reviewProgressState({phase}).busy,false);
  assert.equal(REVIEW_STUDY_TIPS.length,5);
});
test('progress never invents elapsed estimates or invalid counts from missing phase data',()=>{
  const state=reviewProgressState({phase:'positions',done:Infinity,total:NaN,depth:-5});assert.equal(state.done,0);assert.equal(state.total,0);assert.equal(state.indeterminate,true);
  assert.equal(reviewProgressState({phase:'critical',done:99,total:7}).percent,100);
  assert.equal(reviewProgressState({phase:'positions',done:-4,total:8}).percent,0);
});
test('UI ticks throttle touch and audio together while haptics remain independent of UI sounds',async()=>{
  const settings=readFeedbackPreferences({getItem:()=>null}),buzz=[],plays=[];let now=0;
  const controller=createFeedbackController({read:()=>settings,now:()=>now,vibrate:p=>buzz.push(p),createPlayer:()=>({play:async type=>{plays.push(type);return true;}})});controller.unlock();
  assert.equal(await controller.emit('uiTick'),true);now=40;assert.equal(await controller.emit('uiTick'),false);now=130;await controller.emit('uiTick');
  assert.deepEqual(buzz,[3,3]);assert.deepEqual(plays,[]);
  settings.sound=true;settings.uiSounds=true;now=260;await controller.emit('uiTick');assert.deepEqual(plays,['uiTick']);
  settings.haptics=false;now=390;await controller.emit('uiTick');assert.deepEqual(buzz,[3,3,3]);assert.equal(plays.length,2);
});
test('welcome score is bounded, finite, fades out and is generated in every saved theme',()=>{
  for(const theme of ['classic','soft','modern']){
    const data=generateSound('welcome',theme,8000);assert.equal(data.length,Math.round((theme==='soft'?3.1:4.3)*8000));
    assert.ok(data.every(x=>Number.isFinite(x)&&Math.abs(x)<=.73));assert.equal(Math.abs(data.at(-1)),0);assert.ok(data.some(x=>Math.abs(x)>.1));
  }
});
