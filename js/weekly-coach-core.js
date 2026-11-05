import {playerGames,record} from './player-insights.js';
import {openingGroups,COMPARISON_POOLS} from './comparison-intelligence.js';
import {engineWeaknesses} from './weakness-core.js';
import {simpleHash} from './analysis-store.js';

export const COACH_DAY=86400,COACH_WINDOW=7*COACH_DAY,COACH_COMPARISON_MIN=10;
const completed=(entry,now)=>Number.isFinite(entry?.completedAt)&&entry.completedAt>=now-COACH_WINDOW&&entry.completedAt<=now;
export function updateCoachStudy(progress,id,done,{now=Date.now()/1000}={}) {
  const entries=Object.entries(progress&&typeof progress==='object'&&!Array.isArray(progress)?progress:{}).filter(([key,value])=>key.startsWith('coach-v1:')&&key.length<200&&completed(value,now));
  const next=Object.fromEntries(entries);delete next[id];
  if(done&&typeof id==='string'&&id.startsWith('coach-v1:')&&id.length<200)next[id]={completedAt:now};
  return Object.fromEntries(Object.entries(next).sort((a,b)=>b[1].completedAt-a[1].completedAt).slice(0,100));
}
const identity=(kind,pool,key)=>`coach-v1:${kind}:${pool}:${simpleHash(JSON.stringify(key))}`;

export function buildWeeklyCoach(games,user,{now=Date.now()/1000,pool='rapid',reviews=[],progress={},trainingProgress={}}={}) {
  user=String(user||'').trim().toLowerCase();pool=COMPARISON_POOLS.includes(pool)?pool:'rapid';
  const dated=playerGames(games,user).filter(row=>COMPARISON_POOLS.includes(row.pool)&&row.end!==null&&row.end>=now-2*COACH_WINDOW&&row.end<=now);
  const allowed=new Map(dated.map(row=>[row.key,row])),checked=new Map();
  for(const review of reviews){
    const row=allowed.get(review?.row?.key);
    if(!row||checked.has(row.key)||row.white!==review.row.white||row.pool!==review.row.pool||row.end!==review.row.end)continue;
    const facts=review.facts,valid=facts&&Array.isArray(facts.events)&&Array.isArray(facts.phases)&&facts.events.every(event=>event&&Number.isFinite(event.depth)&&event.depth>=8&&Number.isSafeInteger(event.ply)&&event.ply>0&&typeof event.fen==='string'&&/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(event.bestMove||'')&&['Mistake','Blunder'].includes(event.label)&&event.side===(row.white?'White':'Black'));
    checked.set(row.key,{row,facts:valid?facts:null});
  }
  const rows=dated.filter(row=>row.pool===pool),week=rows.filter(row=>row.end>=now-COACH_WINDOW),previous=rows.filter(row=>row.end<now-COACH_WINDOW);
  const inspected=week.filter(row=>checked.has(row.key)),eligible=week.map(row=>checked.get(row.key)).filter(review=>review?.facts);
  const current=record(week),prior=record(previous),coverage={games:week.length,inspected:inspected.length,reviewed:eligible.length,unavailable:inspected.length-eligible.length,unchecked:week.length-inspected.length};
  const actions=[],used=new Set();
  function add(action,key){action.id=identity(action.kind,pool,key);action.completed=completed(progress?.[action.id],now);actions.push(action);if(action.target?.key)used.add(action.target.key);}
  const patterns=engineWeaknesses(eligible,{now}).filter(finding=>['mate','capture','blunders'].includes(finding.kind)).sort((a,b)=>b.games-a.games||['mate','capture','blunders'].indexOf(a.kind)-['mate','capture','blunders'].indexOf(b.kind));
  const pattern=patterns[0],moments=eligible.flatMap(review=>review.facts.events.map(event=>({...event,key:review.row.key,opponent:review.row.opponent,end:review.row.end})));
  const history=event=>{
    const value=trainingProgress?.[event.fen+'|'+event.bestMove],valid=Number.isFinite(value?.solvedAt)&&value.solvedAt>0&&value.solvedAt/1000<=now&&Number.isSafeInteger(value.correct)&&value.correct>0;
    const known=valid&&Number.isSafeInteger(value.assisted)&&value.assisted>=0&&value.assisted<=value.correct;
    return {solved:valid,assistanceKnown:known,unassisted:known&&value.correct>value.assisted};
  };
  const choices=pattern?moments.filter(event=>pattern.kind==='blunders'?event.label==='Blunder':event.theme===pattern.kind):moments;
  const moment=choices.find(event=>!history(event).unassisted)||choices[0];
  if(moment){
    const past=history(moment);
    add({kind:'practice',source:'engine-review',title:past.unassisted?'Revisit a solved position':pattern?.kind==='mate'?'Find the missed mate':pattern?.kind==='capture'?'Look again at a stronger capture':'Revisit one verified decision',
      text:pattern?`${pattern.kind==='mate'?'A missed checkmate':pattern.kind==='capture'?'A stronger capture':'A verified blunder'} appears in ${pattern.games} of ${pattern.denominator} eligible reviewed ${pool} games this week.`:'One saved, engine-verified moment to study. One game does not establish a recurring weakness.',
      evidence:pattern?`${pattern.games} supporting / ${pattern.denominator} reviewed games · depth ≥${pattern.depth}`:`1 supporting game · depth ≥${moment.depth}`,
      practiceStatus:past.solved?(past.unassisted?'Previously solved without reveal':past.assistanceKnown?'Previously solved with help':'Previous solve recorded'):'',target:moment,practice:{...moment,id:moment.fen+'|'+moment.bestMove,gameKey:moment.key,trainingUser:user}},moment.fen+'|'+moment.bestMove);
  }
  const opening=openingGroups(week,pool).filter(group=>group.name.trim()&&group.known>=5&&group.losses>=3&&group.score<=40).sort((a,b)=>a.score-b.score||b.known-a.known||a.name.localeCompare(b.name))[0];
  if(opening){
    const row=opening.rows.find(row=>row.result==='L'&&!used.has(row.key))||opening.rows.find(row=>row.result==='L');
    add({kind:'opening',source:'game-history',title:`Explore ${opening.name}`,
      text:`Review the opening as ${opening.white?'White':'Black'}: ${opening.wins}W / ${opening.draws}D / ${opening.losses}L in ${opening.known} known ${pool} results this week. Results alone do not identify the cause.`,
      evidence:`${Math.round(opening.score)}% score · ${opening.known} completed games · ${opening.white?'White':'Black'}`,target:row},[opening.name,opening.white]);
  }
  const gap=week.find(row=>!checked.get(row.key)?.facts&&!used.has(row.key));
  if(gap)add({kind:'review',source:'review-coverage',title:checked.has(gap.key)?'Complete one game review':'Choose a recent game to review',
    text:checked.has(gap.key)?'This checked game has no eligible saved review for the plan. Review it with Fast or deeper analysis, then check the saved evidence again.':'The saved review for this game has not been checked. Open it and choose one decision worth understanding.',
    evidence:`${coverage.reviewed} eligible reviews / ${coverage.games} saved ${pool} games this week`,target:gap},gap.key);
  if(actions.length<3){
    const reflection=week.find(row=>row.result==='W'&&!used.has(row.key))||week.find(row=>!used.has(row.key));
    if(reflection)add({kind:'reflect',source:'game-history',title:reflection.result==='W'?'Explain one decision from a win':'Write down one lesson from a game',
      text:'Replay this saved game. Choose one decision and explain what you were trying to achieve before consulting the engine.',evidence:`1 source game · ${pool} · a study prompt, not a skill diagnosis`,target:reflection},reflection.key);
  }
  return {user,pool,now,start:now-COACH_WINDOW,previousStart:now-2*COACH_WINDOW,current,previous:prior,coverage,actions:actions.slice(0,3),
    comparison:current.known>=COACH_COMPARISON_MIN&&prior.known>=COACH_COMPARISON_MIN?{delta:current.score-prior.score,current:current.score,previous:prior.score}:null,
    pools:COMPARISON_POOLS.map(name=>({pool:name,games:dated.filter(row=>row.pool===name&&row.end>=now-COACH_WINDOW).length}))};
}
