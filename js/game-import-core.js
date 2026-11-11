// Public, finished-game imports. Transport and persistence are injected for tests.
export const IMPORT_LIMITS={archives:12,lichessGames:300,studyGames:2000,studyPlayers:12};
export const importPlayer=(raw)=>/^[a-z0-9_-]{1,50}$/i.test(String(raw||'').trim())?String(raw).trim().toLowerCase():'';
export const importKey=game=>game.url||game._key;
export function mergeImportedGames(before,batch,limit=Infinity){
 const games=new Map(before.map(game=>[importKey(game),game]));let added=0;
 for(const game of batch){const key=importKey(game);if(!key)continue;if(!games.has(key))added++;games.set(key,game);}
 return {games:[...games.values()].sort((a,b)=>b.end_time-a.end_time).slice(0,limit),added};
}
export function chessArchives(raw,user){
 if(!Array.isArray(raw))throw new Error('Chess.com returned an invalid archive list.');
 return [...new Set(raw.filter(value=>{try{const u=new URL(value);return u.origin==='https://api.chess.com'&&!u.username&&!u.password&&!u.search&&!u.hash&&new RegExp('^/pub/player/'+user+'/games/\\d{4}/(0[1-9]|1[0-2])$','i').test(u.pathname);}catch{return false;}}))].sort();
}
export function planChessArchives(archives,range,completed=[]){
 const known=new Set(completed),pending=archives.filter(url=>!known.has(url));
 const newestKnown=completed.slice().sort().at(-1);
 const candidates=range==='all'?pending:range==='year'?archives.slice(-12):[...new Set([...archives.slice(-2),...archives.filter(url=>newestKnown&&url>newestKnown)])];
 const targets=candidates.slice().reverse().slice(0,IMPORT_LIMITS.archives);
 return {targets,remaining:range==='all'?Math.max(0,pending.length-targets.length):Math.max(0,candidates.length-targets.length)};
}
export function normalizeChessGame(game,user){
 if(!game||game.rules&&game.rules!=='chess'||typeof game.pgn!=='string'||!game.pgn.trim()||!Number.isFinite(game.end_time)||game.end_time<=0)return null;
 if(![game.white,game.black].every(player=>importPlayer(player?.username)))return null;
 if(![game.white.username,game.black.username].some(name=>name.toLowerCase()===user))return null;
 try{const url=new URL(game.url);if(url.origin!=='https://www.chess.com'&&url.origin!=='https://chess.com')return null;}catch{return null;}
 return {...game,_key:game.url,source:'chesscom'};
}
export function normalizeLichessGame(game,user){
 if(!game||!/^[a-z0-9]{8}$/i.test(game.id)||game.variant!=='standard'||!['mate','resign','stalemate','timeout','draw','outoftime','cheat','noStart','variantEnd'].includes(game.status)||typeof game.pgn!=='string'||!game.pgn.trim())return null;
 const white=game.players?.white,black=game.players?.black,w=importPlayer(white?.user?.name||white?.user?.id),b=importPlayer(black?.user?.name||black?.user?.id);
 if(!w||!b||w!==user&&b!==user||!Number.isFinite(game.lastMoveAt)||game.lastMoveAt<=0)return null;
 const winner=game.winner;if(winner!==undefined&&!['white','black'].includes(winner))return null;
 if(!winner&&!['draw','stalemate','outoftime'].includes(game.status))return null;
 const loss=game.status==='mate'?'checkmated':['outoftime','timeout'].includes(game.status)?'timeout':game.status==='resign'?'resigned':'lose';
 const result=color=>winner?(winner===color?'win':loss):game.status==='stalemate'?'stalemate':game.status==='outoftime'?'timevsinsufficient':'agreed';
 const player=(value,name,color)=>({username:value.user.name||name,rating:Number.isFinite(value.rating)?value.rating:undefined,result:result(color)});
 const time=game.clock?`${game.clock.initial}+${game.clock.increment}`:Number.isFinite(game.daysPerTurn)?`1/${game.daysPerTurn*86400}`:'';
 return {_key:`https://lichess.org/${game.id}`,url:`https://lichess.org/${game.id}`,source:'lichess',rules:'chess',rated:game.rated===true,pgn:game.pgn,
  time_class:game.speed==='correspondence'?'daily':game.speed==='ultraBullet'?'bullet':game.speed,time_control:time,end_time:Math.floor(game.lastMoveAt/1000),created_at:game.createdAt,
  white:player(white,w,'white'),black:player(black,b,'black')};
}
export function createGameImportClient({fetcher=(...args)=>fetch(...args),now=Date.now}={}){
 const cooldown=new Map();let busy=false;
 async function request(url,source,signal,accept,consume){
  signal?.throwIfAborted();if(now()<(cooldown.get(source)||0))throw new Error('Please wait before retrying: '+source+' is rate limiting imports.');
  const timeout=AbortSignal.timeout(source==='lichess'?90000:20000),combined=signal?AbortSignal.any([signal,timeout]):timeout;
  const response=await fetcher(url,{signal:combined,headers:{Accept:accept},credentials:'omit',cache:'no-cache'});
  if(response.status===429){const raw=response.headers.get('retry-after'),seconds=raw&&/^\d+$/.test(raw)?Number(raw):raw?(Date.parse(raw)-now())/1000:60;cooldown.set(source,now()+Math.max(60000,(Number.isFinite(seconds)?seconds:60)*1000));throw new Error('Rate limit reached. Wait at least a minute, then retry. Saved games are unchanged.');}
  if(!response.ok)throw new Error(response.status===404?'That public username was not found. Check the selected site and spelling.':`Import service unavailable (${response.status}). Retry when connected.`);
  const result=await consume(response,combined);combined.throwIfAborted();return result;
 }
 async function run({source,username,range='month',completed=[],until,signal,onBatch=async()=>{},onProgress=()=>{}}){
  if(busy)throw new Error('An import is already running. Wait or cancel it first.');
  const user=importPlayer(username);if(!user)throw new Error('Enter a username using letters, numbers, hyphens or underscores.');
  if(!['chesscom','lichess'].includes(source))throw new Error('Choose Chess.com or Lichess.');
  busy=true;
  try{
   if(source==='chesscom'){
    onProgress('Finding public Chess.com archives…');
    const data=await request(`https://api.chess.com/pub/player/${user}/games/archives`,source,signal,'application/json',r=>r.json());
    const archives=chessArchives(data.archives,user),plan=planChessArchives(archives,range,completed);let received=0;
    for(let i=0;i<plan.targets.length;i++){
     signal?.throwIfAborted();const url=plan.targets[i];onProgress(`Downloading month ${i+1} of ${plan.targets.length} · ${received} games received`);
     const data=await request(url,source,signal,'application/json',r=>r.json());if(!Array.isArray(data.games))throw new Error('Chess.com returned an invalid game archive. Retry this import.');
     const games=data.games.map(game=>normalizeChessGame(game,user)).filter(Boolean);signal?.throwIfAborted();await onBatch(games,{archive:url});received+=games.length;
    }
    return {received,remaining:plan.remaining,empty:archives.length===0};
   }
   const url=new URL(`https://lichess.org/api/games/user/${user}`);
   for(const [key,value] of Object.entries({max:IMPORT_LIMITS.lichessGames,pgnInJson:true,moves:true,tags:true,opening:true,clocks:false,evals:false,ongoing:false,finished:true,sort:'dateDesc',perfType:'ultraBullet,bullet,blitz,rapid,classical,correspondence'}))url.searchParams.set(key,value);
   if(Number.isFinite(until))url.searchParams.set('until',until);
   onProgress('Connecting to Lichess · up to 300 finished games…');
   const result=await request(url.href,source,signal,'application/x-ndjson',async(response,combined)=>{
    if(!response.body)throw new Error('Streaming is unavailable in this browser. Retry in a current browser.');
    const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',bytes=0,count=0,oldest=Infinity;const games=[];
    const readLine=line=>{if(!line.trim())return;const raw=JSON.parse(line);count++;if(Number.isFinite(raw.createdAt))oldest=Math.min(oldest,raw.createdAt);const game=normalizeLichessGame(raw,user);if(game)games.push(game);if(count===1||count%10===0)onProgress(`Received ${count} of up to 300 Lichess games · ${games.length} supported`);};
    try{while(count<IMPORT_LIMITS.lichessGames){combined.throwIfAborted();const {value,done}=await reader.read();if(done){buffer+=decoder.decode();if(buffer.trim())readLine(buffer);break;}bytes+=value.byteLength;if(bytes>12*1024*1024)throw new Error('This export is too large. Try a smaller recent sample.');buffer+=decoder.decode(value,{stream:true});let end;while(count<IMPORT_LIMITS.lichessGames&&(end=buffer.indexOf('\n'))>=0){readLine(buffer.slice(0,end));buffer=buffer.slice(end+1);}if(buffer.length>1024*1024)throw new Error('The game export contains an oversized record.');}}
    finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
    return {games,received:count,remaining:count===IMPORT_LIMITS.lichessGames?1:0,nextUntil:Number.isFinite(oldest)?oldest-1:null};
   });
   signal?.throwIfAborted();await onBatch(result.games,{nextUntil:result.nextUntil,older:!!until,hasOlder:!!result.remaining});return result;
  }catch(error){if(error.name==='TimeoutError')throw new Error('The import timed out. Saved batches are kept; retry to continue.');if(error instanceof SyntaxError)throw new Error('The service returned an unreadable game export. Retry later.');throw error;}
  finally{busy=false;}
 }
 return {run};
}
