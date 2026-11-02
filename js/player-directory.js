import { playerGames } from './player-insights.js';

export function validPlayerName(value) {
  const name = String(value || '').trim().toLowerCase();
  return /^[a-z0-9_-]{1,50}$/.test(name) ? name : null;
}

export function readPlayerDirectory(storage, owner) {
  try {
    const value = JSON.parse(storage.getItem(`chess-player-directory:${validPlayerName(owner) || 'guest'}`) || '{}');
    const names = (input, limit) => [...new Set((Array.isArray(input) ? input : []).map(validPlayerName).filter(Boolean))].slice(0, limit);
    return { favourites: names(value?.favourites, 24), searches: names(value?.searches, 8) };
  } catch { return { favourites: [], searches: [] }; }
}

export function writePlayerDirectory(storage, owner, value) {
  const names = (input, limit) => [...new Set(input.map(validPlayerName).filter(Boolean))].slice(0, limit);
  const clean = { version: 1, favourites: names(value.favourites, 24), searches: names(value.searches, 8) };
  storage.setItem(`chess-player-directory:${validPlayerName(owner) || 'guest'}`, JSON.stringify(clean));
  return clean;
}

export function discoverPlayers(games, owner, directory, query = '') {
  const user = validPlayerName(owner), entries = new Map();
  function entry(raw) {
    const name = validPlayerName(raw);
    if (!name || name === user) return null;
    if (!entries.has(name)) entries.set(name, { name, sources: [], games: 0, lastSeen: 0, favourite: false });
    return entries.get(name);
  }
  for (const name of directory.favourites) {
    const row = entry(name); if (row) { row.sources.push('Favourite'); row.favourite = true; }
  }
  for (const name of directory.searches) { const row = entry(name); if (row) row.sources.push('Recent search'); }
  for (const game of playerGames(games, user)) {
    const row = entry(game.opponent); if (!row) continue;
    row.games++; row.lastSeen = Math.max(row.lastSeen, game.end || 0);
    if (!row.sources.includes('Recent opponent')) row.sources.push('Recent opponent');
  }
  const needle = String(query).trim().toLowerCase();
  return [...entries.values()].filter(row => row.name.includes(needle))
    .sort((a, b) => Number(b.favourite) - Number(a.favourite) || b.lastSeen - a.lastSeen || b.games - a.games || a.name.localeCompare(b.name)).slice(0, 12);
}
