import {seedTacticalMotifs,FORK_FEN,PIN_FEN} from './tactical-motif-fixtures.mjs';
export const FORK_POSITION=FORK_FEN+'|c4d6';
export async function seedPracticePlan(page,{mode='ready',resume=false,revealed=false,realEngine=false}={}){
  await seedTacticalMotifs(page,{realEngine});
  await page.evaluate(async({mode,resume,revealed,fork,pin})=>{
    const {recordTrainingAttempt}=await import('/js/personal-training-core.js'),now=Date.now(),day=86400000;
    const at=(id,position,age,options={})=>({id,position,at:now-age*day,correct:true,revealed:false,pool:'rapid',theme:'knight-fork',...options});
    let events=mode==='empty'?[]:mode==='upcoming'?[at('new:first',fork,0)]:[at('old:first',fork,80),at('due:fork',fork,2,{correct:false})];
    if(mode==='ready')events.push(at('due:pin',pin,8,{theme:'absolute-pin'}),at('new:opening','rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1|e2e4',0,{theme:'alternative',pool:'blitz'}));
    events.sort((a,b)=>a.at-b.at);const progress={};for(const event of events)progress[event.position]=recordTrainingAttempt(progress[event.position],event,event.at);
    if(events.length)localStorage.setItem('chess-practice-history:alpha',JSON.stringify({version:1,startedAt:events[0].at,retainedFrom:events[0].at,events}));else localStorage.removeItem('chess-practice-history:alpha');
    localStorage.setItem('chess-personal-training:alpha',JSON.stringify(progress));
    if(resume)localStorage.setItem('chess-practice-resume:alpha',JSON.stringify({version:1,position:fork,updatedAt:now,pool:'rapid',theme:'knight-fork',revealed}));else localStorage.removeItem('chess-practice-resume:alpha');
  },{mode,resume,revealed,fork:FORK_POSITION,pin:PIN_FEN+'|d1e1'});
  await page.reload();await page.locator('#homeMetrics strong').first().filter({hasText:'7'}).waitFor();
}
