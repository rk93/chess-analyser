import test from 'node:test';
import assert from 'node:assert/strict';
import { safeArchives } from '../js/player-comparison.js';
test('public comparison accepts only same-player Chess.com HTTPS archives and limits to three months', () => {
  const urls = [1, 2, 3, 4].map(month => `https://api.chess.com/pub/player/alice/games/2026/0${month}`);
  assert.deepEqual(safeArchives([...urls, urls[3]], 'alice'), urls.slice(1));
});
test('untrusted archive destinations, credentials, invalid months and mismatched users are rejected', () => {
  const urls = ['http://api.chess.com/pub/player/alice/games/2026/01', 'https://other.test/pub/player/alice/games/2026/01',
    'https://api.chess.com/pub/player/bob/games/2026/01', 'https://api.chess.com/pub/player/alice/games/2026/13',
    'https://user:password@api.chess.com/pub/player/alice/games/2026/01', 'https://api.chess.com/pub/player/alice/games/2026/01?redirect=1', 'not-a-url'];
  assert.deepEqual(safeArchives(urls, 'alice'), []);
  assert.throws(() => safeArchives({}, 'alice'), /invalid archive/);
});
