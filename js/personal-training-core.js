const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

export function verifiedPracticeCandidates(moves, data, white) {
  if (data?.verifiedReviewVersion !== 1 || data.labels?.length !== moves.length || data.evals?.length !== moves.length + 1) return [];
  const out = [];
  moves.forEach((move, i) => {
    const bestMove = data.bestMoves?.[i], played = move.from + move.to + (move.promotion || '');
    // The practice board currently promotes automatically to a queen.
    if (bestMove?.length === 5 && bestMove[4] !== 'q') return;
    if (move.color !== (white ? 'w' : 'b') || !['Mistake', 'Blunder'].includes(data.labels[i]) || !UCI.test(bestMove || '') || bestMove === played) return;
    if (data.moveVerified?.[i] !== true || data.positionExact?.[i] !== true || data.positionExact?.[i + 1] !== true) return;
    if (!Number.isFinite(data.evals[i]) || !Number.isFinite(data.evals[i + 1]) || data.localDepths?.[i] < 8 || data.localDepths?.[i + 1] < 8) return;
    if (!Number.isFinite(data.localDepths?.[i]) || !Number.isFinite(data.localDepths?.[i + 1]) || !move.before) return;
    out.push({ id: `${move.before}|${bestMove}`, fen: move.before, bestMove, badMove: move.san,
      label: data.labels[i], side: white ? 'White' : 'Black', moveNumber: Number(move.before.split(' ')[5]) || Math.floor(i / 2) + 1 });
  });
  return out;
}

export function recordTrainingAttempt(previous, { correct, revealed = false }, now = Date.now()) {
  const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
  return { attempts: count(previous?.attempts) + 1, correct: count(previous?.correct) + (correct ? 1 : 0),
    assisted: count(previous?.assisted) + (correct && revealed ? 1 : 0),
    solvedAt: correct ? now : (previous?.solvedAt || null), updated: now };
}
