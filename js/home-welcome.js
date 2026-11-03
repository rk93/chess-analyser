import {FEEDBACK_PREFIX} from './feedback-core.js';
import {playFeedback,feedbackPulse} from './feedback.js';
const SEEN='chess-pip-welcome-v1';
export function mountHomeWelcome(view) {
  let seen=false,savedSound=null;
  try{seen=localStorage.getItem(SEEN)==='seen';savedSound=localStorage.getItem(FEEDBACK_PREFIX+'sound');}catch{}
  if(seen)return;
  const card=document.createElement('section');card.className='homeWelcome';card.id='homeWelcome';card.setAttribute('aria-labelledby','homeWelcomeTitle');
  card.innerHTML='<span class="coachAvatar coachWelcome homeWelcomePip" aria-hidden="true"></span><div><span class="homeEyebrow">A little adventure. A better next move.</span><h2 id="homeWelcomeTitle">Meet Pip, your chess companion.</h2><p>Explore your games, discover patterns and practise one useful idea at a time.</p><div class="homeWelcomeActions"><button type="button" class="btn primary" id="homeWelcomeSound" data-feedback-own>Begin with sound</button><button type="button" class="btn" id="homeWelcomeSilent" data-feedback-own>Continue silently</button></div><p id="homeWelcomeHint" class="homeDataNote">A short original musical welcome. Your volume setting applies.</p></div>';
  view.querySelector('.homeHero').after(card);
  const sound=card.querySelector('#homeWelcomeSound');
  if(savedSound==='off') {sound.disabled=true;card.querySelector('#homeWelcomeHint').textContent='Sound is off in your saved preferences. You can enable it in Settings.';}
  function finish(audible) {
    try {
      // An explicit existing choice is never replaced by onboarding.
      if(savedSound===null){const value=audible?'on':'off';localStorage.setItem(FEEDBACK_PREFIX+'sound',value);window.dispatchEvent(new CustomEvent('chessPreference',{detail:{key:'sound',value}}));}
      localStorage.setItem(SEEN,'seen');
    }catch{}
    window.removeEventListener('chessPreference',sync);
    card.remove();
    if(audible){void playFeedback('welcome',{context:'homeView',id:'pip-first-welcome'});feedbackPulse(view.querySelector('.homePip'));}
  }
  sound.addEventListener('click',()=>finish(true));
  card.querySelector('#homeWelcomeSilent').addEventListener('click',()=>finish(false));
  function sync(event){if(event.detail?.key==='sound'&&card.isConnected){savedSound=event.detail.value;sound.disabled=savedSound==='off';card.querySelector('#homeWelcomeHint').textContent=sound.disabled?'Sound is off in your saved preferences. You can enable it in Settings.':'A short original musical welcome. Your volume setting applies.';}}
  window.addEventListener('chessPreference',sync);
}
