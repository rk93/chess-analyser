import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile('js/game-review.js','utf8');
const styles=await readFile('review-experience.css','utf8');

test('review autoplay advances every three seconds and only when enabled',()=>{
  assert.match(source,/const AUTO_PLAY_MS=300/);
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

test('premium transport layout preserves accessible 48px targets and mobile safe areas',()=>{
  assert.match(styles,/Premium review transport/);
  assert.match(styles,/min-height:48px/);
  assert.match(styles,/grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
  assert.match(styles,/env\(safe-area-inset-bottom\)/);
  assert.match(styles,/prefers-reduced-motion:reduce/);
  assert.match(styles,/:focus-visible/);
});

test('autoplay attaches to an existing review card instead of silently returning',()=>{
  const fn=source.slice(source.indexOf('function ensureGuideCard(){'),source.indexOf('function ensureAutoBestLine(){'));
  assert.match(fn,/if\(card\)\{ensureVoiceControl\(card\);ensureAutoPlayControls\(card\);(?:positionReviewCard\(\);)?return card;\}/);
});
test('service worker revalidates CSS and JS instead of indefinitely serving stale UI',async()=>{
  const sw=await readFile('sw.js','utf8');
  assert.match(sw,/chess-analyser-pages-v83/);
  assert.match(sw,/cache:'no-cache'/);
  assert.match(sw,/if\(asset\)\{e\.respondWith\(fetch/);
});

test('mobile review puts board before commentary while leaving desktop unchanged',()=>{
 assert.match(source,/function positionReviewCard\(\)/);
 assert.match(source,/shell\.after\(card\)/);
 assert.match(source,/shell\.before\(card\)/);
 assert.match(source,/addEventListener\('resize',positionReviewCard/);
});
