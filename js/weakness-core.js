import { selectSample, openingGroups, COMPARISON_POOLS } from './comparison-intelligence.js';
import { record } from './player-insights.js';
import { verifiedPracticeCandidates } from './personal-training-core.js';

const DAY = 86400;
export const REVIEW_SAMPLE_LIMIT = 60;
const percent = n => Math.round(n) + '%';
function interval(rows) {
  const dates = rows.map(row=>row.end).filter(Number.isFinite);
  return {start:dates.length ? Math.min(...dates) : null,end:dates.length ? Math.max(...dates) : null};
}
function change(rows, now, score) {
  const recent = rows.filter(row=>row.end >= now - 30*DAY && row.end <= now);
  const previous = rows.filter(row=>row.end >= now - 60*DAY && row.end < now - 30*DAY);
  if (record(recent).known < 10 || record(previous).known < 10) return null;
  return {recent:score(recent),previous:score(previous),recentGames:record(recent).known,previousGames:record(previous).known};
}
function observation(kind, pool, title, text, cohort, supporting, now, metric, lowerIsBetter = false, identity = '') {
  const known = record(cohort).known, trend = metric ? change(cohort, now, metric) : null;
  const delta = trend ? trend.recent - trend.previous : null;
  return {id:JSON.stringify([kind,pool,identity]),kind,pool,title,text,source:'game-history',
    games:supporting.length,denominator:known,...interval(cohort),
    reliability:known >= 20 ? 'Broader sample' : 'Small sample',
    trend:trend ? {...trend,delta,direction:Math.abs(delta) < 5 ? 'Similar' : (lowerIsBetter ? delta < 0 : delta > 0) ? 'Improving' : 'Declining'} : null,
    representatives:supporting.slice(0,3).map(row=>({key:row.key,opponent:row.opponent,end:row.end})),rows:cohort};
}

// These are descriptive result patterns, always scoped to one rating pool.
export function gameHistoryWeaknesses(rows, {now = Date.now()/1000} = {}) {
  const findings = [];
  for (const pool of COMPARISON_POOLS) {
    const cohort = rows.filter(row=>row.pool === pool), stats = record(cohort);
    for (const opening of openingGroups(cohort,pool).filter(group=>group.known >= 5 && group.losses >= 3 && group.score <= 40)) {
      findings.push(observation('opening',pool,`Revisit ${opening.name}`,
        `${opening.name} as ${opening.white ? 'White' : 'Black'} scored ${percent(opening.score)} in ${opening.known} ${pool} games (${opening.wins}W/${opening.draws}D/${opening.losses}L). Review a loss to find a decision worth studying; results do not establish its cause.`,
        opening.rows,opening.rows.filter(row=>row.result==='L'),now,r=>record(r).score,false,[opening.name,opening.white]));
    }
    const white = cohort.filter(row=>row.white), black = cohort.filter(row=>!row.white), a = record(white), b = record(black);
    if (a.known >= 10 && b.known >= 10 && Math.abs(a.score-b.score) >= 20) {
      const side = a.score < b.score ? white : black, stat = record(side), name = a.score < b.score ? 'White' : 'Black';
      findings.push(observation('colour',pool,`Explore your ${name} games`,
        `${name} scores ${percent(stat.score)} in ${stat.known} ${pool} games; the other colour scores ${percent(Math.max(a.score,b.score))}. Opponents and openings can explain part of this difference.`,
        side,side.filter(row=>row.result==='L'),now,r=>record(r).score,false,name));
    }
    const timeout = row => row.result==='L' && row.game[row.white ? 'white':'black']?.result==='timeout';
    const timedOut = cohort.filter(timeout);
    if (stats.known >= 10 && timedOut.length >= 3 && timedOut.length/stats.known >= .2) findings.push(observation('timeout',pool,'Review losses on time',
      `${timedOut.length} explicit timeout losses in ${stats.known} known ${pool} results. Review your decisions and clock use; the result does not tell us why time ran out.`,
      cohort,timedOut,now,r=>100*r.filter(timeout).length/record(r).known,true));
    const plyCount = row => Number(String(row.game.pgn||'').match(/^\[PlyCount\s+"(\d+)"\]/m)?.[1]) || null;
    const withCount = cohort.filter(row=>plyCount(row)>0), short = row=>row.result==='L'&&plyCount(row)>0&&plyCount(row)<=40;
    const shortLosses = withCount.filter(short), lengthStats = record(withCount);
    if (lengthStats.known >= 10 && shortLosses.length >= 3) findings.push(observation('short-loss',pool,'Study early finishes',
      `${shortLosses.length} ${pool} losses have a recorded PlyCount of at most 40 (20 full moves), among ${lengthStats.known} games with known lengths and results. A short loss alone does not prove an opening or tactical mistake. Games without this metadata are excluded.`,
      withCount,shortLosses,now,r=>100*r.filter(short).length/record(r).known,true));
    const recent = change(cohort,now,r=>record(r).score);
    if (recent && recent.recent <= recent.previous-20) findings.push(observation('decline',pool,'Check a recent results dip',
      `${pool} score fell from ${percent(recent.previous)} (${recent.previousGames} games, previous 30 days) to ${percent(recent.recent)} (${recent.recentGames}, last 30 days). This does not establish a loss of playing strength.`,
      cohort,cohort.filter(row=>row.end>=now-30*DAY&&row.result==='L'),now,r=>record(r).score));
    for (const band of ['lower','similar','higher']) {
      const group = cohort.filter(row=>{
        const other = row.game[row.white?'black':'white']?.rating;
        if (!Number.isFinite(row.rating)||!Number.isFinite(other)||other<=0) return false;
        const difference = other-row.rating;
        return band==='lower' ? difference < -100 : band==='higher' ? difference > 100 : Math.abs(difference)<=100;
      }), result = record(group);
      if (result.known >= 10 && result.losses >= 5 && result.score <= 30) findings.push(observation('rating-band',pool,`Review results against ${band}-rated opponents`,
        `${percent(result.score)} score across ${result.known} ${pool} games against ${band}-rated opponents. Bands use ratings recorded in each game (within 100 points is similar).`,
        group,group.filter(row=>row.result==='L'),now,r=>record(r).score,false,band));
    }
  }
  return findings;
}

export function estimatedPhase(fen) {
  const parts = String(fen||'').split(' '), board = parts[0];
  if (board?.split('/').length !== 8 || !Number.isFinite(Number(parts[5]))) return null;
  const material = [...board].reduce((sum,piece)=>sum+({q:9,r:5,b:3,n:3}[piece.toLowerCase()]||0),0);
  return material <= 13 ? 'endgame' : Number(parts[5])<=10 ? 'opening' : 'middlegame';
}
export function reliableReview(data, moves) {
  const size = moves.length;
  return size>0 && data?.verifiedReviewVersion===1 && Number.isSafeInteger(data.localStockfishVersion) && data.localStockfishVersion>0 && Array.isArray(data.labels) && data.labels.length===size && Array.isArray(data.evals) && data.evals.length===size+1 &&
    Array.from({length:size+1},(_,i)=>i).every(i=>Number.isFinite(data.evals[i])&&data.positionExact?.[i]===true&&Number.isFinite(data.localDepths?.[i])&&data.localDepths[i]>=8) &&
    moves.every((move,i)=>data.moveVerified?.[i]===true&&/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(data.bestMoves?.[i]||''));
}
// The browser supplies legal-move validation through describe; no engine runs.
export function savedReviewFacts(moves, data, white, describe, identifyMotif) {
  if (!reliableReview(data,moves)) return null;
  const side = white?'w':'b', own = moves.filter(move=>move.color===side);
  if (!own.length) return null;
  try {
    for (const [i,move] of moves.entries()) if (move.color===side && !describe(move.before,data.bestMoves[i])) return null;
    const events = verifiedPracticeCandidates(moves,data,white).flatMap(candidate=>{
      const index = moves.findIndex(move=>move.before===candidate.fen&&move.san===candidate.badMove&&move.color===side);
      const loss = (data.evals[index]-data.evals[index+1])*(white?1:-1);
      if (index<0 || loss<=0) return [];
      const best = describe(candidate.fen,candidate.bestMove);
      return [{...candidate,ply:index+1,phase:estimatedPhase(candidate.fen),theme:best.san.includes('#')?'mate':best.captured?'capture':'alternative',
        bestSan:best.san,motif:identifyMotif?.(candidate.fen,candidate.bestMove)||null,depth:Math.min(data.localDepths[index],data.localDepths[index+1])}];
    });
    return {events,phases:[...new Set(own.map(move=>estimatedPhase(move.before)).filter(Boolean))]};
  } catch { return null; }
}

export function engineWeaknesses(reviews, {now=Date.now()/1000}={}) {
  const findings=[];
  for (const pool of COMPARISON_POOLS) {
    const cohort = reviews.filter(review=>review.row.pool===pool && review.facts);
    const patterns = [
      ['knight-fork','Checking knight forks to practise',event=>event.motif?.kind==='knight-fork',null],
      ['absolute-pin','Absolute pins to practise',event=>event.motif?.kind==='absolute-pin',null],
      ['blunders','Repeated verified blunders',event=>event.label==='Blunder',null],
      ['mate','Missed checkmate opportunities',event=>event.theme==='mate',null],
      ['capture','Stronger captures to review',event=>event.theme==='capture',null],
      ...['opening','middlegame','endgame'].map(phase=>['phase-'+phase,`${phase[0].toUpperCase()+phase.slice(1)} decisions to revisit`,event=>event.phase===phase,phase]),
    ];
    for (const [kind,title,matches,phase] of patterns) {
      const eligible=cohort.filter(review=>!phase||review.facts.phases.includes(phase));
      const supporting=eligible.filter(review=>review.facts.events.some(matches));
      if (supporting.length<3) continue;
      const recent=eligible.filter(review=>review.row.end>=now-30*DAY),previous=eligible.filter(review=>review.row.end>=now-60*DAY&&review.row.end<now-30*DAY);
      const rate=group=>100*group.filter(review=>review.facts.events.some(matches)).length/group.length;
      const delta=recent.length>=5&&previous.length>=5?rate(recent)-rate(previous):null;
      findings.push({id:JSON.stringify([kind,pool]),kind,pool,title,source:'engine-review',games:supporting.length,denominator:eligible.length,
        ...interval(eligible.map(review=>review.row)),reliability:supporting.length>=10?'Repeated across more games':'Limited reviewed sample',
        text:`Saved Stockfish reviews support this pattern in ${supporting.length} of ${eligible.length} eligible reviewed ${pool} games. Each supporting position has exact evaluations and depth of at least 8. ${['knight-fork','absolute-pin'].includes(kind)?'Legal board checks identify this motif in the stronger recommended move. The motif does not establish a forced win. ':''}This describes reviewed positions, not a general skill diagnosis.`,
        depth:Math.min(...supporting.flatMap(review=>review.facts.events.filter(matches).map(event=>event.depth))),
        trend:delta===null?null:{delta,direction:Math.abs(delta)<5?'Similar':delta<0?'Improving':'Declining',recentGames:recent.length,previousGames:previous.length},
        representatives:supporting.slice(0,3).map(review=>({key:review.row.key,opponent:review.row.opponent,end:review.row.end,...review.facts.events.find(matches)}))});
    }
  }
  return findings;
}
export function buildWeaknessReport(games,user,{now=Date.now()/1000,pool='all',days=90,reviews=[]}={}) {
  const rows=selectSample(games,user,{now,days}).filter(row=>COMPARISON_POOLS.includes(row.pool)&&(pool==='all'||row.pool===pool));
  const allowed=new Set(rows.map(row=>row.key)),seen=new Set();
  const eligible=reviews.filter(review=>{if(!allowed.has(review.row.key)||seen.has(review.row.key))return false;seen.add(review.row.key);return true});
  const engine=engineWeaknesses(eligible,{now}),history=gameHistoryWeaknesses(rows,{now});
  return {rows,engine,history,findings:[...engine,...history],reviewed:eligible.filter(review=>review.facts).length,scanned:eligible.length,days,pool};
}
