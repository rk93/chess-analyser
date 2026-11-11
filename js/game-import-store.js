import {IMPORT_LIMITS,importKey,mergeImportedGames} from './game-import-core.js';
function open(name,store){return new Promise((resolve,reject)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>{const s=r.result.createObjectStore(store,{keyPath:store==='games'?'_key':'key'});if(store==='games')s.createIndex('end_time','end_time');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function transaction(name,store,mode,operation){const db=await open(name,store);try{return await new Promise((resolve,reject)=>{const tx=db.transaction(store,mode);let result;try{result=operation(tx.objectStore(store));}catch(error){tx.abort();reject(error);return;}tx.oncomplete=()=>resolve(result?.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Saving games was interrupted.'));});}finally{db.close();}}
const PERSONAL='rk93-chess-analyser',STUDY='chess-analyser-study-games';
export const readPersonalGames=()=>transaction(PERSONAL,'games','readonly',s=>s.getAll());
export const readStudyCollections=()=>transaction(STUDY,'collections','readonly',s=>s.getAll());
export const readStudyCollection=key=>transaction(STUDY,'collections','readonly',s=>s.get(key));
export const deleteStudyCollection=key=>transaction(STUDY,'collections','readwrite',s=>s.delete(key));
export async function savePersonalBatch(games){await transaction(PERSONAL,'games','readwrite',store=>{for(const game of games)store.put({...game,_key:importKey(game)});});}
export async function saveStudyBatch(source,user,games,meta={}){
 const key=source+':'+user;
 return transaction(STUDY,'collections','readwrite',store=>{const request=store.get(key);request.onsuccess=()=>{
  const before=request.result||{key,source,user,games:[],archives:[]};const merged=mergeImportedGames(before.games,games,IMPORT_LIMITS.studyGames);
  const archives=meta.archive?[...new Set([...before.archives,meta.archive])]:before.archives;
  // A full new latest page may leave a gap before older saved games. Restart
  // the older-page cursor there so that gap can be filled explicitly.
  const nextUntil=meta.older?meta.nextUntil:meta.hasOlder&&merged.added?meta.nextUntil:before.nextUntil??meta.nextUntil;
  store.put({...before,...merged,archives,nextUntil,hasOlder:meta.older||before.nextUntil===undefined?meta.hasOlder:before.hasOlder,updated:Date.now()});
 };});
}
