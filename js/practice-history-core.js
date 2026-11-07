export const PRACTICE_DAY=86400000,PRACTICE_LIMIT=500,PRACTICE_RETENTION=90*PRACTICE_DAY;
const pools=new Set(['bullet','blitz','rapid','daily','unknown']);
const themes=new Set(['mate','capture','knight-fork','absolute-pin','alternative']);
const validEvent=(event,now)=>event&&typeof event.id==='string'&&/^[\w:-]{1,100}$/.test(event.id)&&typeof event.position==='string'&&event.position.length<=180&&/\|[a-h][1-8][a-h][1-8][qrbn]?$/.test(event.position)&&Number.isFinite(event.at)&&event.at>=0&&event.at<=now&&typeof event.correct==='boolean'&&typeof event.revealed==='boolean'&&pools.has(event.pool)&&themes.has(event.theme);
const empty=()=>({version:1,startedAt:null,retainedFrom:null,events:[],available:true});

export function readPracticeHistory(raw,{now=Date.now()}={}){
  if(raw==null)return empty();
  let data;try{data=typeof raw==='string'?JSON.parse(raw):raw}catch{return {...empty(),available:false}}
  if(data?.version===1&&data.startedAt===null&&data.retainedFrom===null&&Array.isArray(data.events)&&data.events.length===0&&data.available!==false)return empty();
  if(data?.version!==1||!Array.isArray(data.events)||!Number.isFinite(data.startedAt)||data.startedAt<0||data.startedAt>now||!Number.isFinite(data.retainedFrom)||data.retainedFrom<data.startedAt||data.retainedFrom>now)return {...empty(),available:false};
  if(data.events.length>5000||data.events.some(event=>!validEvent(event,now)||event.at<data.startedAt))return {...empty(),available:false};
  const seen=new Set(),events=data.events.filter(event=>{
    if(!validEvent(event,now)||event.at<data.startedAt||event.at<now-PRACTICE_RETENTION||seen.has(event.id))return false;
    seen.add(event.id);return true;
  }).sort((a,b)=>a.at-b.at);
  const dropped=events.slice(0,Math.max(0,events.length-PRACTICE_LIMIT));
  return {version:1,startedAt:data.startedAt,retainedFrom:Math.max(data.retainedFrom,now-PRACTICE_RETENTION,dropped.length?Math.min(now,dropped.at(-1).at+1):0),events:events.slice(-PRACTICE_LIMIT),available:true};
}

export function appendPracticeAttempt(raw,event,{now=Date.now()}={}){
  const history=readPracticeHistory(raw,{now});
  if(!history.available||!validEvent(event,now)||event.at<now-PRACTICE_RETENTION||history.events.some(old=>old.id===event.id)||history.startedAt!==null&&event.at<history.startedAt)return {history,changed:false};
  const startedAt=history.startedAt??event.at;
  const next={version:1,startedAt,retainedFrom:history.retainedFrom??startedAt,events:[...history.events,{id:event.id,position:event.position,at:event.at,correct:event.correct,revealed:event.revealed,pool:event.pool,theme:event.theme}]};
  return {history:readPracticeHistory(next,{now}),changed:true};
}

export function buildPracticeSummary(raw,{now=Date.now(),days=7,pool='all'}={}){
  days=days===30?30:7;
  const history=readPracticeHistory(raw,{now}),start=now-days*PRACTICE_DAY,previousStart=now-2*days*PRACTICE_DAY;
  const events=history.events.filter(event=>pool==='all'||event.pool===pool),current=events.filter(event=>event.at>=start),previous=events.filter(event=>event.at>=previousStart&&event.at<start);
  const positions=new Map();for(const event of current){if(!positions.has(event.position))positions.set(event.position,[]);positions.get(event.position).push(event)}
  let independent=0,assisted=0;for(const attempts of positions.values()){if(attempts.some(event=>event.correct&&!event.revealed))independent++;else if(attempts.some(event=>event.correct))assisted++;}
  const utc=value=>Math.floor(value/PRACTICE_DAY)*PRACTICE_DAY,buckets=[];
  for(let date=utc(start);date<=utc(now);date+=PRACTICE_DAY){
    const sample=current.filter(event=>utc(event.at)===date);
    buckets.push({date,attempts:sample.length,independent:sample.filter(event=>event.correct&&!event.revealed).length,assisted:sample.filter(event=>event.correct&&event.revealed).length,retries:sample.filter(event=>!event.correct).length,tracked:history.retainedFrom!==null&&date+PRACTICE_DAY>history.retainedFrom});
  }
  const first=sample=>{const out=new Map();for(const event of sample)if(!out.has(event.position))out.set(event.position,event);return out;};
  const a=first(current),b=first(previous),matched=[...a.keys()].filter(key=>b.has(key));
  const rate=(map)=>100*matched.filter(key=>map.get(key).correct&&!map.get(key).revealed).length/matched.length;
  const covered=history.retainedFrom!==null&&history.retainedFrom<=previousStart;
  const comparison=covered&&matched.length>=5?{positions:matched.length,current:rate(a),previous:rate(b),delta:rate(a)-rate(b)}:null;
  return {available:history.available,days,now,start,previousStart,startedAt:history.startedAt,retainedFrom:history.retainedFrom,partial:history.retainedFrom===null||history.retainedFrom>start,positions:positions.size,independent,assisted,pending:positions.size-independent-assisted,attempts:current.length,buckets,comparison,matched:matched.length};
}
