import {createGameImportClient,IMPORT_LIMITS,importPlayer} from './game-import-core.js';
import {readPersonalGames,savePersonalBatch,readStudyCollections,readStudyCollection,saveStudyBatch,deleteStudyCollection} from './game-import-store.js';
const $=id=>document.getElementById(id),client=createGameImportClient();
let active=null,selectedStudy=null,lastPersonalMessage='',lastStudyMessage='';
const owner=()=>importPlayer(localStorage.getItem('chess-username'));
const metaKey=user=>'chess-sync-meta:'+user;
function readMeta(user){try{const value=JSON.parse(localStorage.getItem(metaKey(user))||'null')||{};return {archives:Array.isArray(value.archives)?value.archives.filter(x=>typeof x==='string'):[],lastSync:Number(value.lastSync)||0};}catch{return {archives:[],lastSync:0};}}
function writeMeta(user,data){localStorage.setItem(metaKey(user),JSON.stringify(data));}
function status(kind,text){if(kind==='personal'){lastPersonalMessage=text;if($('status'))$('status').textContent=text;}else lastStudyMessage=text;const node=$(kind==='personal'?'settingsPersonalStatus':'settingsStudyStatus');if(node)node.textContent=text;if(kind==='study'&&selectedStudy){const context=$('importLibraryContext')?.querySelector('p span');if(context)context.textContent=text;}}
function controls(){
 for(const id of ['settingsSyncPersonal','settingsImportStudy','settingsOwnUser','settingsOwnRange','settingsStudySource','settingsStudyUser','settingsStudyRange','sync','manageImport'])if($(id))$(id).disabled=!!active;
 if($('manageImport'))$('manageImport').textContent=active?'Syncing…':'↻ Sync';
 if($('settingsImportCancel'))$('settingsImportCancel').hidden=!active;
 if($('settingsImportBusy')){$('settingsImportBusy').hidden=!active;$('settingsImportBusy').textContent=active?'Import in progress. Keep browsing or cancel here.':'';}
 document.querySelectorAll('[data-study-sync],[data-study-older],[data-study-remove]').forEach(button=>button.disabled=!!active||button.dataset.full==='true');
}
function emitPersonal(user,added=0){window.dispatchEvent(new CustomEvent('chessGamesImported',{detail:{username:user,newCount:added}}));window.dispatchEvent(new CustomEvent('chessImportFinished',{detail:{username:user,newCount:added}}));}
function readableError(error){return error.name==='AbortError'?'Import cancelled. Completed batches are saved. Retry without duplicates.':error.name==='QuotaExceededError'?'Device storage is full. Saved games are kept; free some storage before retrying.':error.message||'Could not import games. Check your connection and retry.';}
export async function syncPersonal({automatic=false,username=owner(),range='month'}={}){
 if(active){if(!automatic)status('personal','Another import is running. Wait or cancel it in Settings.');return false;}
 const user=importPlayer(username);if(!user){if(!automatic)status('personal','Enter your Chess.com username first.');return false;}
 const meta=readMeta(user);if(automatic&&Number(meta.lastSync)>0&&Date.now()>=meta.lastSync&&Date.now()-meta.lastSync<=86400000)return true;
 const controller=new AbortController();active=controller;controls();let added=0,savedAny=false,previous=owner(),completed=[...(meta.archives||[])];
 try{
  // Only an explicit personal-account import can change the dashboard owner.
  if(previous!==user){localStorage.setItem('chess-username',user);if($('user'))$('user').value=user;if($('settingsOwnUser'))$('settingsOwnUser').value=user;emitPersonal(user);}
  const before=await readPersonalGames(),known=new Set(before.map(game=>game.url||game._key));
  const result=await client.run({source:'chesscom',username:user,range,completed,signal:controller.signal,onProgress:text=>status('personal',text),onBatch:async(games,{archive})=>{
   controller.signal.throwIfAborted();await savePersonalBatch(games);savedAny=true;for(const game of games)if(!known.has(game.url)){known.add(game.url);added++;}
   completed=[...new Set([...completed,archive])];writeMeta(user,{...meta,archives:completed,lastSync:0});emitPersonal(user,added);
  }});
  writeMeta(user,{archives:completed,lastSync:Date.now()});
  const total=(await readPersonalGames()).filter(game=>[game.white?.username,game.black?.username].some(name=>name?.toLowerCase()===user)).length;
  status('personal',result.empty?'No public game archives were found for this username.':`${added} new games · ${total} saved for ${user}.${result.remaining?` ${result.remaining} older months remain; select All history and sync again.`:range==='all'?' History batch complete; use Sync latest to refresh recent games.':' Latest available archives checked.'}`);
  emitPersonal(user,added);return true;
 }catch(error){status('personal',readableError(error));if(savedAny)emitPersonal(user,added);return false;}
 finally{active=null;controls();await refreshCollections();}
}
async function importStudy({source=$('settingsStudySource')?.value,user=importPlayer($('settingsStudyUser')?.value),older=$('settingsStudyRange')?.value==='older'}={}){
 if(active)return;user=importPlayer(user);if(!user){status('study','Enter a public username, without @ or a profile URL.');return;}
 const controller=new AbortController();active=controller;controls();
 try{
  const collections=await readStudyCollections(),before=collections.find(item=>item.key===source+':'+user);
  if(!before&&collections.length>=IMPORT_LIMITS.studyPlayers)throw new Error('Up to 12 study players can be saved on this device. Remove a study collection below to make room; your personal games are kept.');
  if(older&&(before?.games.length||0)>=IMPORT_LIMITS.studyGames)throw new Error('This collection has reached the 2,000-game study limit. Sync latest still updates recent games.');
  let added=0;const known=new Set((before?.games||[]).map(game=>game.url));
  const result=await client.run({source,username:user,range:older?'all':'month',completed:before?.archives||[],until:older?before?.nextUntil:undefined,signal:controller.signal,onProgress:text=>status('study',text),onBatch:async(games,meta)=>{
   controller.signal.throwIfAborted();await saveStudyBatch(source,user,games,meta);for(const game of games)if(!known.has(game.url)){known.add(game.url);added++;}
   if(selectedStudy===source+':'+user)await browseStudy(selectedStudy,false);
  }});
  const saved=await readStudyCollection(source+':'+user),count=saved?.games.length||0;
  status('study',`${added} new games · ${count} saved for ${user} on ${source==='lichess'?'Lichess':'Chess.com'}.${!result.received?' No more supported finished games found.':''}${result.remaining?' More history is available; choose Load older games.':''}`);
 }catch(error){status('study',readableError(error));}
 finally{active=null;controls();await refreshCollections();}
}
async function browseStudy(key,navigate=true){try{const data=await readStudyCollection(key);if(!data)return;selectedStudy=key;window.dispatchEvent(new CustomEvent('browseImportedGames',{detail:{...data,navigate}}));}catch(error){status('study',readableError(error));}}
function browsePersonal(){selectedStudy=null;window.dispatchEvent(new CustomEvent('browsePersonalGames'));}
async function refreshCollections(){
 const host=$('settingsStudyCollections');if(!host)return;
 try{
  const collections=await readStudyCollections();host.replaceChildren();
  for(const item of collections.sort((a,b)=>b.updated-a.updated)){
   const row=document.createElement('article');row.className='importCollection';const heading=document.createElement('strong');heading.textContent=item.user+' · '+(item.source==='lichess'?'Lichess':'Chess.com');
   const note=document.createElement('small');note.textContent=`${item.games.length} saved games · last import ${new Date(item.updated).toLocaleString()}`;const actions=document.createElement('div');actions.className='importActions';
   for(const [label,kind,action] of [['Open games','open',()=>browseStudy(item.key)],['Sync latest','sync',()=>importStudy({source:item.source,user:item.user,older:false})],['Load older games','older',()=>importStudy({source:item.source,user:item.user,older:true})]]){
    const button=document.createElement('button');button.type='button';button.className='btn';button.textContent=label;button.dataset['study'+kind[0].toUpperCase()+kind.slice(1)]=item.key;button.addEventListener('click',action);
    if(kind==='older'&&item.games.length>=IMPORT_LIMITS.studyGames){button.disabled=true;button.dataset.full='true';button.title='The 2,000-game study limit has been reached.';}actions.appendChild(button);
   }
   const remove=document.createElement('button');remove.type='button';remove.className='btn';remove.textContent='Remove collection';remove.dataset.studyRemove=item.key;
   remove.addEventListener('click',async()=>{if(active)return;if(remove.dataset.confirm!=='true'){remove.dataset.confirm='true';remove.textContent='Confirm removal';return;}try{await deleteStudyCollection(item.key);if(selectedStudy===item.key)browsePersonal();status('study','Study collection removed. Your personal games are unchanged.');await refreshCollections();}catch(error){status('study',readableError(error));}});actions.appendChild(remove);
   row.append(heading,note,actions);host.appendChild(row);
  }
  if(!collections.length){const p=document.createElement('p');p.className='importHint';p.textContent='No study collections yet. Imported players appear here for offline browsing and syncing.';host.appendChild(p);}controls();
 }catch{host.textContent='Saved study collections are unavailable. Check browser storage permissions and retry.';}
}
function mount(){
 const panel=$('settingsPanel');if(!panel||$('settingsGameImports'))return;
 const section=document.createElement('section');section.id='settingsGameImports';section.className='settingsSection gameImportSettings';
 section.innerHTML=`<header class="importHeader"><span class="importEyebrow">YOUR GAME LIBRARY</span><h2>Bring your chess here.</h2><p>Sync your games. Study a player from Chess.com or Lichess.</p></header>
 <section class="importBlock" aria-labelledby="settingsPersonalTitle"><h3 id="settingsPersonalTitle">Your Chess.com games</h3><p class="importHint">This account powers your personal Home and analytics. Sync latest also works when Home has trouble refreshing.</p><div class="importFields"><label>Your Chess.com username<input id="settingsOwnUser" class="input" maxlength="50" autocomplete="off" autocapitalize="none" spellcheck="false"></label><label>Games to import<select id="settingsOwnRange" class="input"><option value="month">Sync latest</option><option value="year">Last 12 active months</option><option value="all">All history · 12 months per batch</option></select></label></div><div class="importActions"><button id="settingsSyncPersonal" type="button" class="btn primary">Sync my games</button><button id="settingsViewPersonal" type="button" class="btn">Open my games</button></div><p id="settingsPersonalStatus" class="importStatus" role="status"></p></section>
 <section class="importBlock" aria-labelledby="settingsStudyTitle"><h3 id="settingsStudyTitle">Import a public player</h3><p class="importHint">Study anyone, including your own Lichess account. These collections stay separate from your personal Chess.com statistics and ratings.</p><div class="importFields"><label>Chess site<select id="settingsStudySource" class="input"><option value="chesscom">Chess.com</option><option value="lichess">Lichess</option></select></label><label>Public username<input id="settingsStudyUser" class="input" maxlength="50" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="e.g. DrNykterstein"></label><label>Import scope<select id="settingsStudyRange" class="input"><option value="latest">Recent games</option><option value="older">Older history · next batch</option></select></label></div><p id="settingsStudyScope" class="importHint"></p><div class="importActions"><button id="settingsImportStudy" type="button" class="btn primary">Import public games</button></div><p id="settingsStudyStatus" class="importStatus" role="status"></p><div id="settingsStudyCollections"></div></section>
 <div class="importBusy"><p id="settingsImportBusy" role="status" hidden></p><button id="settingsImportCancel" type="button" class="btn" hidden>Cancel import</button></div>
 <details class="importGuidance"><summary>Import tips &amp; limits</summary><ul><li>Only public, finished standard-chess games are imported. No password or Lichess connection is needed. Use these tools for pre-game study and post-game review.</li><li>Imports use the selected site's official public API. Games may appear later than on the original site; a sync cannot bypass its publication delay or rate limits.</li><li>Latest sync rechecks recent games and adds missing games without duplicates. All-history imports are incremental; repeat older-history batches to continue.</li><li>Up to 12 study players and 2,000 recent games per study player are kept on this device. Older games beyond that limit are not retained. Personal saved games are preserved.</li><li>Importing does not run Stockfish. Open a saved game and select Review to analyse it. Previously saved games remain available offline; imports need internet.</li><li>Cancelled or failed imports keep completed batches. Retry to continue. Clearing browser/app site data removes saved games and study collections.</li></ul><a href="https://lichess.org/api#tag/Games/operation/apiGamesUser" target="_blank" rel="noopener">Lichess game-export documentation ↗</a></details>`;
 panel.prepend(section);const link=document.createElement('link');link.rel='stylesheet';link.href='css/game-import.css';document.head.appendChild(link);
 $('settingsOwnUser').value=owner();$('settingsPersonalStatus').textContent=lastPersonalMessage;$('settingsStudyStatus').textContent=lastStudyMessage;
 $('settingsSyncPersonal').addEventListener('click',()=>void syncPersonal({username:$('settingsOwnUser').value,range:$('settingsOwnRange').value}));$('settingsViewPersonal').addEventListener('click',browsePersonal);
 $('settingsImportStudy').addEventListener('click',()=>void importStudy());$('settingsImportCancel').addEventListener('click',()=>active?.abort());
 const scope=()=>$('settingsStudyScope').textContent=$('settingsStudySource').value==='lichess'?'Up to 300 games per batch, streamed from Lichess. Classical and correspondence stay labelled separately.':'Recent games checks the latest two active monthly archives. Older history loads up to 12 additional archives per batch.';
 $('settingsStudySource').addEventListener('change',scope);scope();controls();void refreshCollections();
 window.addEventListener('requestChessSync',()=>{if(selectedStudy){const [source,user]=selectedStudy.split(':');void importStudy({source,user,older:false});}else void syncPersonal();});
 window.addEventListener('appScreenChanged',event=>{if(event.detail.screen==='settings'&&!active)$('settingsOwnUser').value=owner();});
 window.addEventListener('requestOpenSettingsPage',()=>{if(!active)$('settingsOwnUser').value=owner();});window.addEventListener('browsePersonalGames',()=>{selectedStudy=null;});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
