import {generateSound} from './feedback-core.js';

export function createSynthPlayer(Audio=globalThis.AudioContext||globalThis.webkitAudioContext) {
  if(!Audio)return null;
  const context=new Audio(),buffers=new Map();let voice=null,generation=0;
  function stop(){generation++;const prior=voice;voice=null;if(prior){try{prior.source.stop()}catch{}try{prior.source.disconnect();prior.gain.disconnect()}catch{}}}
  return {
    async play(type,settings,current=()=>true) {
      stop();const token=generation;
      try {
        if(context.state==='suspended')await context.resume();
        if(token!==generation||!current()||context.state!=='running')return false;
        const key=type+'|'+settings.theme;
        if(!buffers.has(key)){
          const samples=generateSound(type,settings.theme,context.sampleRate);if(!samples.length)return false;
          const buffer=context.createBuffer(1,samples.length,context.sampleRate);buffer.copyToChannel(samples,0);buffers.set(key,buffer);
        }
        const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffers.get(key);
        gain.gain.setValueAtTime(.14*settings.volume/100,context.currentTime);source.connect(gain);gain.connect(context.destination);
        const entry=voice={source,gain};source.onended=()=>{try{source.disconnect();gain.disconnect()}catch{}if(voice===entry)voice=null;};
        source.start();return true;
      }catch{stop();return false;}
    },stop,
    dispose(){stop();buffers.clear();try{Promise.resolve(context.close()).catch(()=>{})}catch{}},
  };
}
