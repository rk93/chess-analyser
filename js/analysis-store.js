const DB='chess-analyser-cache',VERSION=1,STORE='cache';
const memory=new Map();
const authoritativeReview=value=>Number.isSafeInteger(value?.localStockfishVersion)&&value.localStockfishVersion>=20&&value.verifiedReviewVersion===1;

function open(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,VERSION);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'key'})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function fullKey(ns,key){return `${ns}|${key}`}
export async function cacheGet(ns,key){const k=fullKey(ns,key);if(memory.has(k))return memory.get(k);try{const db=await open(),value=await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get(k);r.onsuccess=()=>resolve(r.result?.value??null);r.onerror=()=>reject(r.error)});db.close();if(memory.has(k))return memory.get(k);if(value!=null)memory.set(k,value);return value}catch{return memory.has(k)?memory.get(k):null}}
export async function cacheSet(ns,key,value){
  const k=fullKey(ns,key);
  if(ns==='review'&&value!=null){
    const stored=memory.has(k)?memory.get(k):await cacheGet(ns,key),current=memory.has(k)?memory.get(k):stored;
    // Legacy preview/refinement callbacks must not replace verified Stockfish
    // data. A new native review at the same version (including a new depth)
    // remains writable, and an explicit null still clears the cache.
    if(authoritativeReview(current)&&(!authoritativeReview(value)||value.localStockfishVersion<current.localStockfishVersion))return current;
  }
  memory.set(k,value);
  try{
    const db=await open();
    // A newer write may have won while this IndexedDB connection was opening.
    if(memory.get(k)!==value){db.close();return memory.get(k)}
    await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put({key:k,value,updated:Date.now()});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close();
  }catch{}
  return value;
}
export function cacheMemoryGet(ns,key){return memory.get(fullKey(ns,key))??null}
export function cacheMemorySet(ns,key,value){memory.set(fullKey(ns,key),value);return value}
export async function getPositionEval(provider,fen){return cacheGet('position',`${provider}|${fen}`)}
export async function setPositionEval(provider,fen,value){return cacheSet('position',`${provider}|${fen}`,value)}
export function simpleHash(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}
