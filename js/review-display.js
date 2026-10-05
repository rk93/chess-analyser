export function isUciMove(value){
  return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(String(value||''));
}

export function displayLineFor(review,index){
  const bestUci=review?.bestMoves?.[index]||'';
  if(!bestUci)return{bestUci:'',bestSan:'',line:''};
  const bestSan=review?.bestSans?.[index]||bestUci;
  const line=review?.bestLines?.[index]||bestSan;
  return{bestUci,bestSan,line};
}

export function displayCacheNeedsRepair(review,moveCount){
  if(!review)return true;
  const n=Math.max(0,Number(moveCount)||0);
  if(!Array.isArray(review.bestSans)||!Array.isArray(review.bestLines))return true;
  if(review.bestSans.length<n||review.bestLines.length<n)return true;
  for(let i=0;i<n;i++){
    const best=review.bestMoves?.[i]||'';
    if(!best)continue;
    if(!String(review.bestSans[i]||'').trim())return true;
    if(!String(review.bestLines[i]||'').trim())return true;
  }
  return false;
}
