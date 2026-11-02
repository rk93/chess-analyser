export function comparisonGames(user='alpha',opponent='beta',count=40,now=Math.floor(Date.now()/1000),prefix='circle'){
 const pools=['bullet','blitz','rapid','daily'],base=[1100,1250,1500,1700];
 return Array.from({length:count},(_,i)=>{
  const white=Math.floor(i/4)%2===0,pool=i%4,draw=i%7===0,win=i%3!==0;
  const me={username:user,rating:base[pool]+i,result:draw?'agreed':win?'win':'resigned'};
  const other={username:opponent,rating:base[pool]+(i%2?100:-100),result:draw?'agreed':win?'resigned':'win'};
  const pgn=white?'[Opening "Italian Game"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5':'[Opening "Italian Game: Two Knights Defense"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6';
  return {url:`https://www.chess.com/game/live/${prefix}-${i}`,_key:`${prefix}-${i}`,end_time:now-i*3600,rules:'chess',rated:true,time_class:pools[pool],time_control:pool===3?'1/86400':pool===0?'60':pool===1?'180':'600',white:white?me:other,black:white?other:me,pgn};
 });
}
export function comparisonStats(user){
 const pools=['bullet','blitz','rapid','daily'];
 return Object.fromEntries(pools.map((pool,i)=>['chess_'+pool,{last:{rating:(user==='alpha'?1500:1300)+i*100,date:Math.floor(Date.now()/1000)},record:{win:200+i*10,draw:50,loss:user==='alpha'?150:200}}]));
}
export async function seedComparison(page){
 const games=comparisonGames();
 await page.goto('/');
 await page.evaluate(async games=>{
  localStorage.setItem('chess-username','alpha');localStorage.setItem('chess-sync-meta:alpha',JSON.stringify({lastSync:Date.now(),archives:[]}));
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('rk93-chess-analyser',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  await new Promise((resolve,reject)=>{const tx=db.transaction('games','readwrite');for(const game of games)tx.objectStore('games').put(game);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close();
 },games);
 await page.reload();
 await page.locator('#analyticsTab').click();await page.locator('#friendsAnalyticsTab').click();
 await page.locator('[data-discover="beta"]').waitFor({state:'visible'});
}
export async function mockPublicPlayers(page,requests=[]){
 await page.route('https://api.chess.com/**',async route=>{
  const url=new URL(route.request().url());requests.push(url.href);
  const match=url.pathname.match(/^\/pub\/player\/([^/]+)(.*)$/),user=match?.[1],path=match?.[2];
  if(!user)return route.fulfill({status:404,body:'{}'});
  let body;
  if(!path)body={username:user,avatar:`https://images.chesscomfiles.com/${user}.svg`};
  else if(path==='/stats')body=comparisonStats(user);
  else if(path==='/games/archives'){
   const now=new Date();body={archives:[3,2,1,0].map(offset=>{const d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-offset,1));return`https://api.chess.com/pub/player/${user}/games/${d.getUTCFullYear()}/${String(d.getUTCMonth()+1).padStart(2,'0')}`})};
  }else if(/^\/games\/\d{4}\/\d{2}$/.test(path)){
   const parts=path.split('/'),year=Number(parts[2]),month=Number(parts[3])-1,d=new Date();
   const stamp=month===d.getUTCMonth()&&year===d.getUTCFullYear()?Math.floor(Date.now()/1000)-60:Date.UTC(year,month,15,12)/1000;
   body={games:comparisonGames('alpha','beta',8,stamp,'public-'+parts.slice(2).join('-'))};
  }else return route.fulfill({status:404,body:'{}'});
  await route.fulfill({status:200,contentType:'application/json',headers:{'Cache-Control':'public,max-age=86400'},body:JSON.stringify(body)});
 });
 await page.route('https://images.chesscomfiles.com/**',route=>route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><rect width="60" height="60" fill="#547344"/></svg>'}));
}
