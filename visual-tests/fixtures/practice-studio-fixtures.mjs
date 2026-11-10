import {openHomeTopic} from './home-sections.mjs';
import {seedHomeCommandCentre} from './home-command-fixtures.mjs';
export async function seedPracticeStudio(page,{rich=true,legacy=true}={}){
  await seedHomeCommandCentre(page);
  await page.evaluate(async({rich,legacy})=>{
    const {Chess}=await import('https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm'),board=new Chess();board.loadPgn('1. e4 e5 2. Nf3 Nc6 3. Bb5 a6');
    const moves=board.history({verbose:true}),now=Date.now(),day=86400000,events=[];
    const position=i=>moves[i].before+'|'+moves[i].from+moves[i].to;
    events.push({id:'tracking:start',position:position(0),at:now-80*day,correct:false,revealed:false,pool:'rapid',theme:'alternative'});
    for(let i=0;i<5;i++){
      events.push({id:'before:'+i,position:position(i),at:now-9*day,correct:i<2,revealed:false,pool:'rapid',theme:'alternative'});
      events.push({id:'after:'+i,position:position(i),at:now-2*day,correct:i>0,revealed:i===4,pool:'rapid',theme:'alternative'});
    }
    events.push({id:'retry:0',position:position(0),at:now-day,correct:true,revealed:false,pool:'rapid',theme:'alternative'});
    events.push({id:'today:1',position:position(5),at:now-1000,correct:false,revealed:false,pool:'blitz',theme:'alternative'});
    if(rich)localStorage.setItem('chess-practice-history:alpha',JSON.stringify({version:1,startedAt:now-80*day,retainedFrom:now-80*day,events}));
    if(legacy){
      const {recordTrainingAttempt}=await import('/js/personal-training-core.js');
      const progress={olderA:{attempts:3,correct:1,assisted:0,solvedAt:now-100*day},olderB:{attempts:2,correct:1,assisted:1,solvedAt:now-95*day}};
      if(rich)for(const event of events.toSorted((a,b)=>a.at-b.at))progress[event.position]=recordTrainingAttempt(progress[event.position],event,event.at);
      localStorage.setItem('chess-personal-training:alpha',JSON.stringify(progress));
    }
  },{rich,legacy});
  await page.reload();await page.locator('#homeMetrics strong').first().filter({hasText:'80'}).waitFor({state:'attached'});await openHomeTopic(page,'training');
}

export async function seedComparableReviews(page){
  await page.evaluate(async()=>{
    const {Chess}=await import('https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm'),{cacheSet,simpleHash}=await import('/js/analysis-store.js');
    const games=[];
    for(let i=0;i<10;i++){
      const poor=i===0||i>=6,board=new Chess();board.loadPgn(poor?'1. f3 e5 2. g4 Qh4#':'1. e4 e5 2. Nf3 Nc6');
      const moves=board.history({verbose:true}),last=new Chess(moves.at(-1).after),lastMove=last.moves({verbose:true})[0];
      const data={version:7,localStockfishVersion:21,verifiedReviewVersion:1,labels:moves.map((_,j)=>poor&&j===2?'Blunder':'Good'),evals:poor?[0,-100,-100,-100000,-100000]:[0,0,0,0,0],bestMoves:poor?['e2e4','e7e5','g2g3','d8h4','']:[...moves,lastMove].map(move=>move.from+move.to+(move.promotion||'')),positionExact:[true,true,true,true,true],moveVerified:[true,true,true,true],localDepths:[12,12,12,12,12]};
      const game={_key:'practice-trend-'+i,url:'practice-trend-'+i,pgn:board.pgn(),end_time:Math.floor(Date.now()/1000)-(i<5?i+1:35+i)*86400,rules:'chess',rated:true,time_class:'rapid',time_control:'600',white:{username:'alpha',rating:1500,result:poor?'checkmated':'win'},black:{username:'trend-source-'+i,rating:1520,result:poor?'win':'resigned'}};
      games.push(game);await cacheSet('review',simpleHash(`alpha 1500 — ${game.black.username} 1520|${moves.map(move=>move.san).join(' ')}`),data);
    }
    const db=await new Promise(resolve=>{const r=indexedDB.open('rk93-chess-analyser',1);r.onsuccess=()=>resolve(r.result)});
    await new Promise(resolve=>{const tx=db.transaction('games','readwrite');games.forEach(game=>tx.objectStore('games').put(game));tx.oncomplete=resolve});db.close();window.dispatchEvent(new Event('chessGamesImported'));
  });
}
