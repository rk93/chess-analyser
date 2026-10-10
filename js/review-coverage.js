export const VERIFIED_REVIEW_VERSION=1;
const UCI=/^[a-h][1-8][a-h][1-8][qrbn]?$/;
export function reviewCoverage(data, positions) {
  const count=positions?.length||0, missing=[];
  if(!count||!data||!Array.isArray(data.evals)||data.evals.length!==count)return{complete:false,missing:Array.from({length:count},(_,i)=>i)};
  for(let i=0;i<count;i++){
    const terminal=positions[i]?.terminal===true;
    const exact=data.positionExact?.[i]===true;
    const finite=Number.isFinite(data.evals[i]);
    const best=UCI.test(data.bestMoves?.[i]||'');
    const depth=Number(data.localDepths?.[i])>=1;
    if(!finite||!exact||(!terminal&&(!best||!depth)))missing.push(i);
  }
  return{complete:missing.length===0&&data.verifiedReviewVersion===VERIFIED_REVIEW_VERSION,missing};
}
export function assertEngineCoverage(engineData,positions){
  const failures=[];
  for(let i=0;i<positions.length;i++){
    const terminal=positions[i]?.terminal===true;
    if(!Number.isFinite(engineData.evals?.[i])||(!terminal&&(!UCI.test(engineData.bestMoves?.[i]||'')||Number(engineData.depths?.[i])<1)))failures.push(i);
  }
  if(failures.length)throw new Error('Engine results missing at '+failures.length+' position(s): '+failures.slice(0,12).join(', '));
}
