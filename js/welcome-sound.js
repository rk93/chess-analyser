// Original score for Pip's first welcome. Generated only after an explicit tap.
// The melody, orchestration and percussion are authored for this application.
export function generateWelcomeSound(theme='classic',rate=44100,pieceSound=()=>new Float32Array()) {
  const soft=theme==='soft',duration=soft?3.1:4.3,size=Math.round(duration*rate),data=new Float32Array(size);
  const hz=midi=>440*2**((midi-69)/12);
  function add(start,length,voice,amp=1) {
    const offset=Math.round(start*rate),frames=Math.round(length*rate);
    for(let i=0;i<frames&&offset+i<size;i++)data[offset+i]+=voice(i/rate,i/frames)*amp;
  }
  function note(midi,start,length,amp,kind='horn') {
    const f=hz(midi);
    add(start,length,(t,p)=>{
      const envelope=Math.min(1,t/.018)*Math.min(1,(1-p)*length/.11);
      if(kind==='bell')return envelope*Math.exp(-t/.32)*(Math.sin(2*Math.PI*f*t)+.25*Math.sin(2*Math.PI*f*2.76*t)*Math.exp(-t/.13));
      if(kind==='pluck')return envelope*Math.exp(-t/.18)*(Math.sin(2*Math.PI*f*t)+.28*Math.sin(2*Math.PI*f*2*t)+.13*Math.sin(2*Math.PI*f*3*t));
      const phase=2*Math.PI*f*t+.009*Math.sin(2*Math.PI*5.2*t);let value=0;
      for(let n=1;n<=8;n++)value+=Math.sin(phase*n)/n**(kind==='strings'?1.65:theme==='modern'?1.9:2.1);
      return envelope*Math.exp(-t/(kind==='strings'?1.25:.65))*value;
    },amp);
  }
  if(soft) {
    [62,67,71,69,67].forEach((m,i)=>{note(m,.1+i*.29,i===4?.9:.45,.17,'pluck');note(m+12,.12+i*.29,.6,.035,'bell');});
    [55,59,62].forEach(m=>note(m,1.28,1.1,.035,'strings'));
  } else {
    for(const [start,chord,length]of [[.08,[43,50,55,59],1.4],[1.2,[48,55,60,64],.9],[1.95,[50,57,62,66],.8],[2.65,[43,50,55,59,62],1.5]])chord.forEach(m=>note(m,start,length,.034,'strings'));
    for(const [m,start,length]of [[62,.12,.34],[67,.40,.34],[69,.68,.34],[71,.96,.48],[76,1.38,.34],[74,1.66,.34],[69,1.96,.35],[66,2.25,.32],[67,2.65,1.05]]) {
      note(m,start,length,.13);note(m+12,start+.014,length,.024,'bell');
    }
    for(const [start,amp]of [[.06,.14],[.63,.07],[1.2,.07],[1.94,.09],[2.64,.16]])add(start,.35,t=>Math.sin(2*Math.PI*(50*t+42*.04*(1-Math.exp(-t/.04))))*Math.exp(-t/.075)*Math.min(1,t/.003),amp);
    [79,83,86].forEach((m,i)=>note(m,2.7+i*.065,.8,.045,'bell'));
  }
  for(const [start,type]of soft?[[.09,'move']]:[[.1,'move'],[2.68,'capture']]) {
    const samples=pieceSound(type,'classic',rate);
    add(start,samples.length/rate,t=>samples[Math.min(samples.length-1,Math.floor(t*rate))]||0,soft?.2:.28);
  }
  const dry=data.slice();
  for(const [delay,decay]of [[.071,.12],[.127,.07],[.193,.035]]) {
    const offset=Math.round(delay*rate);for(let i=offset;i<size;i++)data[i]+=dry[i-offset]*decay;
  }
  let peak=0;for(const value of data)peak=Math.max(peak,Math.abs(value));
  const scale=(soft?.42:.72)/Math.max(.001,peak);
  for(let i=0;i<size;i++)data[i]*=scale*Math.min(1,(size-1-i)/(rate*.08));
  return data;
}
