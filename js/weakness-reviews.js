import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm';
import { readSavedReview } from './saved-review.js';
import { REVIEW_SAMPLE_LIMIT, savedReviewFacts } from './weakness-core.js';
import { classifyTacticalMotif } from './tactical-motifs.js';

function describe(fen,uci) {
  const board=new Chess(fen);
  return board.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});
}
export async function inspectWeaknessReviews(rows,{signal,onProgress}={}) {
  const selected=rows.slice(0,REVIEW_SAMPLE_LIMIT), reviews=[];
  for (const [index,row] of selected.entries()) {
    signal?.throwIfAborted();
    let facts=null;
    try { const {moves,data}=await readSavedReview(row);facts=savedReviewFacts(moves,data,row.white,describe,(fen,uci)=>classifyTacticalMotif(fen,uci,value=>new Chess(value))); }
    catch { /* Old, partial, malformed and low-depth reviews supply no evidence. */ }
    signal?.throwIfAborted(); reviews.push({row,facts});
    if (index%5===4 || index===selected.length-1) { onProgress?.(index+1,selected.length);await new Promise(resolve=>setTimeout(resolve,0)); }
  }
  signal?.throwIfAborted();return reviews;
}
