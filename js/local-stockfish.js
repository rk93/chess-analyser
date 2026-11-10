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
  discard(worker){
    if(this.worker!==worker)return;
    try{worker?.terminate()}catch{}
    this.worker=null;this.readyPromise=null;
  }
  ready(){
    if(this.readyPromise)return this.readyPromise;
    const start=new Promise((resolve,reject)=>{
      let timer=null,worker=null;
      const fail=e=>{
        clearTimeout(timer);
        this.discard(worker);
        reject(e instanceof Error?e:new Error(String(e?.message||e||'Local Stockfish failed to start')));
      };
      try{
        const url=new URL('../engine/stockfish-19-lite-single.js',import.meta.url);
        worker=this.worker=new Worker(url);
        const onMessage=e=>{
          const line=String(e.data||'');
          if(line.includes('uciok')){
            worker.postMessage('setoption name Hash value 32');
            worker.postMessage('isready');
          }else if(line.includes('readyok')){
            clearTimeout(timer);
            worker.removeEventListener('message',onMessage);
            resolve(this);
          }
        };
        worker.addEventListener('message',onMessage);
        // Keep failure handling after readyok: a crashed worker is not ready.
        worker.addEventListener('error',fail,{once:true});
        worker.addEventListener('messageerror',fail,{once:true});
        timer=setTimeout(()=>fail(new Error('Local Stockfish startup timed out')),10000);
        worker.postMessage('uci');
      }catch(e){fail(e)}
    });
    const pending=start.catch(e=>{
      if(this.readyPromise===pending)this.readyPromise=null;
      throw e;
    });
    this.readyPromise=pending;
    return this.readyPromise;
  }
  analyse(fen,{depth=15,movetime=0,multipv=1,clearHash=true,signal}={}){
    const run=this.queue.catch(()=>{}).then(()=>this._analyse(fen,{depth,movetime,multipv,clearHash,signal}));
    this.queue=run.catch(()=>{});
    return run;
  }
  async _analyse(fen,{depth,movetime,multipv,clearHash,signal}){
    signal?.throwIfAborted();
    await this.ready();
    signal?.throwIfAborted();
    const worker=this.worker;
    const turn=String(fen).split(/\s+/)[1]||'w';
    return new Promise((resolve,reject)=>{
      const state={depth:0,cp:0,mate:null,pv:'',best:'',lines:new Map()};
      let abortTimer=null,settled=false;
      const fail=error=>{this.discard(worker);finish(error instanceof Error?error:new Error(String(error?.message||'Local Stockfish worker failed')))};
      const timer=setTimeout(()=>fail(new Error('Local Stockfish timed out')),30000);
      const onAbort=()=>{
        // Normally stop drains bestmove immediately. If the worker is stuck,
        // retire it before the next queued position can receive a stale result.
        abortTimer=setTimeout(()=>fail(signal.reason),2000);
        try{worker.postMessage('stop')}catch(e){fail(e)}
      };
      const cleanup=()=>{clearTimeout(timer);clearTimeout(abortTimer);worker.removeEventListener('message',onMessage);worker.removeEventListener('error',fail);worker.removeEventListener('messageerror',fail);signal?.removeEventListener('abort',onAbort)};
      const finish=(error,result)=>{
        if(settled)return;settled=true;cleanup();
        if(signal?.aborted)reject(signal.reason||new DOMException('Analysis stopped','AbortError'));
        else if(error)reject(error);else resolve(result);
      };
      const onMessage=e=>{
        const line=String(e.data||'');
        parseInfo(line,state,turn);
        const m=line.match(/^bestmove\s+(\S+)/);
        if(m){
          state.best=m[1]&&m[1]!=='(none)'?m[1]:'';
          const lines=[...state.lines.values()].sort((a,b)=>a.multipv-b.multipv);
          finish(null,{...state,lines,source:'Stockfish 19 local'});
        }
      };
      worker.addEventListener('message',onMessage);
      worker.addEventListener('error',fail);
      worker.addEventListener('messageerror',fail);
      // Drain bestmove after stop before advancing the shared engine queue.
      signal?.addEventListener('abort',onAbort,{once:true});
      try{
        worker.postMessage('ucinewgame');
        if(clearHash)worker.postMessage('setoption name Clear Hash');
        worker.postMessage('setoption name MultiPV value '+Math.max(1,Math.min(4,Number(multipv)||1)));
        worker.postMessage(`position fen ${fen}`);
        worker.postMessage(movetime>0?`go movetime ${movetime}`:`go depth ${depth}`);
      }catch(e){fail(e)}
    });
  }
  newGame(){try{this.worker?.postMessage('ucinewgame');this.worker?.postMessage('setoption name Clear Hash')}catch{}}
  quit(){try{this.worker?.terminate()}catch{}this.worker=null;this.readyPromise=null;this.queue=Promise.resolve();}
}

export function getLocalStockfish(){if(!singleton)singleton=new LocalStockfish();return singleton}
export async function localStockfishAvailable(){try{await getLocalStockfish().ready();return true}catch{return false}}
