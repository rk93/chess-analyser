import {comparisonGames,mockPublicPlayers} from './comparison-fixtures.mjs';
export function homeCommandGames() {
  const now=Math.floor(Date.now()/1000);
  return comparisonGames('alpha','beta',80,now,'command').map((game,i)=>{
    const out={...game,end_time:now-i*86400};
    if(out.time_class==='rapid'){
      const white=out.white.username==='alpha',side=white?'white':'black',other=white?'black':'white';
      out[side]={...out[side],result:white?(i<50?'timeout':'resigned'):'win'};out[other]={...out[other],result:white?'win':'resigned'};
    }
    return out;
  });
}
export async function seedHomeCommandCentre(page) {
  await mockPublicPlayers(page.context());await page.goto('/');
  await page.evaluate(async games=>{
    localStorage.setItem('chess-username','alpha');localStorage.setItem('chess-sync-meta:alpha',JSON.stringify({lastSync:Date.now(),archives:[]}));
    const db=await new Promise(resolve=>{const r=indexedDB.open('rk93-chess-analyser',1);r.onsuccess=()=>resolve(r.result)});
    await new Promise(resolve=>{const tx=db.transaction('games','readwrite');for(const game of games)tx.objectStore('games').put(game);tx.oncomplete=resolve});db.close();
  },homeCommandGames());
  await page.reload();await page.locator('#homeMetrics strong').first().filter({hasText:'80'}).waitFor();
}
export async function seedHomeEngineReviews(page,{realEngine=false}={}) {
  await page.evaluate(async realEngine=>{
    const {Chess}=await import('https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm');
    const {cacheSet,simpleHash}=await import('/js/analysis-store.js');
    const pgn='1. f3 e5 2. g4 Qh4#',board=new Chess();board.loadPgn(pgn);const moves=board.history({verbose:true});
    let data={localStockfishVersion:21,verifiedReviewVersion:1,labels:['Good','Good','Blunder','Best'],evals:[0,-100,-100,-100000,-100000],bestMoves:['e2e4','e7e5','g2g3','d8h4',''],positionExact:[true,true,true,true,true],moveVerified:[true,true,true,true],localDepths:[12,12,12,12,99]};
    if(realEngine){
      const {getLocalStockfish}=await import('/js/local-stockfish.js'),engine=getLocalStockfish(),results=[];
      for(const move of moves)results.push(await engine.analyse(move.before,{depth:8,multipv:1,clearHash:true}));
      data={...data,evals:[...results.map(result=>result.cp),-100000],bestMoves:[...results.map(result=>result.best),''],localDepths:[...results.map(result=>result.depth),99]};
    }
    const games=Array.from({length:3},(_,i)=>({_key:'engine-command-'+i,url:'engine-command-'+i,pgn,end_time:Math.floor(Date.now()/1000)-i*60,rated:true,rules:'chess',time_class:'rapid',time_control:'600',white:{username:'alpha',rating:1500,result:'checkmated'},black:{username:'engine-source-'+i,rating:1520,result:'win'}}));
    const db=await new Promise(resolve=>{const r=indexedDB.open('rk93-chess-analyser',1);r.onsuccess=()=>resolve(r.result)});
    await new Promise(resolve=>{const tx=db.transaction('games','readwrite');for(const game of games)tx.objectStore('games').put(game);tx.oncomplete=resolve});db.close();
    for(const game of games){const title=`alpha 1500 — ${game.black.username} 1520`;await cacheSet('review',simpleHash(title+'|'+moves.map(move=>move.san).join(' ')),structuredClone(data));}
    window.dispatchEvent(new Event('chessGamesImported'));
  },realEngine);
}
