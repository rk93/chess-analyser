let singleton=null;

function parseInfo(line,state,turn){
  if(!line.startsWith('info '))return;
  const depth=Number(line.match(/\bdepth\s+(\d+)/)?.[1]||0);
  const cpMatch=line.match(/\bscore\s+cp\s+(-?\d+)/);
  const mateMatch=line.match(/\bscore\s+mate\s+(-?\d+)/);
  const pv=line.match(/\bpv\s+(.+)$/)?.[1]?.trim()||'';
  if(!cpMatch&&!mateMatch)return;
  let cp=cpMatch?Number(cpMatch[1]):(Number(mateMatch?.[1])>0?100000:-100000);
  if(turn==='b')cp=-cp;
  if(depth>=state.depth){state.depth=depth;state.cp=cp;state.mate=mateMatch?Number(mateMatch[1]):null;state.pv=pv;}
}

class LocalStockfish{
  constructor(){this.worker=null;this.readyPromise=null;this.queue=Promise.resolve();}
  ready(){
    if(this.readyPromise)return this.readyPromise;
    this.readyPromise=new Promise((resolve,reject)=>{
      try{
        const url=new URL('../engine/stockfish-19-lite-single.js',import.meta.url);
        this.worker=new Worker(url);
        const onMessage=e=>{const line=String(e.data||'');if(line.includes('uciok')){this.worker.postMessage('isready');}else if(line.includes('readyok')){this.worker.removeEventListener('message',onMessage);resolve(this);}};
        this.worker.addEventListener('message',onMessage);
        this.worker.addEventListener('error',reject,{once:true});
        this.worker.postMessage('uci');
      }catch(e){reject(e)}
    });
    return this.readyPromise;
  }
  analyse(fen,{depth=15,movetime=0}={}){
    this.queue=this.queue.then(()=>this._analyse(fen,{depth,movetime}));
    return this.queue;
  }
  async _analyse(fen,{depth,movetime}){
    await this.ready();
    const turn=String(fen).split(/\s+/)[1]||'w';
    return new Promise((resolve,reject)=>{
      const state={depth:0,cp:0,mate:null,pv:'',best:''};
      let timer=setTimeout(()=>{cleanup();try{this.worker.postMessage('stop')}catch{};reject(new Error('Local Stockfish timed out'));},15000);
      const cleanup=()=>{clearTimeout(timer);this.worker?.removeEventListener('message',onMessage)};
      const onMessage=e=>{
        const line=String(e.data||'');parseInfo(line,state,turn);
        const m=line.match(/^bestmove\s+(\S+)/);
        if(m){state.best=m[1]&&m[1]!=='(none)'?m[1]:'';cleanup();resolve({...state,source:'Stockfish 19 local'});}
      };
      this.worker.addEventListener('message',onMessage);
      this.worker.postMessage('ucinewgame');
      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage(movetime>0?`go movetime ${movetime}`:`go depth ${depth}`);
    });
  }
  quit(){try{this.worker?.terminate()}catch{}this.worker=null;this.readyPromise=null;}
}

export function getLocalStockfish(){if(!singleton)singleton=new LocalStockfish();return singleton}
export async function localStockfishAvailable(){try{await getLocalStockfish().ready();return true}catch{return false}}
