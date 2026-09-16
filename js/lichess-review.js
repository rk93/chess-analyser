export function winPercent(cp){
  const x=Math.max(-100000,Math.min(100000,Number(cp)||0));
  return 100/(1+Math.exp(-0.00368208*x));
}

export function moverWinLoss(beforeCp,afterCp,ply){
  const before=winPercent(beforeCp),after=winPercent(afterCp);
  const drop=ply%2===1?before-after:after-before;
  return Math.max(0,drop/100);
}

export function moveAccuracy(beforeCp,afterCp,ply){
  const lossPoints=100*moverWinLoss(beforeCp,afterCp,ply);
  if(lossPoints<=0)return 100;
  return Math.max(0,Math.min(100,103.1668100711649*Math.exp(-0.04354415386753951*lossPoints)-3.166924740191411+1));
}

export function lichessJudgement(beforeCp,afterCp,ply){
  const loss=moverWinLoss(beforeCp,afterCp,ply);
  if(loss>=0.30)return'Blunder';
  if(loss>=0.20)return'Mistake';
  if(loss>=0.10)return'Inaccuracy';
  return null;
}

function mean(xs){return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:100}
function harmonic(xs){if(!xs.length)return 100;if(xs.some(x=>x<=0))return 0;return xs.length/xs.reduce((s,x)=>s+1/x,0)}
function std(xs){if(!xs.length)return 0;const m=mean(xs);return Math.sqrt(xs.reduce((s,x)=>s+(x-m)*(x-m),0)/xs.length)}

export function gameAccuracy(evals,color){
  if(!evals||evals.length<2)return 100;
  const wps=evals.map(winPercent),moveCount=evals.length-1,windowSize=Math.max(2,Math.min(8,Math.floor(moveCount/10)||2));
  const entries=[];
  for(let ply=1;ply<evals.length;ply++){
    const isWhite=ply%2===1;if((color==='white')!==isWhite)continue;
    const acc=moveAccuracy(evals[ply-1],evals[ply],ply);
    const from=Math.max(0,ply-windowSize+1),window=wps.slice(from,Math.min(wps.length,from+windowSize));
    const weight=Math.max(0.5,Math.min(12,std(window)));
    entries.push({acc,weight});
  }
  if(!entries.length)return 100;
  const weighted=entries.reduce((s,x)=>s+x.acc*x.weight,0)/entries.reduce((s,x)=>s+x.weight,0);
  return Math.max(0,Math.min(100,(weighted+harmonic(entries.map(x=>x.acc)))/2));
}

export function classifyReviewedMove({before,after,ply,played,best,isBook=false}){
  const bad=lichessJudgement(before,after,ply);if(bad)return bad;
  if(best&&played===best)return isBook?'Book':'Best';
  if(isBook)return'Book';
  const acc=moveAccuracy(before,after,ply);
  if(acc>=95)return'Excellent';
  return'Good';
}
