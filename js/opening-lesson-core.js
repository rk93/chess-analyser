// The actual board remains owned by lab.js. This model validates a book path
// and only advances when the board's real FEN matches that path.
export function compileOpening(entry,Chess){
 if(!entry||typeof entry.name!=='string'||typeof entry.pgn!=='string')throw new Error('Opening line unavailable');
 const board=new Chess();board.loadPgn(entry.pgn);
 const moves=board.history({verbose:true}).map(move=>({san:move.san,uci:move.from+move.to+(move.promotion||''),before:move.before,after:move.after,color:move.color}));
 if(!moves.length)throw new Error('This opening has no moves');
 return {entry,moves,start:moves[0].before,end:moves.at(-1).after};
}
export function filterOpeningEntries(entries,query='',gambit=false){
 const words=String(query).trim().toLowerCase().split(/\s+/).filter(Boolean);
 return entries.filter(entry=>entry.gambit===gambit&&words.every(word=>(entry.eco+' '+entry.name).toLowerCase().includes(word)));
}
export class OpeningLesson {
 constructor(line,{side='white',mode='practice'}={}){this.line=line;this.side=side==='black'?'b':'w';this.mode=mode;this.index=0;this.phase='book';}
 get next(){return this.line.moves[this.index]||null;}
 automatic(turn){return this.mode==='watch'||turn!==this.side;}
 accepts(fen,uci,{automatic=false}={}){
  if(this.phase!=='book')return true;
  return this.next?.before===fen&&this.next.uci===uci&&(this.mode!=='watch'||automatic);
 }
 advance(fen){
  if(this.phase!=='book'||this.next?.after!==fen)return false;
  this.index++;if(this.index===this.line.moves.length)this.phase='complete';return true;
 }
}
