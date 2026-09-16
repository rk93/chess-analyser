export function buildTacticalVerificationPlan({positions=[],sans=[],evals=[],positionExact=[],legalMoves}){
  const score=new Map(),reason=new Map();
  const add=(index,points,why)=>{
    if(index<0||index>=positions.length)return;
    if(points>(score.get(index)||-1)){score.set(index,points);reason.set(index,why)}
  };
  const addWindow=(index,points,why)=>{add(index,points,why);add(index-1,points-6,why);add(index+1,points-6,why)};

  if(typeof legalMoves==='function'){
    for(let i=0;i<positions.length;i++){
      let moves=[];
      try{moves=legalMoves(positions[i]?.fen)||[]}catch{}
      if(moves.some(m=>m?.captured==='q')) addWindow(i,120,'queen capture available');
      else if(moves.some(m=>m?.captured==='r')) addWindow(i,72,'rook capture available');
    }
  }

  for(let ply=1;ply<positions.length;ply++){
    const san=String(sans[ply-1]||'');
    if(/[+#]$/.test(san)) addWindow(ply,38,'check sequence');
    if(/x/.test(san)&&/[QR]/.test(san)) addWindow(ply,58,'major-piece capture sequence');
    const before=Number(evals[ply-1]),after=Number(evals[ply]);
    if(Number.isFinite(before)&&Number.isFinite(after)){
      const moverDrop=ply%2===1?before-after:after-before;
      if(moverDrop>=180) addWindow(ply,100,'large evaluation drop');
      else if(moverDrop>=90) addWindow(ply,64,'evaluation drop');
      if(Math.abs(after-before)>=140&&(!positionExact[ply-1]||!positionExact[ply])) addWindow(ply,82,'unverified evaluation swing');
    }
  }

  return [...score.keys()].sort((a,b)=>(score.get(b)-score.get(a))||(a-b)).map(index=>({index,score:score.get(index),reason:reason.get(index)||'tactical'}));
}

export function planIndexes(plan){return plan.map(x=>x.index)}
