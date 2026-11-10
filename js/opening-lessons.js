import {compileOpening,filterOpeningEntries,OpeningLesson} from './opening-lesson-core.js';

export function mountOpeningLessons(view,api){
 const root=document.createElement('details');root.id='labOpeningLessons';root.className='openingLessons';
 root.innerHTML=`<summary>Opening &amp; gambit practice <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary><p class="openingIntro">Play a named line as either colour, or watch every move on the board.</p><div class="openingSetup"><label>Your colour<select id="labOpeningSide"><option value="white">White</option><option value="black">Black</option></select></label><label>Find a line<input id="labOpeningSearch" type="search" maxlength="120" placeholder="Italian, Sicilian, King's Gambit…" autocomplete="off"></label></div><div class="openingSelectors"><label>Opening<select id="labOpeningSelect" disabled><option value="">Loading openings…</option></select></label><label>Gambit<select id="labGambitSelect" disabled><option value="">Loading gambits…</option></select></label></div><p id="labOpeningMatches" class="openingNote"></p><div id="labOpeningPreview" class="openingPreview" hidden><strong></strong><small></small><details class="openingMoves"><summary>Moves in this line</summary><p></p></details></div><div class="openingActions"><button type="button" class="btn primary" id="labOpeningPractise" disabled>Practise line</button><button type="button" class="btn" id="labOpeningWatch" disabled>Watch full line</button><button type="button" class="btn" id="labOpeningRetry" hidden>Retry catalogue</button></div><p id="labOpeningStatus" role="status" class="openingNote">Open the selector to load the local ECO catalogue.</p><details class="openingAbout"><summary>How practice works &amp; data source</summary><p class="openingNote">One recorded path per selection. In practice, the opponent follows that whole path, then Stockfish plays freely. Gambits include accepted and declined lines. Pre-game study only.</p><a class="openingAttribution" href="data/openings/README.md" target="_blank" rel="noopener">Opening names &amp; lines: lichess-org/chess-openings · CC0</a></details>`;
 view.querySelector('.labResult').before(root);
 const dock=document.createElement('section');dock.id='labOpeningDock';dock.className='openingDock';dock.hidden=true;
 dock.innerHTML='<div class="openingDockTitle"><strong id="labOpeningName"></strong><small id="labOpeningProgress" role="status"></small></div><div class="openingDockActions"><button id="labOpeningHint" class="btn" type="button">Hint</button><button id="labOpeningPause" class="btn" type="button">Pause</button><button id="labOpeningRestart" class="btn" type="button">Restart</button><button id="labOpeningExit" class="btn" type="button">Exit</button><button id="labOpeningContinue" class="btn primary" type="button" hidden>Play on</button></div>';
 view.querySelector('.labBoardColumn').prepend(dock);
 const $=id=>view.querySelector('#'+id);
 let entries=null,choice=null,session=null,paused=false,timer=null,search=null,load=null,loadController=null,generation=0,hint=false;
 function message(text){$('labOpeningStatus').textContent=text;}
 function cancelWork(){generation++;clearTimeout(timer);timer=null;search?.abort();search=null;}
 function render(){
  dock.hidden=!session;if(!session)return;
  $('labOpeningName').textContent=session.line.entry.name;
  $('labOpeningProgress').textContent=session.phase==='book'?`${session.index} / ${session.line.moves.length} plies · ${paused?'Paused':session.mode==='watch'?'Watching the recorded line':api.turn()===session.side?'Your move':'Book opponent'}`:`${session.line.moves.length} / ${session.line.moves.length} plies · ${session.phase==='complete'?'Recorded line complete':api.isGameOver()?'Game finished':paused?'Paused':'Stockfish free play'}`;
  $('labOpeningPause').textContent=paused?'Resume':'Pause';$('labOpeningPause').disabled=session.phase==='complete'||api.isGameOver();
  $('labOpeningHint').hidden=session.mode==='watch'||session.phase!=='book';$('labOpeningContinue').hidden=session.phase!=='complete'||api.isGameOver();
  if(hint&&session.next?.before===api.fen())api.hint(session.next.uci);
 }
 function stop(text='Line stopped. The board is ready for free analysis.'){
  cancelWork();session=null;paused=false;if(hint)api.hint(null);hint=false;dock.hidden=true;message(text);
 }
 function preview(entry){
  stop('');choice=null;$('labOpeningPreview').hidden=true;
  for(const id of ['labOpeningPractise','labOpeningWatch'])$(id).disabled=true;
  if(!entry){message('Select an opening or a gambit to begin.');return;}
  try{choice=compileOpening(entry,api.Chess);const p=$('labOpeningPreview');p.hidden=false;p.querySelector('strong').textContent=entry.eco+' · '+entry.name;p.querySelector('p').textContent=entry.pgn;p.querySelector('small').textContent=`${choice.moves.length} plies · ${Math.ceil(choice.moves.length/2)} numbered moves in this path`;for(const id of ['labOpeningPractise','labOpeningWatch'])$(id).disabled=false;message('Choose your colour, then practise or watch. Your current board changes only when you start.');}
  catch{message('This line could not be read. Choose another one.');}
 }
 function populate(){
  const counts=[];
  for(const [id,gambit] of [['labOpeningSelect',false],['labGambitSelect',true]]){
   const matches=filterOpeningEntries(entries,$('labOpeningSearch').value,gambit),select=$(id);select.replaceChildren(new Option(gambit?'Choose a gambit…':'Choose an opening…',''));
   // Search covers every path. Bound DOM work for the native mobile picker.
   for(const entry of matches.slice(0,100))select.add(new Option(entry.eco+' · '+entry.name,entry.id));
   select.disabled=false;counts.push(`${Math.min(100,matches.length).toLocaleString()} / ${matches.length.toLocaleString()} ${gambit?'gambit':'opening'} lines`);
  }
  $('labOpeningMatches').textContent=counts.join(' · ')+'. Refine with search.';
 }
 async function loadCatalogue(){
  if(entries)return;if(load)return load;
  loadController=new AbortController();const signal=loadController.signal;
  $('labOpeningRetry').hidden=true;message('Loading the local opening catalogue…');
  load=(async()=>{try{
   const response=await fetch(new URL('../data/openings/catalog.json',import.meta.url),{signal});if(!response.ok)throw new Error('Catalogue unavailable');
   const data=await response.json();signal.throwIfAborted();if(data.version!==1||!Array.isArray(data.entries)||!data.entries.length||!data.entries.every(entry=>entry&&typeof entry.id==='string'&&typeof entry.name==='string'&&typeof entry.pgn==='string'&&typeof entry.eco==='string'&&typeof entry.gambit==='boolean'))throw new Error('Invalid catalogue');
   entries=data.entries;populate();message(`${entries.length.toLocaleString()} named lines available locally. Search, then choose a line.`);
  }catch(error){if(error.name!=='AbortError'){message('The opening catalogue could not load. Reconnect once, then retry; your board is unchanged.');$('labOpeningRetry').hidden=false;}}
  finally{load=null;loadController=null;if(signal.aborted){message('Catalogue loading paused. Open the selector again or Retry catalogue.');$('labOpeningRetry').hidden=false;}}})();return load;
 }
 function schedule(){
  render();if(!session||paused||session.phase==='complete'||api.isGameOver()||!session.automatic(api.turn()))return;
  const token=generation;
  timer=setTimeout(()=>{timer=null;if(token!==generation||!session||paused)return;
   if(session.phase==='book'){
    const move=session.next;if(!move||move.before!==api.fen()){stop('The position changed. Restart this line to continue.');return;}
    if(!api.move(move.uci,{automatic:true}))stop('This book move could not be played. Restart or choose another line.');
   }else void engineMove(token);
  },session.phase==='book'?550:160);
 }
 async function engineMove(token){
  const fen=api.fen();search=new AbortController();const signal=search.signal;message('Stockfish is choosing its own continuation…');
  try{const result=await api.engine().analyse(fen,{depth:10,movetime:350,multipv:1,clearHash:true,signal});
   if(token!==generation||!session||paused||fen!==api.fen())return;
   search=null;if(!result.best||!api.move(result.best,{automatic:true}))throw new Error('No legal continuation');
   message('Stockfish played its move. Your turn.');
  }catch(error){if(token===generation&&error.name!=='AbortError'){paused=true;message('Stockfish could not reply. Resume to retry, or Exit for free analysis.');render();}}
 }
 function start(mode){
  if(!choice)return;stop('');session=new OpeningLesson(choice,{side:$('labOpeningSide').value,mode});
  api.reset(choice.start,$('labOpeningSide').value);message(mode==='watch'?'Watching every move of the selected recorded path. Pause or Exit at any time.':'Follow the selected book path. Hint reveals its next move; Exit allows other moves.');
  schedule();view.querySelector('.labBoardColumn').scrollIntoView({block:'start',behavior:'instant'});
 }
 root.addEventListener('toggle',()=>{if(root.open)void loadCatalogue();else if(loadController){loadController.abort();}});
 $('labOpeningSearch').addEventListener('input',()=>{if(!entries)return;preview(null);populate();});
 for(const id of ['labOpeningSelect','labGambitSelect'])$(id).addEventListener('change',()=>{const selected=entries?.find(entry=>entry.id===$(id).value);$(id==='labOpeningSelect'?'labGambitSelect':'labOpeningSelect').value='';preview(selected);});
 $('labOpeningSide').addEventListener('change',()=>{if(session)stop('Colour changed. Start the selected line again when ready.');});
 $('labOpeningPractise').addEventListener('click',()=>start('practice'));$('labOpeningWatch').addEventListener('click',()=>start('watch'));$('labOpeningRetry').addEventListener('click',()=>void loadCatalogue());
 $('labOpeningExit').addEventListener('click',()=>stop());$('labOpeningRestart').addEventListener('click',()=>{if(session)start(session.mode);});
 $('labOpeningHint').addEventListener('click',()=>{if(session?.next){hint=true;message('Next book move: '+session.next.san+'. This is the selected path, not an engine recommendation.');render();}});
 $('labOpeningPause').addEventListener('click',()=>{if(!session)return;cancelWork();paused=!paused;message(paused?'Line paused. Resume when ready.':'Line resumed.');schedule();});
 $('labOpeningContinue').addEventListener('click',()=>{if(!session)return;session.phase='free';session.mode='practice';paused=false;message('Recorded line complete. Stockfish now chooses freely.');schedule();});
 return {
  stop,
  leave(){stop();loadController?.abort();},
  canInteract(){return !session||!paused&&session.mode!=='watch'&&api.turn()===session.side;},
  beforeMove(uci,{automatic=false}={}){
   if(!session)return true;if(paused||!automatic&&!this.canInteract())return false;
   if(session.phase==='book'&&!session.accepts(api.fen(),uci,{automatic})){message('That is a legal move, but this path continues with '+session.next.san+'. Try that move, use Hint, or Exit.');return false;}return true;
  },
  onMove(){
   if(!session)return;if(hint)api.hint(null);hint=false;
   if(session.phase==='book'){
    if(!session.advance(api.fen())){stop('The position changed. Restart the recorded line to continue.');return;}
    if(session.phase==='complete'){
     if(api.isGameOver())message('Recorded line complete. The game has ended; Restart to study it again.');
     else if(session.mode==='practice'){session.phase='free';message('Recorded line complete. Stockfish now chooses freely; it is no longer following the book.');}
     else message('Every move of the recorded line has been played. Play on against Stockfish, or Exit.');
    }
   }
   if(api.isGameOver())message('The game has ended. Restart or Exit when ready.');
   schedule();
  },
  refresh(){render();},
 };
}
