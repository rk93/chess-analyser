export const REVIEW_STUDY_TIPS=Object.freeze([
  'Before checking the engine line, ask: what was my opponent threatening?',
  'Look for checks, captures and threats for both sides before choosing a move.',
  'Choose one decision to explain in your own words after the review.',
  'A good review ends with one useful practice position, not a perfect score.',
  'Try the alternative on the board, then explain why its next move works.',
]);
export function reviewProgressState({phase='starting',done=0,total=0,depth=0}={}) {
  total=Number.isFinite(total)?Math.max(0,Math.floor(total)):0;
  done=Number.isFinite(done)?Math.max(0,Math.min(total,Math.floor(done))):0;
  depth=Number.isFinite(depth)?Math.max(0,Math.floor(depth)):0;
  const title={preview:'Gathering a first look',starting:'Getting Stockfish ready',positions:'Understanding each position',critical:'Checking the important moments',complete:'Your review is ready',cancelled:'Review stopped',error:'This review needs another try'}[phase]||'Getting Stockfish ready';
  const busy=['preview','starting','positions','critical'].includes(phase);
  const caption=phase==='positions'?`${done} / ${total} positions analysed${depth?` · depth ${depth}`:''}`:phase==='critical'?`${done} / ${total} critical positions rechecked${depth?` · depth ${depth}`:''}`:phase==='cancelled'?'Your saved games are unchanged. Retry when you are ready.':phase==='error'?'Keep the preview, or retry the verification.':'Each game takes a different amount of time. Pip will show the actual work completed.';
  return {phase,title,caption,busy,done,total,indeterminate:busy&&(!total||['preview','starting'].includes(phase)),percent:total?Math.round(100*done/total):0};
}
