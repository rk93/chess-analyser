const $=id=>document.getElementById(id);
const cycle=new Map();

function moveEls(){return [...document.querySelectorAll('#moves .move')]}
function labelOf(el){return el.querySelector('.moveTag')?.textContent?.trim()||''}
function matchingMoves(label,side){return moveEls().map((el,i)=>({el,i})).filter(({el,i})=>labelOf(el)===label&&(side==='white'?i%2===0:i%2===1))}
function jumpTo(label,side){const matches=matchingMoves(label,side);if(!matches.length)return;const key=`${side}|${label}`,prev=cycle.get(key)||0,choice=matches[prev%matches.length];cycle.set(key,(prev+1)%matches.length);const screen=$('reviewSummaryScreen');if(screen)screen.hidden=true;choice.el.click();setTimeout(()=>{document.querySelector('#reviewGuideCard')?.scrollIntoView({behavior:'smooth',block:'start'})},40)}
function enhance(root=document){const box=root.querySelector?.('#reviewBreakdown')||$('reviewBreakdown');if(!box)return;box.querySelectorAll('.reviewBreakRow').forEach(row=>{const label=row.querySelector('.label')?.textContent?.trim();if(!label)return;[['.left','white'],['.right','black']].forEach(([sel,side])=>{const el=row.querySelector(sel);if(!el||el.dataset.reviewJump==='1')return;const count=Number(el.textContent)||0;el.dataset.reviewJump='1';el.dataset.label=label;el.dataset.side=side;el.classList.toggle('reviewBreakJump',count>0);el.setAttribute('role',count>0?'button':'text');if(count>0){el.tabIndex=0;el.title=`Go to ${side} ${label.toLowerCase()} move${count>1?' (tap again for next)':''}`;el.addEventListener('click',()=>jumpTo(label,side));el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();jumpTo(label,side)}})}})})}
function observe(){enhance();const obs=new MutationObserver(()=>enhance());obs.observe(document.body,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe);else observe();
