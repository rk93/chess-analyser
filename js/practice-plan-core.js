import {readPracticeHistory,PRACTICE_DAY as DAY,PRACTICE_RETENTION} from './practice-history-core.js';

export const REVISIT_INTERVALS=Object.freeze([1,3,7,14]);
const dayOf=at=>Math.floor(at/DAY);

// Reconstruct a conservative study schedule; no second progress database.
export function buildPracticePlan(raw,{now=Date.now()}={}){
  const history=readPracticeHistory(raw,{now});
  if(!history.available)return {available:false,ready:[],upcoming:[],positions:[],limited:false};
  const groups=new Map();
  for(const event of history.events){
    if(!groups.has(event.position))groups.set(event.position,new Map());
    const days=groups.get(event.position),day=dayOf(event.at);
    if(!days.has(day))days.set(day,[]);
    days.get(day).push(event);
  }
  const limited=history.startedAt!==null&&history.retainedFrom>history.startedAt,positions=[];
  for(const [position,days] of groups){
    let level=-1,nextAt=null,reason='clean',last;
    for(const [day,events] of days){
      last=events.at(-1);
      const incomplete=limited&&day<=dayOf(history.retainedFrom);
      if(incomplete||events.some(event=>!event.correct||event.revealed)){
        level=-1;nextAt=last.at+DAY;
        reason=incomplete?'limited':events.some(event=>event.revealed)?'revealed':'missed';
      }else if(nextAt===null||events[0].at>=nextAt){
        level=Math.min(level+1,REVISIT_INTERVALS.length-1);
        nextAt=events[0].at+REVISIT_INTERVALS[level]*DAY;reason='clean';
      }
      // Early clean practice leaves the existing interval and due date intact.
    }
    positions.push({position,pool:last.pool,theme:last.theme,lastAt:last.at,nextAt,level,intervalDays:level<0?1:REVISIT_INTERVALS[level],reason,ready:nextAt<=now});
  }
  positions.sort((a,b)=>a.nextAt-b.nextAt||a.lastAt-b.lastAt||a.position.localeCompare(b.position));
  return {available:true,positions,ready:positions.filter(row=>row.ready),upcoming:positions.filter(row=>!row.ready),limited};
}

const pools=new Set(['bullet','blitz','rapid','daily','unknown']),themes=new Set(['mate','capture','knight-fork','absolute-pin','alternative']);
function validReference(position){
  if(typeof position!=='string'||position.length>180)return false;
  const parts=position.split('|');if(parts.length!==2||! /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(parts[1]))return false;
  const fields=parts[0].split(' '),ranks=fields[0].split('/');
  return fields.length===6&&ranks.length===8&&ranks.every(rank=>/^[prnbqkPRNBQK1-8]+$/.test(rank)&&[...rank].reduce((n,char)=>n+(/[1-8]/.test(char)?Number(char):1),0)===8)&&/^[wb]$/.test(fields[1])&&/^(?:-|K?Q?k?q?)$/.test(fields[2])&&/^(?:-|[a-h][36])$/.test(fields[3])&&/^\d+$/.test(fields[4])&&/^[1-9]\d*$/.test(fields[5]);
}

export function readPracticeResume(raw,{now=Date.now()}={}){
  if(raw==null)return {available:true,entry:null};
  let value;try{value=typeof raw==='string'?JSON.parse(raw):raw}catch{return {available:false,entry:null}}
  if(value?.version!==1||!validReference(value.position)||!Number.isFinite(value.updatedAt)||value.updatedAt<0||value.updatedAt>now||!pools.has(value.pool)||!themes.has(value.theme)||typeof value.revealed!=='boolean')return {available:false,entry:null};
  if(value.updatedAt<now-PRACTICE_RETENTION)return {available:true,entry:null};
  return {available:true,entry:{version:1,position:value.position,updatedAt:value.updatedAt,pool:value.pool,theme:value.theme,revealed:value.revealed}};
}
