import test from 'node:test';
import assert from 'node:assert/strict';
import {readFeedbackPreferences,createFeedbackController,moveFeedbackEvent,gameResultFeedback,generateSound,SOUND_EVENTS} from '../js/feedback-core.js';
import {createSynthPlayer} from '../js/feedback-audio.js';
const storage=values=>({getItem:key=>values[key.replace('chess-analyser-pref:','')]??null});
const prefs=()=>readFeedbackPreferences(storage({sound:'on'}));
function fixture({settings=prefs(),factory}={}){
  let time=0,active=true,created=0;const plays=[],buzz=[];
  const controller=createFeedbackController({read:()=>settings,now:()=>time,isActive:()=>active,vibrate:pattern=>{buzz.push(pattern);return true},
    createPlayer:()=>{created++;return factory?factory():{play:async(type,options,current)=>{if(!current())return false;plays.push([type,options]);return true},stop(){},dispose(){}}}});
  return {controller,settings,plays,buzz,tick:ms=>{time+=ms},hide:()=>{active=false},created:()=>created};
}
test('new users are muted with Classic at 35%, haptics on and UI sounds off',()=>{
  assert.deepEqual(readFeedbackPreferences(storage({})),{sound:false,volume:35,theme:'classic',haptics:true,uiSounds:false,reducedAnimations:false});
});
test('legacy on/off and saved interaction preferences are preserved',()=>{
  assert.equal(readFeedbackPreferences(storage({sound:'on'})).sound,true);
  assert.deepEqual(readFeedbackPreferences(storage({sound:'off',soundVolume:'52',soundTheme:'soft',haptics:'off',uiSounds:'on',reducedAnimations:'on'})),{sound:false,volume:52,theme:'soft',haptics:false,uiSounds:true,reducedAnimations:true});
});
test('corrupt or unavailable storage uses safe bounded defaults',()=>{
  const p=readFeedbackPreferences(storage({soundVolume:'loud',soundTheme:'unknown'}));assert.equal(p.volume,35);assert.equal(p.theme,'classic');
  assert.equal(readFeedbackPreferences(storage({soundVolume:'999'})).volume,100);assert.equal(readFeedbackPreferences(storage({soundVolume:'-1'})).volume,0);
  assert.equal(readFeedbackPreferences({getItem(){throw Error('blocked')}}).sound,false);
});
test('a single semantic event takes precedence for mates, promotions, checks, castles and captures',()=>{
  assert.equal(moveFeedbackEvent({san:'Qxh7#',captured:'p'}),'checkmate');assert.equal(moveFeedbackEvent({san:'g8=Q+',promotion:'q'}),'promotion');
  assert.equal(moveFeedbackEvent({san:'Nxd5+',captured:'p'}),'check');assert.equal(moveFeedbackEvent({san:'O-O',flags:'k'}),'castle');
  assert.equal(moveFeedbackEvent({san:'exd6',captured:'p',flags:'e'}),'capture');assert.equal(moveFeedbackEvent({san:'e4'}),'move');assert.equal(moveFeedbackEvent(null),null);
});
test('end-of-game results require the configured participant and a known public result',()=>{
  const game={white:{username:'Alice',result:'win'},black:{username:'bob',result:'resigned'}};
  assert.equal(gameResultFeedback(game,'alice'),'victory');assert.equal(gameResultFeedback(game,'BOB'),'defeat');assert.equal(gameResultFeedback(game,'other'),null);
  assert.equal(gameResultFeedback({...game,white:{username:'alice',result:'agreed'}},'alice'),'draw');assert.equal(gameResultFeedback({},'alice'),null);
});
test('no audio context or haptics are created merely by loading or calling before a gesture',async()=>{
  const f=fixture();assert.equal(await f.controller.emit('move'),false);assert.equal(await f.controller.emit('selection'),false);assert.equal(f.created(),0);assert.equal(f.buzz.length,0);
});
test('muted and zero-volume modes allocate no audio, while optional haptics remain independent',async()=>{
  for(const settings of [{...prefs(),sound:false,haptics:false},{...prefs(),volume:0,haptics:false}]){
    const f=fixture({settings});f.controller.unlock();assert.equal(await f.controller.emit('move'),false);assert.equal(f.created(),0);
  }
  const f=fixture({settings:{...prefs(),sound:false}});f.controller.unlock();assert.equal(await f.controller.emit('selection'),true);assert.deepEqual(f.buzz,[6]);assert.equal(f.created(),0);
});
test('selection haptics do not swallow an immediately following move sound',async()=>{
  const f=fixture();f.controller.unlock();await f.controller.emit('selection');await f.controller.emit('capture');assert.equal(f.plays.length,1);assert.equal(f.plays[0][0],'capture');assert.deepEqual(f.buzz,[6,12]);
});
test('explicit event IDs deduplicate outcomes and repeated taps are rate limited',async()=>{
  const f=fixture();f.controller.unlock();assert.equal(await f.controller.emit('puzzleSuccess',{id:'puzzle-1'}),true);f.tick(1000);
  assert.equal(await f.controller.emit('puzzleSuccess',{id:'puzzle-1'}),false);assert.equal(await f.controller.emit('puzzleSuccess',{id:'puzzle-2'}),true);
  assert.equal(await f.controller.emit('capture'),false);assert.equal(f.plays.length,2);assert.equal(f.created(),1);
});
test('UI sounds are separately opt-in and cannot override a higher-priority board event',async()=>{
  const f=fixture();f.controller.unlock();assert.equal(await f.controller.emit('uiTap'),false);assert.equal(f.created(),0);
  await f.controller.emit('move');f.settings.uiSounds=true;f.tick(100);assert.equal(await f.controller.emit('uiTap'),false);f.tick(150);assert.equal(await f.controller.emit('uiTap'),true);
});
test('rapid autoplay and automatic replies are silent and never vibrate',async()=>{
  for(const interval of [300,500]){const f=fixture();f.controller.unlock();f.controller.playback({playing:true,interval});f.buzz.length=0;assert.equal(await f.controller.emit('capture',{context:'board'}),false);assert.equal(f.plays.length,0);assert.equal(f.buzz.length,0);}
  const f=fixture();f.controller.unlock();assert.equal(await f.controller.emit('capture',{context:'puzzleBoard',automatic:true}),false);assert.equal(f.buzz.length,0);
});
test('a single review completion remains audible while rapid board playback stays silent',async()=>{
  const f=fixture();f.controller.unlock();f.controller.playback({playing:true,interval:300});assert.equal(await f.controller.emit('reviewComplete',{context:'board',id:'review1'}),true);f.tick(300);assert.equal(await f.controller.emit('move',{context:'board'}),false);assert.equal(f.plays.length,1);
});
test('relaxed autoplay can play a move without haptics and repeated state does not interrupt it',async()=>{
  let stops=0;const f=fixture({factory:()=>({play:async()=>true,stop:()=>{stops++}})});f.controller.unlock();
  f.controller.playback({playing:true,interval:1000});await f.controller.emit('capture',{context:'board'});f.buzz.length=0;
  f.controller.playback({playing:true,interval:1000});assert.equal(stops,0);assert.equal(f.buzz.length,0);
});
test('navigation and hidden contexts reject delayed completions',async()=>{
  const f=fixture();f.controller.unlock();f.hide();assert.equal(await f.controller.emit('achievement',{context:'homeView'}),false);assert.equal(f.created(),0);
  let release;const gate=new Promise(resolve=>{release=resolve});const pending=fixture({factory:()=>({play:async(type,p,current)=>{await gate;return current()},stop(){}})});pending.controller.unlock();
  const result=pending.controller.emit('reviewComplete');pending.controller.stop();release();assert.equal(await result,false);
});
test('missing, throwing audio and haptic APIs fail quietly',async()=>{
  assert.equal(createSynthPlayer(null),null);
  for(const factory of [()=>null,()=>{throw Error('unavailable')},()=>({play(){throw Error('denied')}})]){const f=fixture({factory});f.controller.unlock();assert.equal(await f.controller.emit('move'),false);}
  const controller=createFeedbackController({read:prefs,vibrate(){throw Error('unsupported')}});controller.unlock();assert.equal(await controller.emit('selection'),false);
});
test('all events and themes have original finite, brief and distinct generated waveforms',()=>{
  const fingerprints=new Set();
  for(const type of SOUND_EVENTS){const data=generateSound(type,'classic',8000);assert.ok(data.length>0&&data.length<4000);assert.ok(data.every(value=>Number.isFinite(value)&&Math.abs(value)<=1));fingerprints.add(data.length+':'+Array.from(data.slice(8,24)).join(','));}
  assert.equal(fingerprints.size,SOUND_EVENTS.length);
  assert.notDeepEqual(generateSound('move','classic',8000),generateSound('move','soft',8000));assert.notDeepEqual(generateSound('move','classic',8000),generateSound('move','modern',8000));
});
function fakeAudio({resume}={}){
  const audit={contexts:0,starts:0,stops:0,disconnects:0,resumes:0,closed:0,gains:[]};
  class Audio {
    constructor(){audit.contexts++;this.state=resume?'suspended':'running';this.sampleRate=8000;this.currentTime=0;this.destination={};}
    async resume(){audit.resumes++;await resume?.();this.state='running';}
    createBuffer(channels,length){return {copyToChannel(){},length};}
    createBufferSource(){return {connect(){},disconnect(){audit.disconnects++},start(){audit.starts++},stop(){audit.stops++}};}
    createGain(){return {gain:{setValueAtTime:value=>audit.gains.push(value)},connect(){},disconnect(){audit.disconnects++}};}
    close(){audit.closed++;return Promise.resolve();}
  }
  return {Audio,audit};
}
test('the audio adapter reuses one context, replaces voices and disconnects its nodes',async()=>{
  const {Audio,audit}=fakeAudio(),player=createSynthPlayer(Audio);assert.equal(await player.play('move',prefs()),true);assert.equal(await player.play('capture',prefs()),true);
  assert.equal(audit.contexts,1);assert.equal(audit.starts,2);assert.equal(audit.stops,1);assert.equal(audit.disconnects,2);assert.equal(audit.gains[0],.14*.35);
  player.dispose();assert.equal(audit.closed,1);assert.equal(audit.disconnects,4);
});
test('suspended/resume-rejected contexts and cleanup cannot start stale voices',async()=>{
  let release;const gate=new Promise(resolve=>{release=resolve});const {Audio,audit}=fakeAudio({resume:()=>gate}),player=createSynthPlayer(Audio);
  const result=player.play('move',prefs());player.stop();release();assert.equal(await result,false);assert.equal(audit.starts,0);
  const rejected=fakeAudio({resume:()=>Promise.reject(Error('gesture required'))});assert.equal(await createSynthPlayer(rejected.Audio).play('move',prefs()),false);assert.equal(rejected.audit.starts,0);
});
