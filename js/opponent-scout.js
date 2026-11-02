import { buildOpponentScout, SCOUT_GAME_LIMIT } from './opponent-scout-core.js';

export async function analyseOpponentScout(rows, { pool, signal, onProgress, now } = {}) {
  signal?.throwIfAborted();
  if (!rows.some(row => row.pool === pool)) return buildOpponentScout(rows, [], { pool, now });
  const { Chess } = await import('https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm');
  const games = rows.filter(row => row.pool === pool).slice(0, SCOUT_GAME_LIMIT), lines = [], initial = new Chess().fen();
  for (const [i, row] of games.entries()) {
    signal?.throwIfAborted();
    try {
      const board = new Chess(); board.loadPgn(String(row.game.pgn || ''));
      const moves = board.history({ verbose:true }).slice(0, 6);
      if (moves[0]?.before === initial) lines.push({ key:row.key, ucis:moves.map(move => move.from + move.to + (move.promotion || '')), sans:moves.map(move => move.san) });
    } catch { /* Unplayable PGNs cannot supply a claimed legal sequence. */ }
    if (i % 10 === 9) {
      onProgress?.(i + 1, games.length);
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  signal?.throwIfAborted();
  return buildOpponentScout(rows, lines, { pool, now });
}
