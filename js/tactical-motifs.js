// Geometry complements an already verified engine recommendation. It does not
// evaluate positions or establish that a game/position is winning.
const UCI=/^[a-h][1-8][a-h][1-8][qrbn]?$/;
const point=square=>[square.charCodeAt(0)-97,Number(square[1])-1];
const square=(file,rank)=>String.fromCharCode(97+file)+(rank+1);
const inside=(file,rank)=>file>=0&&file<8&&rank>=0&&rank<8;
const knightAttacks=(from,to)=>{
  const [a,b]=point(from),[c,d]=point(to);
  return Math.abs(a-c)*Math.abs(b-d)===2;
};
const pieceName={q:'queen',r:'rook',b:'bishop',n:'knight',p:'pawn'};

function pins(board,from) {
  const piece=board.get(from);
  if(!piece||!['b','r','q'].includes(piece.type))return [];
  const directions=[...[[-1,-1],[-1,1],[1,-1],[1,1]].filter(()=>piece.type!=='r'),
    ...[[-1,0],[1,0],[0,-1],[0,1]].filter(()=>piece.type!=='b')];
  const [file,rank]=point(from),out=[];
  for(const [df,dr] of directions){
    let target=null;
    for(let f=file+df,r=rank+dr;inside(f,r);f+=df,r+=dr){
      const at=square(f,r),next=board.get(at);
      if(!next)continue;
      if(next.color===piece.color)break;
      if(!target){
        if(!['q','r','b','n'].includes(next.type))break;
        target={square:at,type:next.type};
      }else{
        if(next.type==='k')out.push({...target,king:at});
        break;
      }
    }
  }
  return out;
}

export function classifyTacticalMotif(fen,uci,createBoard) {
  if(!UCI.test(uci||'')||typeof createBoard!=='function')return null;
  try{
    const before=createBoard(fen),board=createBoard(fen);
    const enemyKing=before.board().flat().find(piece=>piece?.type==='k'&&piece.color!==before.turn());
    if(!enemyKing||before.isAttacked(enemyKing.square,before.turn()))return null;
    const move=board.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});
    if(!move||move.san.includes('#'))return null;
    const replies=()=>board.moves({verbose:true});
    if(move.piece==='n'&&board.isCheck()){
      const enemy=board.board().flat().filter(piece=>piece&&piece.color!==move.color);
      const king=enemy.find(piece=>piece.type==='k');
      const targets=enemy.filter(piece=>['q','r'].includes(piece.type)&&knightAttacks(move.to,piece.square));
      if(!king||!knightAttacks(move.to,king.square)||!targets.length)return null;
      const responses=replies();
      // Reject apparent forks if the knight can be removed, or if a king reply
      // leaves every target capture illegal (for example, a newly pinned knight).
      if(!responses.length||!responses.every(reply=>{
        const next=createBoard(board.fen());next.move(reply);
        return next.get(move.to)?.type==='n'&&next.get(move.to)?.color===move.color&&
          next.moves({square:move.to,verbose:true}).some(capture=>targets.some(target=>target.square===capture.to)&&['q','r'].includes(capture.captured));
      }))return null;
      return {kind:'knight-fork',title:'Checking knight fork',from:move.from,to:move.to,king:king.square,
        targets:targets.map(target=>target.square),
        explanation:`After ${move.san}, the knight on ${move.to} checks the king on ${king.square} and attacks ${targets.map(target=>`the ${pieceName[target.type]} on ${target.square}`).join(' and ')}. Every legal reply leaves a legal capture of at least one of these targets. This identifies a fork, not a forced game win.`};
    }
    if(['b','r','q'].includes(move.piece)){
      const existing=before.board().flat().filter(piece=>piece?.color===move.color&&['b','r','q'].includes(piece.type)).flatMap(piece=>pins(before,piece.square));
      const created=pins(board,move.to).filter(pin=>!existing.some(old=>old.square===pin.square&&old.king===pin.king));
      if(!created.length||replies().some(reply=>reply.to===move.to&&reply.captured))return null;
      const pin=created[0];
      return {kind:'absolute-pin',title:'Absolute pin',from:move.from,to:move.to,king:pin.king,targets:[pin.square],
        explanation:`After ${move.san}, the ${pieceName[pin.type]} on ${pin.square} lies between the ${pieceName[move.piece]} on ${move.to} and its king on ${pin.king}. It cannot leave that line and expose its king. This verifies an absolute pin, not a forced material win.`};
    }
  }catch{ /* Invalid positions, illegal moves and unavailable board support supply no motif. */ }
  return null;
}
