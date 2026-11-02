import { playerGames } from './player-insights.js';
export const PULSE_POOLS=['rapid','blitz','bullet','daily'];
const DAY=86400;
export function buildChessPulse(games,user,{now=Date.now()/1000}={}) {
  const rows=playerGames(games,user).filter(row=>row.end!==null&&row.end<=now&&row.rated&&row.rating!==null);
  return PULSE_POOLS.map(pool=>{
    const points=rows.filter(row=>row.pool===pool).reverse(),last=points.at(-1);
    const delta=days=>{const baseline=points.filter(point=>point.end<now-days*DAY).at(-1);return baseline&&last&&last.end>=now-days*DAY?last.rating-baseline.rating:null};
    return {pool,points,latest:last?.rating??null,best:points.length?points.reduce((best,point)=>Math.max(best,point.rating),-Infinity):null,weekly:delta(7),monthly:delta(30)};
  });
}
