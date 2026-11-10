import test from 'node:test';
import assert from 'node:assert/strict';

async function fakeEngine(run){
  const original=globalThis.Worker,workers=[];
  class FakeWorker extends EventTarget {
    constructor(){super();this.commands=[];workers.push(this);}
    send(data){this.dispatchEvent(new MessageEvent('message',{data}));}
    postMessage(command){this.commands.push(command);if(command==='uci')queueMicrotask(()=>this.send('uciok'));if(command==='isready')queueMicrotask(()=>this.send('readyok'));}
    terminate(){this.terminated=true;}
  }
  globalThis.Worker=FakeWorker;
  const {getLocalStockfish}=await import('../js/local-stockfish.js');const engine=getLocalStockfish();
  try{await run(engine,workers);}finally{engine.quit();globalThis.Worker=original;}
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const fen='8/8/8/8/8/6k1/8/6K1 w - - 0 1';

test('a cancelled Stockfish search drains its bestmove before the next queued position starts',async()=>{
  await fakeEngine(async(engine,workers)=>{
    const controller=new AbortController(),first=engine.analyse(fen,{depth:8,signal:controller.signal}),rejected=assert.rejects(first,{name:'AbortError'});
    await tick();const worker=workers[0],commands=worker.commands;
    assert.equal(commands.filter(x=>x.startsWith('go ')).length,1);
    controller.abort();assert.equal(commands.at(-1),'stop');
    const second=engine.analyse(fen,{depth:8});await tick();assert.equal(commands.filter(x=>x.startsWith('go ')).length,1);
    worker.send('bestmove g1f1');await rejected;await tick();assert.equal(commands.filter(x=>x.startsWith('go ')).length,2);
    worker.send('info depth 8 score cp 22 pv g1h1');worker.send('bestmove g1h1');
    const result=await second;assert.equal(result.best,'g1h1');assert.equal(result.cp,22);
    const already=new AbortController();already.abort();const count=commands.length;
    await assert.rejects(engine.analyse(fen,{signal:already.signal}),{name:'AbortError'});assert.equal(commands.length,count);
  });
});

test('a worker crash after readiness invalidates that worker before retry',async()=>{
  await fakeEngine(async(engine,workers)=>{
    await engine.ready();workers[0].dispatchEvent(Object.assign(new Event('error'),{message:'Worker crashed'}));
    assert.equal(workers[0].terminated,true);await engine.ready();
    assert.equal(workers.length,2,'retry must initialise a fresh worker rather than reuse resolved readiness');
    assert.equal(engine.worker,workers[1]);
  });
});

for(const event of ['error','messageerror'])test(`an active ${event} rejects promptly and the queued search uses a new worker`,async()=>{
  await fakeEngine(async(engine,workers)=>{
    const first=engine.analyse(fen),rejected=assert.rejects(first,/Worker failed/);await tick();
    const next=engine.analyse(fen);
    workers[0].dispatchEvent(Object.assign(new Event(event),{message:'Worker failed'}));
    await rejected;await tick();assert.equal(workers.length,2);
    workers[0].send('bestmove g1f1');
    workers[1].send('info depth 8 score cp 37 pv g1h1');workers[1].send('bestmove g1h1');
    const result=await next;assert.equal(result.best,'g1h1');assert.equal(result.cp,37);
  });
});

test('a stopped worker that never drains is retired before the queued search starts',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  await fakeEngine(async(engine,workers)=>{
    const controller=new AbortController(),first=engine.analyse(fen,{signal:controller.signal}),rejected=assert.rejects(first,{name:'AbortError'});await tick();
    controller.abort();const next=engine.analyse(fen);await tick();
    t.mock.timers.tick(1999);await tick();assert.equal(workers.length,1);
    t.mock.timers.tick(1);await rejected;await tick();
    assert.equal(workers[0].terminated,true);assert.equal(workers.length,2);
    workers[0].send('bestmove g1f1');workers[1].send('bestmove g1h1');
    assert.equal((await next).best,'g1h1');
    workers[0].dispatchEvent(Object.assign(new Event('error'),{message:'Late retired-worker error'}));
    await engine.ready();assert.equal(workers.length,2);assert.equal(engine.worker,workers[1]);
  });
});

test('a search timeout retires its worker so a late bestmove cannot complete the next position',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  await fakeEngine(async(engine,workers)=>{
    const first=engine.analyse(fen),rejected=assert.rejects(first,/Local Stockfish timed out/);await tick();
    const next=engine.analyse(fen);t.mock.timers.tick(30000);await rejected;await tick();
    assert.equal(workers[0].terminated,true);assert.equal(workers.length,2);
    workers[0].send('bestmove g1f1');workers[1].send('bestmove g1h1');
    assert.equal((await next).best,'g1h1');
    workers[0].dispatchEvent(Object.assign(new Event('error'),{message:'Late retired-worker error'}));
    await engine.ready();assert.equal(workers.length,2);assert.equal(engine.worker,workers[1]);
  });
});
