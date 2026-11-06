import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm';
import { readSavedReview } from './saved-review.js';
import { playerGames } from './player-insights.js';
import { getLocalStockfish } from './local-stockfish.js';
import { verifiedPracticeCandidates, recordTrainingAttempt } from './personal-training-core.js';
import { classifyTacticalMotif } from './tactical-motifs.js';
import { reliableReview } from './weakness-core.js';

const $ = id => document.getElementById(id);
let generation = 0, practiceGeneration=0, exercises = [], trainingUser = '', activePractice = null;
const username = () => (localStorage.getItem('chess-username') || '').trim().toLowerCase();
const progressKey = user => `chess-personal-training:${user}`;
function readProgress(user) {
  try { const data = JSON.parse(localStorage.getItem(progressKey(user)) || '{}'); return data && typeof data === 'object' && !Array.isArray(data) ? data : {}; }
  catch { return {}; }
}
export {readProgress as readPersonalTrainingProgress};
function renderProgress() {
  const progress = readProgress(trainingUser), records = Object.values(progress);
  const attempts = records.reduce((n, row) => n + (Number(row?.attempts) || 0), 0);
  const solved = records.filter(row => row?.solvedAt).length;
  $('homeTrainingProgress').textContent = attempts ? `${solved} ${solved===1?"position":"positions"} solved · ${attempts} ${attempts===1?"attempt":"attempts"}, saved on this device. Revealed answers count as assisted practice.` : 'Your practice progress stays on this device.';
}
function describeBest(fen, uci, completeReview) {
  const board = new Chess(fen), move = board.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  if (!move) return null;
  const motif=completeReview?classifyTacticalMotif(fen,uci,value=>new Chess(value)):null;
  return { san: move.san, theme: move.san.includes('#') ? 'Missed checkmate' : motif?.title || (move.captured ? 'Missed capture' : 'Stronger move'),motif };
}

export function invalidatePersonalTraining() {
  generation++; exercises = []; trainingUser = username();
  if(activePractice?.user !== trainingUser) activePractice = null;
  if (!$('homeTrainingStatus')) return;
  $('homeTrainingStatus').textContent = 'Find exercises in the most recent 60 saved games with verified reviews. No new analysis runs until you practise.';
  $('homeTrainingList').replaceChildren();
  $('homeFindTraining').disabled = false;
  renderProgress();
}

export async function startExercise(exercise, button, {onStatus,signal}={}) {
  const user = username();
  if(exercise.trainingUser&&exercise.trainingUser!==user)return;
  const token=generation,attempt=++practiceGeneration;
  trainingUser=user;
  const status=(message,phase='checking')=>{if($('homeTrainingStatus'))$('homeTrainingStatus').textContent=message;onStatus?.(message,phase);};
  button.disabled = true;
  status('Checking this solution again with local Stockfish…');
  try {
    const result = await getLocalStockfish().analyse(exercise.fen, { depth: 12, multipv: 1, clearHash: true,signal });
    signal?.throwIfAborted();
    if (token !== generation || attempt!==practiceGeneration || user !== username() || $('homeView').hidden) return;
    if (!Number.isFinite(result.cp) || result.depth < 12 || result.best !== exercise.bestMove) throw new Error('A deeper search changed this recommendation. Review the source game again before practising it.');
    activePractice = { id: exercise.id, user };
    status('Solution checked with Stockfish at depth 12. Return here for another exercise.','ready');
    $('boardLabTab')?.click();
    window.dispatchEvent(new CustomEvent('practiceMistake', { detail: { ...exercise, trainingId: exercise.id, trainingUser: user } }));
  } catch (error) {
    if (token === generation && attempt===practiceGeneration && user === username()&&!$('homeView').hidden) status(error.name==='AbortError'?'Practice check paused.':error.message || 'Could not verify the solution. Try again.','error');
  } finally { button.disabled = false; }
}

export async function findPersonalTraining(games) {
  const user = username(), token = ++generation;
  window.dispatchEvent(new Event('personalTrainingScanStarted'));
  trainingUser = user; exercises = [];
  const button = $('homeFindTraining'), list = $('homeTrainingList');
  button.disabled = true; list.replaceChildren();
  $('homeTrainingStatus').textContent = 'Checking saved reviews…';
  try {
    let reviewed = 0;
    const rows = playerGames(games, user).slice(0, 60), seen = new Set();
    for (const [index, row] of rows.entries()) {
      if (token !== generation || user !== username()) return;
      try {
        const { moves, data } = await readSavedReview(row);
        if (data?.verifiedReviewVersion === 1) reviewed++;
        const completeReview=reliableReview(data,moves);
        for (const exercise of verifiedPracticeCandidates(moves, data, row.white)) {
          if (seen.has(exercise.id)) continue;
          const index=moves.findIndex(move=>move.before===exercise.fen&&move.san===exercise.badMove);
          const positiveLoss=index>=0&&(data.evals[index]-data.evals[index+1])*(row.white?1:-1)>0;
          const best = describeBest(exercise.fen, exercise.bestMove,completeReview&&positiveLoss);
          if (!best) continue;
          seen.add(exercise.id);
          exercises.push({ ...exercise, bestSan: best.san, theme: best.theme,motif:best.motif, gameKey: row.key, opponent: row.opponent });
        }
      } catch { /* Invalid PGNs or old reviews cannot supply verified exercises. */ }
      if (index % 5 === 4) await new Promise(resolve => setTimeout(resolve, 0));
    }
    if (token !== generation || user !== username()) return;
    const patterns = new Map();
    for (const exercise of exercises) {
      if (!patterns.has(exercise.theme)) patterns.set(exercise.theme, new Set());
      patterns.get(exercise.theme).add(exercise.gameKey);
    }
    const repeated = [...patterns].find(([theme, ids]) => theme !== 'Stronger move' && ids.size >= 3);
    $('homeTrainingStatus').textContent = `${exercises.length} distinct verified practice ${exercises.length===1?"position":"positions"} from ${reviewed} saved ${reviewed===1?"review":"reviews"}, checking ${rows.length} recent games.${repeated ? ` ${repeated[0]} appears in ${repeated[1].size} different games: start there.` : ''}${!exercises.length ? ' Run a complete Game Review on a recent game, then check again.' : ''}`;
    const progress = readProgress(user);
    exercises.sort((a, b) => Number(!!progress[a.id]?.solvedAt) - Number(!!progress[b.id]?.solvedAt));
    for (const exercise of exercises.slice(0, 8)) {
      const card = document.createElement('button'); card.type = 'button'; card.className = 'homePracticeCard';
      card.textContent = `${exercise.theme} · ${exercise.side} move ${exercise.moveNumber} vs ${exercise.opponent}${progress[exercise.id]?.solvedAt ? ' · solved' : ''} →`;
      card.onclick = () => void startExercise(exercise, card);
      list.appendChild(card);
    }
    renderProgress();
  } catch {
    if (token === generation) $('homeTrainingStatus').textContent = 'Saved reviews are temporarily unavailable. Try again.';
  } finally { if (token === generation) button.disabled = false; }
}

window.addEventListener('personalTrainingAttempt', event => {
  const { trainingId, trainingUser: user, correct, revealed } = event.detail || {};
  if (!user || user !== username() || activePractice?.user !== user || activePractice.id !== trainingId) return;
  const progress = readProgress(user);
  progress[trainingId] = recordTrainingAttempt(progress[trainingId], { correct: correct === true, revealed: revealed === true });
  try { localStorage.setItem(progressKey(user), JSON.stringify(progress)); renderProgress(); }
  catch { $('homeTrainingProgress').textContent = 'Practice completed. Storage is full or unavailable, so this attempt could not be saved.'; }
});
