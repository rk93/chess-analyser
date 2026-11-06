// All screen visibility is owned here. Review content and asynchronous engine
// callbacks may update their own UI, but cannot decide whether global tabs show.
export const SCREENS={
  home:{view:'homeView',tab:'homeDashboardTab'},
  games:{view:'libraryView',tab:'gamesTab'},
  lab:{view:'boardLabView',tab:'boardLabTab'},
  explorer:{view:'explorerView',tab:'explorerTab'},
  puzzles:{view:'puzzlesView',tab:'puzzlesTab'},
  analytics:{view:'analyticsView',tab:'analyticsTab'},
  topPlayers:{view:'topPlayersView',tab:'topPlayersTab'},
  settings:{view:'settingsView',tab:'settingsNav'},
  review:{view:'analysisView',tab:null},
};
let screen='games';
export const currentScreen=()=>screen;
export const inGameReview=()=>screen==='review';

export function showScreen(next){
  if(!Object.hasOwn(SCREENS,next)||!document.getElementById(SCREENS[next].view))return false;
  const previous=screen;screen=next;
  document.documentElement.dataset.chessScreen=next;
  for(const [name,{view}] of Object.entries(SCREENS)){
    const node=document.getElementById(view);if(!node)continue;
    node.hidden=name!==next;
    // Retain the established Review layout API; other views use [hidden].
    if(name==='review')node.style.display=name===next?'block':'none';
    else node.style.removeProperty('display');
  }
  document.querySelectorAll('.homeTabs .homeTab').forEach(button=>{
    const selected=button.id===SCREENS[next].tab;
    button.classList.toggle('active',selected);
    if(selected)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
  });
  if(previous!==next)window.dispatchEvent(new CustomEvent('appScreenChanged',{detail:{previous,screen:next}}));
  return true;
}
