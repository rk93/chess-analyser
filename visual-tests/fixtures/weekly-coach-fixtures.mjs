import {mockPublicPlayers} from './comparison-fixtures.mjs';
const DAY=86400;
export function weeklyGames(){
  const now=Math.floor(Date.now()/1000),games=[];
  function game(key,{age=1,white=true,result='resigned',pool='rapid',opening='Italian Game',pgn='1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5'}={}){
    const me={username:'alpha',rating:1500,result},other={username:key,rating:1520,result:result==='win'?'resigned':'win'};
    return {_key:key,url:key,end_time:now-age*DAY,rated:true,rules:'chess',time_class:pool,time_control:pool==='blitz'?'180':'600',pgn:`[Opening "${opening}"]\n\n${pgn}`,white:white?me:other,black:white?other:me};
  }
  for(let i=0;i<6;i++)games.push(game('weekly-opening-'+i,{age:1+i*.2,result:i<4?'resigned':'win'}));
  for(let i=0;i<3;i++)games.push(game('weekly-engine-'+i,{age:.1+i*.1,white:false,opening:'King Pawn Game',pgn:'1. f3 e5 2. g4 Nc6'}));
  games.push(game('weekly-unknown',{age:3,result:'unknown',opening:'Unknown opening'}));
  for(let i=0;i<10;i++)games.push(game('weekly-previous-'+i,{age:8+i*.3,result:i<5?'win':i<8?'resigned':'agreed'}));
  for(let i=0;i<4;i++)games.push(game('weekly-blitz-'+i,{age:1+i*.2,pool:'blitz',result:'win',opening:'Scotch Game'}));
  return games;
}
export async function seedWeeklyCoach(page){
  await mockPublicPlayers(page.context());await page.goto('/');
  await page.evaluate(async games=>{
    localStorage.setItem('chess-username','alpha');localStorage.setItem('chess-pip-welcome-v1','seen');localStorage.setItem('chess-sync-meta:alpha',JSON.stringify({lastSync:Date.now(),archives:[]}));
    const db=await new Promise(resolve=>{const request=indexedDB.open('rk93-chess-analyser',1);request.onsuccess=()=>resolve(request.result)});
    await new Promise(resolve=>{const tx=db.transaction('games','readwrite');for(const game of games)tx.objectStore('games').put(game);tx.oncomplete=resolve});db.close();
  },weeklyGames());
  await page.reload();await page.locator('#weeklyCoachActions article').first().waitFor();
}
export async function seedWeeklyReviews(page,{realEngine=false,invalid=false}={}){
  await page.evaluate(async({realEngine,invalid})=>{
    const {Chess}=await import('https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm'),{cacheSet,simpleHash}=await import('/js/analysis-store.js');
    const board=new Chess();board.loadPgn('1. f3 e5 2. g4 Nc6');const moves=board.history({verbose:true}),positions=[moves[0].before,...moves.map(m=>m.after)];
    let bestMoves=positions.map(fen=>{const c=new Chess(fen),m=c.moves({verbose:true})[0];return m.from+m.to+(m.promotion||'')});bestMoves[3]='d8h4';
    let evals=[0,0,0,-100000,0],depths=positions.map(()=>12);
    if(realEngine){const {getLocalStockfish}=await import('/js/local-stockfish.js'),engine=getLocalStockfish(),results=[];for(const fen of positions)results.push(await engine.analyse(fen,{depth:12,multipv:1,clearHash:true}));bestMoves=results.map(r=>r.best);evals=results.map(r=>r.cp);depths=results.map(r=>r.depth);}
    const data={version:7,localStockfishVersion:21,verifiedReviewVersion:1,labels:['Good','Good','Good','Blunder'],evals,bestMoves,positionExact:positions.map(()=>true),moveVerified:moves.map(()=>true),localDepths:depths,reviewDepthKey:'fast',reviewBaseDepth:8,reviewCriticalDepth:12,whiteAccuracy:90,blackAccuracy:50};
    for(let i=0;i<3;i++){
      const copy=structuredClone(data);if(invalid){if(i===0)copy.localDepths[0]=4;if(i===1)copy.positionExact[2]=false;if(i===2)copy.bestMoves[3]='a1a9';}
      await cacheSet('review',simpleHash(`weekly-engine-${i} 1520 — alpha 1500|`+moves.map(m=>m.san).join(' ')),copy);
    }
  },{realEngine,invalid});
}
