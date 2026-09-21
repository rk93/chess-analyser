// Review v2 scoring: deterministic Stockfish evidence with Lichess-style Win% loss.
// The bad-move thresholds (10/20/30 percentage-point loss) mirror Lichess Advice.scala.
// Best-equivalence and singular-choice handling follow common open-source review practice.

export const WIN_COEFFICIENT=0.00368208;

export function winPercent(cp){
  const x=Math.max(-100000,Math.min(100000,Number(cp)||0));
  return 100/(1+Math.exp(-WIN_COEFFICIENT*x));
}

export function moverWinPercent(cp,ply){
  const w=winPercent(cp);
  return ply%2===1?w:100-w;
}

export function moverWinLossPct(beforeCp,afterCp,ply){
  return Math.max(0,moverWinPercent(beforeCp,ply)-moverWinPercent(afterCp,ply));
}

export function moverCpDrop(beforeCp,afterCp,ply){
  const before=Number(beforeCp)||0,after=Number(afterCp)||0;
  return ply%2===1?before-after:after-before;
}

export function lichessBadMove(lossPct){
  const loss=Math.max(0,Number(lossPct)||0);
  if(loss>=30)return'Blunder';
  if(loss>=20)return'Mistake';
  if(loss>=10)return'Inaccuracy';
  return null;
}

export function moveAccuracyFromLoss(lossPct){
  const d=Math.max(0,Math.min(100,Number(lossPct)||0));
  if(d===0)return 100;
  return Math.max(0,Math.min(100,103.1668100711649*Math.exp(-0.04354415386753951*d)-3.166924740191411+1));
}

export function classifyStockfishMove({
  beforeCp,afterCp,ply,played='',best='',secondBestCp=null,
  legalMoveCount=null,isBook=false,isSacrifice=false
}){
  const lossPct=moverWinLossPct(beforeCp,afterCp,ply);
  const bad=lichessBadMove(lossPct);
  if(bad)return{label:bad,lossPct,accuracy:moveAccuracyFromLoss(lossPct),bestEquivalent:false,onlyGapPct:null};

  const cpDrop=moverCpDrop(beforeCp,afterCp,ply);
  const bestEquivalent=(!!best&&played===best)||cpDrop<=10;
  const forced=legalMoveCount===1;
  let onlyGapPct=null;
  if(Number.isFinite(secondBestCp)){
    onlyGapPct=Math.max(0,moverWinPercent(beforeCp,ply)-moverWinPercent(secondBestCp,ply));
  }

  let label;
  if(isBook&&lossPct<5)label='Book';
  else if(isSacrifice&&bestEquivalent&&lossPct<3)label='Brilliant';
  else if((forced||bestEquivalent)&&onlyGapPct!=null&&onlyGapPct>=12&&lossPct<2)label='Great';
  else if(forced||bestEquivalent)label='Best';
  else if(lossPct<2)label='Excellent';
  else label='Good';

  return{label,lossPct,accuracy:moveAccuracyFromLoss(lossPct),bestEquivalent,onlyGapPct};
}

function mean(xs){return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:100}
function harmonic(xs){if(!xs.length)return 100;if(xs.some(x=>x<=0))return 0;return xs.length/xs.reduce((s,x)=>s+1/x,0)}
function std(xs){if(!xs.length)return 0;const m=mean(xs);return Math.sqrt(xs.reduce((s,x)=>s+(x-m)*(x-m),0)/xs.length)}

export function gameAccuracy(evals,color){
  if(!evals||evals.length<2)return 100;
  const wps=evals.map(winPercent),plies=evals.length-1,windowSize=Math.max(2,Math.min(8,Math.round(plies/10)||2)),entries=[];
  for(let ply=1;ply<evals.length;ply++){
    if((color==='white')!==(ply%2===1))continue;
    const loss=moverWinLossPct(evals[ply-1],evals[ply],ply);
    const acc=moveAccuracyFromLoss(loss);
    const start=Math.max(0,ply-windowSize+1);
    const window=wps.slice(start,ply+1);
    const weight=Math.max(.5,Math.min(12,std(window)));
    entries.push({acc,weight});
  }
  if(!entries.length)return 100;
  const weighted=entries.reduce((s,x)=>s+x.acc*x.weight,0)/entries.reduce((s,x)=>s+x.weight,0);
  return Math.max(0,Math.min(100,(weighted+harmonic(entries.map(x=>x.acc)))/2));
}
