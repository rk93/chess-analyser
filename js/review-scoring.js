// Transparent move-quality scoring used by the post-review tactical audit.
// Win probability uses Lichess' published centipawn -> Win% coefficient.
// Classification bands follow the public expected-points bands documented by Chess.com.

export function whiteWinProbability(cp){
  const n=Math.max(-10000,Math.min(10000,Number(cp)||0));
  return 1/(1+Math.exp(-0.00368208*n));
}

export function moverExpectedPointLoss(beforeCp,afterCp,ply){
  const before=whiteWinProbability(beforeCp),after=whiteWinProbability(afterCp);
  const loss=ply%2===1?before-after:after-before;
  return Math.max(0,Math.min(1,loss));
}

export function moverCentipawnDrop(beforeCp,afterCp,ply){
  const before=Number(beforeCp)||0,after=Number(afterCp)||0;
  return ply%2===1?before-after:after-before;
}

export function baseMoveClass(loss){
  const l=Math.max(0,Number(loss)||0);
  if(l<=0.002)return'Best';
  if(l<=0.02)return'Excellent';
  if(l<=0.05)return'Good';
  if(l<=0.10)return'Inaccuracy';
  if(l<=0.20)return'Mistake';
  return'Blunder';
}

export function classifyReviewedMove({loss,ply,played,best,previousLabel,queenHangConfirmed=false,queenTrade=false}){
  // A queen left to an immediate engine-best capture is a material blunder even
  // when the position was already highly favourable and Win% is saturated.
  if(queenHangConfirmed&&!queenTrade&&played!==best)return'Blunder';

  const base=baseMoveClass(loss);
  if(['Inaccuracy','Mistake','Blunder'].includes(base))return base;
  if(previousLabel==='Brilliant'||previousLabel==='Great'||previousLabel==='Book')return previousLabel;
  if(best&&played===best)return'Best';
  if(ply<=10&&loss<=0.02)return previousLabel==='Book'?'Book':base;
  return base;
}

export function moveAccuracy(loss){
  const delta=Math.max(0,Math.min(100,(Number(loss)||0)*100));
  const score=103.1668*Math.exp(-0.04354*delta)-3.1669;
  return Math.max(0,Math.min(100,score));
}

export function sideAccuracy(losses){
  if(!losses.length)return 100;
  const values=losses.map(moveAccuracy);
  const arithmetic=values.reduce((a,b)=>a+b,0)/values.length;
  const harmonic=values.length/values.reduce((sum,v)=>sum+1/Math.max(0.01,v),0);
  return Math.round(((arithmetic+harmonic)/2)*10)/10;
}
