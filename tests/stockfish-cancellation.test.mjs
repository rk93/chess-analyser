import test from 'node:test';
import assert from 'node:assert/strict';

test('a cancelled Stockfish search drains its bestmove before the next queued position starts',async()=>{
  const original=globalThis.Worker,commands=[];let worker;
  class FakeWorker extends EventTarget {
    constructor(){super();worker=this;}
    send(data){this.dispatchEvent(new MessageEvent('message',{data}));}
    postMessage(command){commands.push(command);if(command==='uci')queueMicrotask(()=>this.send('uciok'));if(command==='isready')queueMicrotask(()=>this.send('readyok'));}
    terminate(){}
  }
  globalThis.Worker=FakeWorker;
  const {getLocalStockfish}=await import('../js/local-stockfish.js');const engine=getLocalStockfish(),controller=new AbortController();
  const tick=()=>new Promise(resolve=>setImmediate(resolve)),fen='8/8/8/8/8/6k1/8/6K1 w - - 0 1';
  try{
    const first=engine.analyse(fen,{depth:8,signal:controller.signal}),rejected=assert.rejects(first,{name:'AbortError'});
    await tick();assert.equal(commands.filter(x=>x.startsWith('go ')).length,1);
    controller.abort();assert.equal(commands.at(-1),'stop');
    const second=engine.analyse(fen,{depth:8});await tick();assert.equal(commands.filter(x=>x.startsWith('go ')).length,1);
    worker.send('bestmove g1f1');await rejected;await tick();assert.equal(commands.filter(x=>x.startsWith('go ')).length,2);
    worker.send('info depth 8 score cp 22 pv g1h1');worker.send('bestmove g1h1');
    const result=await second;assert.equal(result.best,'g1h1');assert.equal(result.cp,22);
    const already=new AbortController();already.abort();const count=commands.length;
    await assert.rejects(engine.analyse(fen,{signal:already.signal}),{name:'AbortError'});assert.equal(commands.length,count);
  }finally{engine.quit();globalThis.Worker=original;}
});
