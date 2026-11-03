import {generateWelcomeSound} from './welcome-sound.js';
export const FEEDBACK_PREFIX='chess-analyser-pref:';
export const SOUND_EVENTS=Object.freeze(['move','capture','check','checkmate','castle','promotion','illegal','puzzleSuccess','puzzleIncorrect','victory','defeat','draw','achievement','reviewComplete','uiTap','uiTick','reviewStart','welcome']);
const THEMES=['classic','soft','modern'];
export function readFeedbackPreferences(storage=globalThis.localStorage) {
  const read=key=>{try{return storage?.getItem(FEEDBACK_PREFIX+key)}catch{return null}};
  const raw=read('soundVolume'),volume=raw!==null&&raw!==''&&Number.isFinite(Number(raw))?Math.max(0,Math.min(100,Number(raw))):35;
  return {sound:read('sound')==='on',volume,theme:THEMES.includes(read('soundTheme'))?read('soundTheme'):'classic',
    haptics:read('haptics')!=='off',uiSounds:read('uiSounds')==='on',reducedAnimations:read('reducedAnimations')==='on'};
}
export function moveFeedbackEvent(move) {
  if(!move)return null;
  if(move.san?.includes('#'))return 'checkmate';
  if(move.promotion)return 'promotion';
  if(move.san?.includes('+'))return 'check';
  if(/[kq]/.test(move.flags||''))return 'castle';
  return move.captured?'capture':'move';
}
export function gameResultFeedback(game,username) {
  const user=String(username||'').trim().toLowerCase();
  const side=['white','black'].find(side=>user&&String(game?.[side]?.username||'').toLowerCase()===user);
  const result=game?.[side]?.result;
  return result==='win'?'victory':['agreed','repetition','stalemate','insufficient','50move','timevsinsufficient','draw'].includes(result)?'draw':['checkmated','resigned','timeout','lose','abandoned'].includes(result)?'defeat':null;
}
const HAPTICS={selection:6,uiTap:4,uiTick:3,capture:12,puzzleSuccess:[10,30,16],puzzleIncorrect:[7,25,7],illegal:7,achievement:[10,30,16]};

// Injected platform adapter keeps preference, deduplication and lifecycle rules
// testable without creating audio or touching browser globals on import.
export function createFeedbackController({read=readFeedbackPreferences,createPlayer=()=>null,vibrate=()=>false,isActive=()=>true,now=()=>Date.now()}={}) {
  let armed=false,player=null,generation=0,lastTime=-Infinity,lastTouch=-Infinity,lastPriority=0,playback={playing:false,interval:0};
  const seen=new Map();
  function stop(){generation++;try{player?.stop()}catch{}try{vibrate(0)}catch{}}
  return {
    unlock(){armed=true;},
    stop,
    playback(value){const next={playing:value?.playing===true,interval:Number(value?.interval)||0};if(next.playing===playback.playing&&next.interval===playback.interval)return;stop();playback=next;},
    async emit(type,{context='',id,haptic,automatic=false}={}) {
      try {
        if(!armed||!isActive(context)||(!SOUND_EVENTS.includes(type)&&type!=='selection'))return false;
        const settings=read(),boardMove=['move','capture','check','checkmate','castle','promotion','victory','defeat','draw'].includes(type),auto=automatic||(context==='board'&&playback.playing&&boardMove);
        if(auto&&(!playback.playing||playback.interval<=500))return false;
        const stamp=now(),interaction=['uiTap','uiTick'].includes(type),priority=interaction?0:1;
        if(type==='selection'){if(!settings.haptics||auto||stamp-lastTouch<50)return false;lastTouch=stamp;try{return vibrate(HAPTICS.selection)!==false}catch{return false;}}
        if(id!==undefined){const key=context+'|'+id;if(seen.has(key))return false;seen.set(key,true);if(seen.size>128)seen.delete(seen.keys().next().value);}
        if((stamp-lastTime<(type==='uiTick'?120:65)&&priority<=lastPriority) || (priority<lastPriority&&stamp-lastTime<200))return false;
        lastTime=stamp;lastPriority=priority;
        let touched=false;
        const pattern=HAPTICS[haptic||type];
        if(settings.haptics&&!auto&&pattern){try{touched=vibrate(pattern)!==false}catch{}}
        if(!settings.sound||settings.volume<=0||(interaction&&!settings.uiSounds))return touched;
        player=player||createPlayer();if(!player)return touched;
        const token=generation;
        const current=()=>token===generation&&isActive(context)&&read().sound&&read().volume>0;
        if(!current())return touched;
        return (await player.play(type,settings,current))||touched;
      }catch{return false;}
    },
    dispose(){stop();try{player?.dispose()}catch{}player=null;armed=false;seen.clear();},
  };
}

const NOTES={move:[310],capture:[185],check:[560,690],checkmate:[440,330,220],castle:[275,310],promotion:[440,660,880],illegal:[200,170],puzzleSuccess:[440,550,660],puzzleIncorrect:[260,220],victory:[440,550,660,880],defeat:[330,275,220],draw:[330,330],achievement:[440,660,880,1100],reviewComplete:[390,520,650],uiTap:[420],uiTick:[640],reviewStart:[330,440]};
// Original, deterministic percussion and chimes. No third-party sound assets.
export function generateSound(type,theme='classic',sampleRate=44100) {
  if(type==='welcome')return generateWelcomeSound(theme,sampleRate,generateSound);
  const notes=NOTES[type];if(!notes)return new Float32Array();
  const step=type==='castle'?.052:type==='uiTap'?.016:.065;
  const tail=type==='uiTap'?.025:['move','capture','castle'].includes(type)?.09:.15;
  const data=new Float32Array(Math.ceil((step*(notes.length-1)+tail)*sampleRate));
  let seed=23751+SOUND_EVENTS.indexOf(type)*137;
  for(let i=0;i<data.length;i++){
    const t=i/sampleRate;let value=0;
    for(let n=0;n<notes.length;n++){
      const age=t-n*step;if(age<0||age>tail)continue;
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/2147483648-1;
      const frequency=notes[n]*(theme==='modern'?1.35:theme==='soft'?.85:1);
      const body=Math.sin(2*Math.PI*frequency*age)*Math.exp(-age/(theme==='soft'?.025:.018));
      const wood=noise*Math.exp(-age/.004)+.35*Math.sin(2*Math.PI*frequency*.52*age)*Math.exp(-age/.025);
      const melodic=!['move','capture','castle','uiTap'].includes(type);
      value+=(theme==='classic'&&!melodic?wood:body+(theme==='modern'?.12:.035)*noise*Math.exp(-age/.006))*Math.min(1,age/.0015);
    }
    data[i]=Math.max(-1,Math.min(1,value))*(theme==='soft'?.48:.7)*(type==='uiTap'?.3:1);
  }
  return data;
}
