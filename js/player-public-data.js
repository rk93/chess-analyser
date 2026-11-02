import { cacheGet, cacheSet } from './analysis-store.js';
import { validPlayerName } from './player-directory.js';

const DAY = 86400000;
export function safeArchives(archives, user) {
  if (!Array.isArray(archives)) throw new Error('Chess.com returned an invalid archive list.');
  return [...new Set(archives.filter(raw => {
    try {
      const url = new URL(raw), match = url.pathname.match(/^\/pub\/player\/([a-z0-9_-]+)\/games\/\d{4}\/(0[1-9]|1[0-2])$/i);
      return url.origin === 'https://api.chess.com' && !url.username && !url.password && !url.search && !url.hash && match?.[1].toLowerCase() === user;
    } catch { return false; }
  }))].sort().slice(-3);
}

export function publicCachePolicy(headers, now) {
  const control = headers.get('cache-control') || '', age = Math.max(0, Number(headers.get('age')) || 0);
  const maxAge = control.match(/(?:^|,)\s*max-age=(\d+)/i)?.[1];
  const expires = Date.parse(headers.get('expires') || '');
  const ttl = maxAge === undefined ? (Number.isFinite(expires) ? Math.max(0, expires - now) : DAY) : Math.max(0, Number(maxAge) - age) * 1000;
  return { store: !/\bno-store\b/i.test(control), expiresAt: /\bno-cache\b/i.test(control) ? now : now + ttl };
}

export function createPublicPlayerClient({ fetcher = (...args) => fetch(...args), read = cacheGet, write = cacheSet, now = Date.now } = {}) {
  let queue = Promise.resolve(), retryAt = 0;
  async function resource(namespace, key, url, { signal, refresh = false, validate = value => !!value && typeof value === 'object' } = {}) {
    signal?.throwIfAborted();
    const saved = await read(namespace, key), current = now();
    const validSaved = saved && Number.isFinite(saved.updated) && saved.updated <= current && validate(saved.data);
    if (validSaved && !refresh && current < saved.expiresAt) return { data: saved.data, updated: saved.updated, cached: true, stale: false };
    const run = async () => {
      signal?.throwIfAborted();
      if (now() < retryAt) throw new Error('Please wait for the Chess.com rate limit to reset before trying again.');
      const timeout = AbortSignal.timeout(15000), combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
      const response = await fetcher(url, { headers: { Accept: 'application/json' }, signal: combined, cache: refresh ? 'no-cache' : 'default' });
      if (response.status === 429) {
        const raw = response.headers.get('retry-after');
        const seconds = raw && /^\d+$/.test(raw) ? Number(raw) : raw ? (Date.parse(raw) - now()) / 1000 : 60;
        retryAt = now() + Math.max(1, Number.isFinite(seconds) ? seconds : 60) * 1000;
        throw new Error('Chess.com is rate limiting requests. Please wait before trying again.');
      }
      if (!response.ok && !(response.status === 304 && validSaved)) throw new Error(response.status === 404 ? 'This public Chess.com player was not found.' : `Public data is unavailable (${response.status}). Saved games are unchanged.`);
      const data = response.status === 304 ? saved.data : await response.json();
      if (!validate(data)) throw new Error('Chess.com returned incomplete data. Try again later.');
      signal?.throwIfAborted();
      const updated = now(), policyHeaders = new Headers(response.headers);
      if(response.status===304){
        if(!policyHeaders.has('cache-control')&&saved.cacheControl)policyHeaders.set('cache-control',saved.cacheControl);
        if(!policyHeaders.has('expires')&&saved.cacheExpires)policyHeaders.set('expires',saved.cacheExpires);
      }
      const policy = publicCachePolicy(policyHeaders, updated);
      if (policy.store) await write(namespace, key, { version: 2, data, updated, expiresAt: policy.expiresAt, cacheControl:policyHeaders.get('cache-control'),cacheExpires:policyHeaders.get('expires') });
      else if(saved)await write(namespace,key,{version:2,data:null,updated,expiresAt:0});
      return { data, updated, cached: response.status === 304, stale: false };
    };
    const task = queue.catch(() => {}).then(run);
    queue = task.catch(() => {});
    try { return await task; }
    catch (error) {
      if (signal?.aborted || error.name === 'AbortError' || !validSaved || refresh) throw error;
      return { data: saved.data, updated: saved.updated, cached: true, stale: true, warning: error.message };
    }
  }
  function userName(raw) { const name = validPlayerName(raw); if (!name) throw new Error('Enter a valid Chess.com username.'); return name; }
  async function metadata(raw, options = {}) {
    const user = userName(raw), value = { user, profile: null, stats: null, updated: null, warnings: [], stale: false };
    for (const kind of ['profile', 'stats']) {
      try {
        const suffix = kind === 'stats' ? '/stats' : '';
        const result = await resource(`player-public-${kind}`, user, `https://api.chess.com/pub/player/${user}${suffix}`, { ...options,
          validate: data => data && typeof data === 'object' && !Array.isArray(data) && (kind === 'stats' || validPlayerName(data.username) === user) });
        value[kind] = result.data; value.updated = value.updated === null ? result.updated : Math.min(value.updated, result.updated);
        value.stale ||= result.stale; if (result.warning) value.warnings.push(result.warning);
      } catch (error) { if (options.signal?.aborted) throw error; value.warnings.push(error.message); }
    }
    return value;
  }
  async function sample(raw, options = {}) {
    const user = userName(raw), saved = await read('player-comparison', user), current = now();
    const savedValid = saved?.version === 1 && Array.isArray(saved.games) && Number.isFinite(saved.updated) && saved.updated <= current;
    if (!options.refresh && savedValid && current < saved.updated + DAY) return { ...saved, updated: saved.updated, cached: true, stale: false };
    options.signal?.throwIfAborted();
    try {
      const list = await resource('player-public-archives', user, `https://api.chess.com/pub/player/${user}/games/archives`, { ...options, validate: data => Array.isArray(data?.archives) });
      const archives = safeArchives(list.data.archives, user), games = [];
      let stale = list.stale, updated = list.updated;
      for (const [i, url] of archives.entries()) {
        options.onProgress?.(`Loading ${user}: month ${i + 1} of ${archives.length}…`);
        const month = await resource('player-public-month', url, url, { ...options, validate: data => Array.isArray(data?.games) && data.games.every(game => game && typeof game === 'object') });
        stale ||= month.stale; updated = Math.min(updated, month.updated);
        for (const game of month.data.games) games.push(game);
      }
      const data = { games: games.sort((a, b) => (b.end_time || 0) - (a.end_time || 0)).slice(0, 6000), archives: archives.length };
      // Keep the existing comparison namespace and old snapshots readable. HTTP
      // freshness stays at resource level so no-store/max-age aren't overridden.
      if (savedValid) await write('player-comparison', user, { version: 2, migrated: true });
      return { ...data, updated, cached: false, stale };
    } catch (error) {
      if (options.signal?.aborted || options.refresh || !savedValid) throw error;
      return { ...saved, cached: true, stale: true, warning: error.message };
    }
  }
  async function cachedMetadata(raw) {
    const user = userName(raw), profile = await read('player-public-profile', user), stats = await read('player-public-stats', user);
    return { user, profile: profile?.data || null, stats: stats?.data || null, updated: Math.min(profile?.updated || Infinity, stats?.updated || Infinity),
      stale: (profile?.expiresAt || Infinity) < now() || (stats?.expiresAt || Infinity) < now(), warnings: [] };
  }
  return { metadata, sample, cachedMetadata };
}
