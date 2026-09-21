let singleton=null;

function parseInfo(line,state,turn){
  if(!line.startsWith('info '))return;
  const depth=Number(line.match(/\bdepth\s+(\d+)/)?.[1]||0);
  const multipv=Number(line.match(/\bmultipv\s+(\d+)/)?.[1]||1);
  const cpMatch=line.match(/\bscore\s+cp\s+(-?\d+)/);
  const mateMatch=line.match(/\bscore\s+mate\s+(-?\d+)/);
  const pv=line.match(/\bpv\s+(.+)$/)?.[1]?.trim()||'';
  if(!cpMatch&&!mateMatch)return;
  let cp=cpMatch?Number(cpMatch[1]):(Number(mateMatch?.[1])>0?100000:-100000);
  if(turn==='b')cp=-cp;
  const mate=mateMatch?(turn==='b'?-Number(mateMatch[1]):Number(mateMatch[1])):null;
  const prev=state.lines.get(multipv);
  if(!prev||depth>=prev.depth)state.lines.set(multipv,{multipv,depth,cp,mate,pv,best:String(pv).split(/\s+/)[0]||''});
  const top=state.lines.get(1);
  if(top){state.depth=top.depth;state.cp=top.cp;state.mate=top.mate;state.pv=top.pv}
}

class LocalStockfish{
  constructor(){this.worker=null;this.readyPromise=null;this.queue=Promise.resolve();}
  ready(){
    if(this.readyPromise)return this.readyPromise;
    this.readyPromise=new Promise((resolve,reject)=>{
      try{
        const url=new URL('../engine/stockfish-19-lite-single.js',import.meta.url);
        this.worker=new Worker(url);
        const onMessage=e=>{
          const line=String(e.data||'');
          if(line.includes('uciok')){
            this.worker.postMessage('setoption name Hash value 32');
            this.worker.postMessage('isready');
          }else if(line.includes('readyok')){
            this.worker.removeEventListener('message',onMessage);
            resolve(this);
          }
        };
        this.worker.addEventListener('message',onMessage);
        this.worker.addEventListener('error',reject,{once:true});
        this.worker.postMessage('uci');
      }catch(e){reject(e)}
    });
    return this.readyPromise;
  }
  analyse(fen,{depth=15,movetime=0,multipv=1,clearHash=true}={}){
    this.queue=this.queue.then(()=>this._analyse(fen,{depth,movetime,multipv,clearHash}));
    return this.queue;
  }
  async _analyse(fen,{depth,movetime,multipv,clearHash}){
    await this.ready();
    const turn=String(fen).split(/\s+/)[1]||'w';
    return new Promise((resolve,reject)=>{
      const state={depth:0,cp:0,mate:null,pv:'',best:'',lines:new Map()};
      const timer=setTimeout(()=>{
        cleanup();try{this.worker.postMessage('stop')}catch{}
        reject(new Error('Local Stockfish timed out'));
      },30000);
      const cleanup=()=>{clearTimeout(timer);this.worker?.removeEventListener('message',onMessage)};
      const onMessage=e=>{
        const line=String(e.data||'');
        parseInfo(line,state,turn);
        const m=line.match(/^bestmove\s+(\S+)/);
        if(m){
          state.best=m[1]&&m[1]!=='(none)'?m[1]:'';
          const lines=[...state.lines.values()].sort((a,b)=>a.multipv-b.multipv);
          cleanup();
          resolve({...state,lines,source:'Stockfish 19 local'});
        }
      };
      this.worker.addEventListener('message',onMessage);
      this.worker.postMessage('ucinewgame');
      if(clearHash)this.worker.postMessage('setoption name Clear Hash');
      this.worker.postMessage('setoption name MultiPV value '+Math.max(1,Math.min(4,Number(multipv)||1)));
      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage(movetime>0?`go movetime ${movetime}`:`go depth ${depth}`);
    });
  }
  newGame(){try{this.worker?.postMessage('ucinewgame');this.worker?.postMessage('setoption name Clear Hash')}catch{}}
  quit(){try{this.worker?.terminate()}catch{}this.worker=null;this.readyPromise=null;this.queue=Promise.resolve();}
}

export function getLocalStockfish(){if(!singleton)singleton=new LocalStockfish();return singleton}
export async function localStockfishAvailable(){try{await getLocalStockfish().ready();return true}catch{return false}}
