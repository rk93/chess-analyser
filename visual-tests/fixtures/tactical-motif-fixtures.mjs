import {mockPublicPlayers} from './comparison-fixtures.mjs';
export const FORK_FEN='2q1k3/8/8/8/2N5/8/8/4K3 w - - 0 1';
export const PIN_FEN='4k3/4n3/8/8/8/8/6K1/3R4 w - - 0 1';

export async function seedTacticalMotifs(page,{realEngine=false,invalidFork=false,partial=false,nonImproving=false}={}){
  await mockPublicPlayers(page.context());await page.goto('/');
  const audit=await page.evaluate(async options=>{
    const {Chess}=await import('https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm');
    const {cacheSet,simpleHash}=await import('/js/analysis-store.js');
    const fork=new Chess(options.fork);fork.move('Kf1');
    const pin=new Chess(options.pin);pin.move('Rd2');
    let forkData={localStockfishVersion:21,verifiedReviewVersion:1,labels:['Blunder'],evals:[0,-400],bestMoves:['c4d6'],positionExact:[true,true],moveVerified:[true],localDepths:[12,12]};
    if(options.realEngine){
      const {getLocalStockfish}=await import('/js/local-stockfish.js'),engine=getLocalStockfish();
      const before=await engine.analyse(options.fork,{depth:12,multipv:1,clearHash:true});
      const after=await engine.analyse(fork.fen(),{depth:12,multipv:1,clearHash:true});
      forkData={...forkData,evals:[before.cp,after.cp],bestMoves:[before.best],localDepths:[before.depth,after.depth]};
    }
    const games=[];
    for(let i=0;i<7;i++){
      const isFork=i<3,board=isFork||i===6?fork:pin;
      const game={_key:'motif-game-'+i,url:'motif-game-'+i,pgn:board.pgn(),end_time:Math.floor(Date.now()/1000)-i*60,rules:'chess',time_class:'rapid',time_control:'600',rated:true,white:{username:'alpha',rating:1500,result:'resigned'},black:{username:'motif-source-'+i,rating:1520,result:'win'}};
      games.push(game);
      const data=isFork?structuredClone(forkData):{...structuredClone(forkData),evals:[0,-400],bestMoves:[i===6?'c4d6':'d1e1'],labels:[i===6?'Good':'Blunder']};
      if(options.invalidFork&&i===0)data.localDepths[0]=4;
      if(options.partial&&isFork)data.localStockfishVersion=undefined;
      if(options.nonImproving&&isFork)data.evals=[0,200];
      const key=simpleHash(`alpha 1500 — ${game.black.username} 1520|${board.history().join(' ')}`);
      await cacheSet('review',key,data);
    }
    localStorage.setItem('chess-username','alpha');localStorage.setItem('chess-sync-meta:alpha',JSON.stringify({lastSync:Date.now(),archives:[]}));
    const db=await new Promise(resolve=>{const r=indexedDB.open('rk93-chess-analyser',1);r.onsuccess=()=>resolve(r.result)});
    await new Promise(resolve=>{const tx=db.transaction('games','readwrite');for(const game of games)tx.objectStore('games').put(game);tx.oncomplete=resolve});db.close();
    return forkData;
  },{fork:FORK_FEN,pin:PIN_FEN,realEngine,invalidFork,partial,nonImproving});
  await page.reload();await page.locator('#homeMetrics strong').first().filter({hasText:'7'}).waitFor({state:'attached'});return audit;
}
