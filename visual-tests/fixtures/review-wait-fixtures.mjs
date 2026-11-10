import {seedFeedbackReview} from './feedback-fixtures.mjs';
export async function holdReviewEngine(page,after=2,{startupDelay=0,stopMode='drain'}={}){
  await page.addInitScript(({after,startupDelay,stopMode})=>{
    const Native=window.Worker;window.reviewEngineAudit={go:0,stop:0,progress:[],verified:0,workers:0,terminated:0,ready:0,bestmove:0,errors:[],commands:[]};window.holdEngineAfter=after;window.releaseHeldSearch=null;window.reviewEngineStopMode=stopMode;
    addEventListener('reviewAnalysisProgress',event=>reviewEngineAudit.progress.push(event.detail));
    addEventListener('gameReviewVerified',event=>{if(event.detail?.cached===false)reviewEngineAudit.verified++;});
    window.Worker=class extends Native{
      constructor(url,...args){
        super(url,...args);this.isReviewEngine=String(url).includes('stockfish');
        if(this.isReviewEngine){
          reviewEngineAudit.workers++;
          this.addEventListener('message',event=>{if(event.data==='readyok')reviewEngineAudit.ready++;if(String(event.data).startsWith('bestmove '))reviewEngineAudit.bestmove++;});
          for(const type of ['error','messageerror'])this.addEventListener(type,event=>reviewEngineAudit.errors.push({type,message:event.message,time:performance.now()}));
        }
      }
      terminate(){if(this.isReviewEngine)reviewEngineAudit.terminated++;return super.terminate();}
      postMessage(message,...args){
        if(this.isReviewEngine){
          if(reviewEngineAudit.commands.length<200)reviewEngineAudit.commands.push({message:String(message),time:performance.now()});
          if(message==='uci'&&startupDelay){setTimeout(()=>super.postMessage(message,...args),startupDelay);return;}
        }
        if(this.isReviewEngine&&String(message).startsWith('go ')){
          reviewEngineAudit.go++;
          if(reviewEngineAudit.go>window.holdEngineAfter){
            this.heldSearch=[message,args];window.releaseHeldSearch=()=>{const held=this.heldSearch;this.heldSearch=null;if(held)super.postMessage(held[0],...held[1]);};return;
          }
        }
        if(this.isReviewEngine&&message==='stop'){
          reviewEngineAudit.stop++;
          if(window.reviewEngineStopMode==='crash'){
            this.dispatchEvent(new ErrorEvent('error',{message:'Simulated Stockfish worker crash'}));return;
          }
          // Simulate a worker that never emits the cancelled search's bestmove.
          if(window.reviewEngineStopMode==='drop'){this.heldSearch=null;return;}
          // Let the real engine drain the held search when cancellation requests stop.
          if(this.heldSearch){const held=this.heldSearch;this.heldSearch=null;super.postMessage(held[0],...held[1]);}
        }
        return super.postMessage(message,...args);
      }
    };
  },{after,startupDelay,stopMode});
}
export async function reviewEngineState(page){
  return page.evaluate(()=>({started:reviewEngineAudit.go>0,verified:reviewEngineAudit.verified>0,phase:document.getElementById('reviewWaitPanel')?.dataset.phase,status:document.getElementById('reviewStatus')?.textContent,audit:reviewEngineAudit}));
}
export async function seedPendingReview(page){
  await seedFeedbackReview(page);
  await page.evaluate(async()=>{
    const {Chess}=await import('https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm'),{cacheSet,setPositionEval,simpleHash}=await import('/js/analysis-store.js');
    const game=new Chess();game.loadPgn('1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5');const history=game.history({verbose:true}),key=simpleHash('alpha 1400 — beta 1400|'+history.map(m=>m.san).join(' '));
    await cacheSet('review',key,null);
    for(const fen of [history[0].before,...history.map(m=>m.after)]){
      const c=new Chess(fen),move=c.moves({verbose:true})[0],uci=move?move.from+move.to+(move.promotion||''):'';
      await setPositionEval('cloud',fen,{source:'Public preview fixture',depth:12,pvs:[{cp:0,moves:uci}]});
    }
  });
}
export async function startPendingReview(page){
  await page.locator('#gamesTab').click();await page.locator('.gameWithAvatar').click();
  if(page.viewportSize().width<=800){await page.locator('#reviewDepthStart').click();}
  else await page.locator('#runReview').click();
}
