export async function auditFeedback(page,{sound='on',unavailable=false}={}) {
  await page.addInitScript(({sound,unavailable})=>{
    if(!sessionStorage.getItem('feedback-test-seeded')){if(sound!==null)localStorage.setItem('chess-analyser-pref:sound',sound);sessionStorage.setItem('feedback-test-seeded','1');}
    const audit=window.feedbackAudit={contexts:0,starts:[],stops:0,gains:[],vibrations:[],animations:[],errors:[]};window.feedbackAnimations=[];
    addEventListener('unhandledrejection',event=>audit.errors.push(String(event.reason)));
    Object.defineProperty(navigator,'vibrate',{configurable:true,value:pattern=>{if(unavailable)throw Error('Vibration unavailable');if(pattern!==0)audit.vibrations.push(pattern);return true;}});
    const nativeAnimate=Element.prototype.animate;
    Element.prototype.animate=function(frames,options){const result=nativeAnimate.call(this,frames,options);audit.animations.push({square:this.closest('[data-square]')?.dataset.square,frames,options});window.feedbackAnimations.push(result);return result;};
    const Native=window.AudioContext||window.webkitAudioContext;
    if(unavailable){window.AudioContext=undefined;window.webkitAudioContext=undefined;return;}
    if(Native)window.AudioContext=class extends Native{
      constructor(...args){super(...args);audit.contexts++;}
      createBufferSource(){const source=super.createBufferSource(),start=source.start.bind(source),stop=source.stop.bind(source);source.start=(...args)=>{audit.starts.push({duration:source.buffer?.duration,signature:Array.from(source.buffer.getChannelData(0).slice(8,24)).join(',')});return start(...args)};source.stop=(...args)=>{audit.stops++;return stop(...args)};return source;}
      createGain(){const gain=super.createGain(),set=gain.gain.setValueAtTime.bind(gain.gain);gain.gain.setValueAtTime=(value,...args)=>{audit.gains.push(value);return set(value,...args)};return gain;}
    };
  },{sound,unavailable});
  await page.route('https://api.chess.com/**',route=>route.fulfill({status:200,contentType:'application/json',body:'{"archives":[]}'}));
  await page.route('https://explorer.lichess.org/**',route=>route.abort());
}
export async function loadFeedbackPosition(page,fen){
  await page.evaluate(fen=>window.dispatchEvent(new CustomEvent('loadLabFen',{detail:{fen}})),fen);
}
export async function boardMove(page,from,to,board='labBoard'){
  await page.locator(`#${board} [data-square="${from}"]`).click();await page.locator(`#${board} [data-square="${to}"]`).click();
}
export async function seedFeedbackReview(page){
  await page.evaluate(async()=>{
    const {Chess}=await import('https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm'),{cacheSet,simpleHash}=await import('/js/analysis-store.js');
    const pgn='1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5',board=new Chess();board.loadPgn(pgn);const moves=board.history({verbose:true}),last=new Chess(moves.at(-1).after).moves({verbose:true})[0];
    const game={_key:'feedback-review',url:'feedback-review',pgn,end_time:Math.floor(Date.now()/1000),rules:'chess',rated:true,time_class:'rapid',time_control:'600',white:{username:'alpha',rating:1400,result:'win'},black:{username:'beta',rating:1400,result:'resigned'}};
    localStorage.setItem('chess-username','alpha');localStorage.setItem('chess-sync-meta:alpha',JSON.stringify({lastSync:Date.now(),archives:[]}));
    const db=await new Promise(resolve=>{const r=indexedDB.open('rk93-chess-analyser',1);r.onsuccess=()=>resolve(r.result)});await new Promise(resolve=>{const tx=db.transaction('games','readwrite');tx.objectStore('games').put(game);tx.oncomplete=resolve});db.close();
    const key=simpleHash('alpha 1400 — beta 1400|'+moves.map(move=>move.san).join(' '));
    await cacheSet('review',key,{version:7,verifiedReviewVersion:1,localStockfishVersion:21,labels:moves.map(()=> 'Good'),evals:Array(7).fill(0),bestMoves:[...moves,last].map(move=>move.from+move.to+(move.promotion||'')),positionExact:Array(7).fill(true),moveVerified:Array(6).fill(true),localDepths:Array(7).fill(12),losses:Array(6).fill(0),reviewDepthKey:'fast',reviewBaseDepth:8,reviewCriticalDepth:12,whiteAccuracy:99,blackAccuracy:99});
    window.dispatchEvent(new Event('chessGamesImported'));
  });
  await page.reload();
}
