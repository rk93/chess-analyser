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
  discardWorker(worker){
    if(!worker)return;
    try{worker.terminate()}catch{}
    // An obsolete request must never invalidate a newer worker.
    if(this.worker===worker){this.worker=null;this.readyPromise=null}
  }
  ready(){
    if(this.readyPromise)return this.readyPromise;
    const start=new Promise((resolve,reject)=>{
      let worker=null,timer=null,settled=false;
      const cleanup=()=>{
        clearTimeout(timer);
        worker?.removeEventListener('message',onMessage);
        worker?.removeEventListener('error',fail);
      };
      const fail=e=>{
        if(settled)return;
        settled=true;
        cleanup();
        this.discardWorker(worker);
        reject(e instanceof Error?e:new Error(String(e?.message||e||'Local Stockfish failed to start')));
      };
      const onMessage=e=>{
        const line=String(e.data||'');
        try{
          if(line.includes('uciok')){
            worker.postMessage('setoption name Hash value 32');
            worker.postMessage('isready');
          }else if(line.includes('readyok')){
            if(settled)return;
            settled=true;
            cleanup();
            worker.addEventListener('error',()=>this.discardWorker(worker));
            resolve(this);
          }
        }catch(err){fail(err)}
      };
      try{
        const url=new URL('../engine/stockfish-19-lite-single.js',import.meta.url);
        worker=new Worker(url);
        this.worker=worker;
        worker.addEventListener('message',onMessage);
        worker.addEventListener('error',fail);
        timer=setTimeout(()=>fail(new Error('Local Stockfish startup timed out')),10000);
        worker.postMessage('uci');
      }catch(e){fail(e)}
    });
    const ready=start.catch(e=>{
      if(this.readyPromise===ready)this.readyPromise=null;
      throw e;
    });
    this.readyPromise=ready;
    return ready;
  }
  analyse(fen,{depth=15,movetime=0,multipv=1,clearHash=true}={}){
    const run=this.queue.catch(()=>{}).then(()=>this._analyse(fen,{depth,movetime,multipv,clearHash}));
    this.queue=run.catch(()=>{});
    return run;
  }
  async _analyse(fen,{depth,movetime,multipv,clearHash}){
    await this.ready();
    const worker=this.worker;
    if(!worker)throw new Error('Local Stockfish worker unavailable');
    const turn=String(fen).split(/\s+/)[1]||'w';
    return new Promise((resolve,reject)=>{
      const state={depth:0,cp:0,mate:null,pv:'',best:'',lines:new Map()};
      let timer=null,settled=false;
      const cleanup=()=>{
        clearTimeout(timer);
        worker.removeEventListener('message',onMessage);
        worker.removeEventListener('error',onError);
      };
      const fail=err=>{
        if(settled)return;
        settled=true;
        cleanup();
        // Do not reuse a worker that may still emit an earlier bestmove.
        this.discardWorker(worker);
        reject(err instanceof Error?err:new Error(String(err?.message||err||'Local Stockfish failed')));
      };
      const onError=e=>fail(new Error(String(e?.message||'Local Stockfish worker error')));
      const onMessage=e=>{
        if(settled)return;
        const line=String(e.data||'');
        parseInfo(line,state,turn);
        const m=line.match(/^bestmove\\s+(\\S+)/);
        if(m){
          state.best=m[1]&&m[1]!=='(none)'?m[1]:'';
          const lines=[...state.lines.values()].sort((a,b)=>a.multipv-b.multipv);
          settled=true;
          cleanup();
          resolve({...state,lines,source:'Stockfish 19 local'});
        }
      };
      worker.addEventListener('message',onMessage);
      worker.addEventListener('error',onError);
      timer=setTimeout(()=>fail(new Error('Local Stockfish timed out')),30000);
      try{
        worker.postMessage('ucinewgame');
        if(clearHash)worker.postMessage('setoption name Clear Hash');
        worker.postMessage('setoption name MultiPV value '+Math.max(1,Math.min(4,Number(multipv)||1)));
        worker.postMessage(`position fen ${fen}`);
        worker.postMessage(movetime>0?`go movetime ${movetime}`:`go depth ${depth}`);
      }catch(err){fail(err)}
    });
  }
  newGame(){try{this.worker?.postMessage('ucinewgame');this.worker?.postMessage('setoption name Clear Hash')}catch{}}
  quit(){this.discardWorker(this.worker);this.queue=Promise.resolve();}
}
export function getLocalStockfish(){if(!singleton)singleton=new LocalStockfish();return singleton}
export async function localStockfishAvailable(){try{await getLocalStockfish().ready();return true}catch{return false}}
