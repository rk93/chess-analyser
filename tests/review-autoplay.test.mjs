import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile('js/game-review.js','utf8');
const styles=await readFile('review-experience.css','utf8');

test('review autoplay advances every three seconds and only when enabled',()=>{
  assert.match(source,/const AUTO_PLAY_MS=3000/);
  assert.match(source,/setTimeout\(\(\)=>\{/);
  assert.match(source,/\$\('next'\)\?\.click\(\)/);
  assert.match(source,/if\(!autoPlaying\|\|document\.hidden\|\|!activeReview\)/);
});

test('autoplay stops at game boundaries, reset and hidden tabs',()=>{
  assert.match(source,/currentPly\(\)>=preparedSans\.length/);
  assert.match(source,/function resetReviewUI\(\)\{stopAutoPlay\(\)/);
  assert.match(source,/visibilitychange/);
  assert.match(source,/if\(document\.hidden\)stopAutoPlay\(\)/);
});

test('autoplay has accessible pause and progress controls',()=>{
  assert.match(source,/aria-pressed/);
  assert.match(source,/aria-label/);
  assert.match(source,/reviewPlaybackProgress/);
  assert.match(styles,/\.reviewPlaybackButton/);
  assert.match(styles,/:focus-visible/);
  assert.match(styles,/prefers-reduced-motion/);
});

test('coach narration drives autoplay rather than interrupting speech',()=>{
  assert.match(source,/utterance\.onend=finished/);
  assert.match(source,/utterance\.onerror=finished/);
  assert.match(source,/queueAutoPlay\(COACH_PAUSE_MS\)/);
  assert.match(source,/voiceEnabled&&spokenPending/);
  assert.match(source,/COACH_MAX_WAIT_MS=45000/);
  assert.match(source,/generation!==autoPlayGeneration/);
});
test('pause and game reset invalidate stale voice completion callbacks',()=>{
  assert.match(source,/spokenGeneration\+\+;spokenPending=false;spokenPly=-1/);
  assert.match(source,/generation!==spokenGeneration/);
  assert.match(source,/if\('speechSynthesis' in window\)window\.speechSynthesis\.cancel\(\)/);
});
