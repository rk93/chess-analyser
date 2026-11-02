import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm';
import { cacheGet, simpleHash } from './analysis-store.js';

// Same cache identity as Game Review. Readers never start or modify analysis.
export async function readSavedReview(row) {
  const board = new Chess(); board.loadPgn(String(row.game.pgn || ''));
  const moves = board.history({verbose:true});
  const title = `${row.game.white.username} ${row.game.white.rating ?? ''} — ${row.game.black.username} ${row.game.black.rating ?? ''}`;
  const key = simpleHash(`${title}|${moves.map(move => move.san).join(' ')}`);
  return { moves, data:await cacheGet('review', key) };
}
