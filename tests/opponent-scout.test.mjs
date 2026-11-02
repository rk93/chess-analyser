import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOpponentScout, reliableGameDuration, SCOUT_GAME_LIMIT } from '../js/opponent-scout-core.js';
import { selectSample } from '../js/comparison-intelligence.js';
const now = 1800000000, DAY = 86400;
function game(i, { white = true, result = 'win', opening = 'Italian Game', pool = 'rapid', age = i, pgn, ...rest } = {}) {
  const player = { username:'alice', result, rating:1400 }, opponent = { username:'bob', result:result === 'win' ? 'resigned' : 'win', rating:1500 };
  return { url:'scout-' + i, end_time:now - age * DAY, time_class:pool, rules:'chess', white:white ? player : opponent, black:white ? opponent : player,
    pgn:pgn ?? `[Opening "${opening}"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6`, ...rest };
}
const rows = games => selectSample(games, 'alice', { now, days:'all' });
const build = (games, lines = []) => buildOpponentScout(rows(games), lines, { pool:'rapid', now });
const moves = ['e2e4','e7e5','g1f3','b8c6','f1c4','g8f6'];
const sans = ['e4','e5','Nf3','Nc6','Bc4','Nf6'];
const line = i => ({ key:'scout-' + i, ucis:moves, sans });

test('Scout separates colour, format and sample, with exactly three honest preparation actions', () => {
  const games = Array.from({length:10}, (_, i) => game(i, {white:i < 5, result:'resigned'}));
  games.push(...Array.from({length:30}, (_, i) => game(20 + i, {pool:'bullet'})));
  const model = build(games);
  assert.equal(model.assessed, 10); assert.equal(model.white.games, 5); assert.equal(model.black.games, 5);
  assert.equal(model.recommendations.length, 3); assert.ok(model.recommendations.every(item => item.supported));
  assert.equal(model.difficult.known, 5); assert.equal(model.difficult.score, 0);
  assert.equal(model.recommendations[0].evidence.games, 5);
  assert.match(model.recommendations[2].text, /do not prove an engine-evaluated weakness/);
});
test('four outcomes, missing metadata and unknown results never establish an opening recommendation', () => {
  const games = Array.from({length:4}, (_, i) => game(i));
  games.push(game(5, {result:'unknown'}));
  const model = build(games);
  assert.equal(model.commonWhite.games, 5); assert.equal(model.commonWhite.eligible, false);
  assert.equal(model.recommendations[0].supported, false); assert.equal(model.totals.unknown, 1);
  assert.equal(build([game(0, {pgn:'1. e4 e5'})]).commonWhite, null);
  assert.equal(build([]).recommendations.length, 3);
});
test('exact six-ply lines need three distinct games of the same colour and format', () => {
  const games = [game(0), game(1), game(2), game(3, {white:false}), game(4, {pool:'bullet'})];
  const model = build(games, [line(0), line(0), line(1), line(2), line(3), line(4), line(999)]);
  assert.equal(model.lines.length, 1); assert.equal(model.lines[0].games, 3);
  assert.equal(model.parsed, 4); assert.equal(model.recommendations[2].line.games, 3);
  assert.equal(build(games, [line(0), line(1)]).lines.length, 0);
});
test('short or malformed lines cannot be used as opening sequence evidence', () => {
  const games = [game(0), game(1), game(2)];
  const model = build(games, [line(0), { ...line(1), ucis:['bad', ...moves.slice(1)] }, { ...line(2), sans:['e4'] }]);
  assert.equal(model.parsed, 1); assert.equal(model.lines.length, 0);
});
test('scouting stays bounded to the newest 200 games of the selected format', () => {
  const games = Array.from({length:250}, (_, i) => game(i, {age:i / 10}));
  const model = build(games, [line(0), line(1), line(201)]);
  assert.equal(model.available, 250); assert.equal(model.assessed, SCOUT_GAME_LIMIT);
  assert.equal(model.parsed, 2); assert.equal(model.evidence.games, 200);
});
test('duration needs an explicit UTC start, actual end and a valid calendar date', () => {
  const end = Date.UTC(2026, 10, 2, 0, 10) / 1000;
  const duration = pgn => reliableGameDuration({pgn, end_time:end});
  assert.equal(duration('[UTCDate "2026.11.01"]\n[UTCTime "23:50:00"]'), 1200);
  assert.equal(duration('[Date "2026.11.01"]\n[StartTime "23:50:00"]\n[Timezone "UTC"]'), 1200);
  assert.equal(duration('[Date "2026.11.01"]\n[StartTime "23:50:00"]'), null);
  assert.equal(duration('[UTCDate "2026.02.30"]\n[UTCTime "23:50:00"]'), null);
  assert.equal(duration('[UTCDate "2026.11.01"]\n[UTCTime "24:00:00"]'), null);
  assert.equal(duration('[UTCDate "2026.11.02"]\n[UTCTime "00:11:00"]'), null);
  assert.equal(reliableGameDuration({pgn:'[UTCDate "2024.02.29"]\n[UTCTime "00:00:00"]',end_time:Date.UTC(2024,1,29,0,5)/1000}), 300);
  assert.equal(reliableGameDuration({pgn:'[UTCDate "2025.02.29"]\n[UTCTime "00:00:00"]',end_time:end}), null);
  assert.equal(reliableGameDuration({pgn:'[TimeControl "600"]',end_time:end}), null);
});
test('duration median requires five independently timestamped games and uses actual elapsed seconds', () => {
  const dated = Array.from({length:5}, (_, i) => game(i, {pgn:'[UTCDate "2026.11.01"]\n[UTCTime "23:00:00"]', end_time:Date.UTC(2026,10,1,23,i+1)/1000}));
  assert.equal(build(dated.slice(0,4)).duration.medianSeconds, null);
  assert.equal(build(dated).duration.medianSeconds, 180);
  assert.equal(build(dated).duration.games, 5);
});
test('recent versus previous score requires ten known outcomes in both non-overlapping windows', () => {
  const games = Array.from({length:10}, (_, i) => game(i, {age:i, result:'win'}));
  games.push(...Array.from({length:10}, (_, i) => game(10+i, {age:31+i, result:'resigned'})));
  const model = build(games);
  assert.equal(model.performance.scoreChange, 100);
  assert.equal(build(games.slice(1)).performance.scoreChange, null);
  assert.equal(build(games.map(g => g.url === 'scout-10' ? {...g,white:{...g.white,result:'unknown'}} : g)).performance.scoreChange, null);
  const boundary = build([game(100, {age:30}), game(101, {age:60})]);
  assert.equal(boundary.performance.recent.games, 1); assert.equal(boundary.performance.previous.games, 1);
});
test('repertoire changes require sufficient named openings per colour in each date window', () => {
  const games = Array.from({length:10}, (_, i) => game(i, {age:i,opening:'Sicilian Defense'}));
  games.push(...Array.from({length:10}, (_, i) => game(10+i, {age:31+i,opening:'Italian Game'})));
  const model = build(games);
  assert.equal(model.repertoireChanges[0].name, 'Sicilian Defense');
  assert.equal(model.repertoireChanges[0].delta, 100); assert.equal(model.repertoireChanges[0].count, 10);
  assert.equal(build(games.slice(1)).repertoireChanges.length, 0);
  assert.equal(build(games.map((g,i) => i>=10 ? {...g,white:g.black,black:g.white} : g)).repertoireChanges.length, 0);
});
test('only explicit timeout losses count, with a ten-outcome and three-loss minimum', () => {
  const games = Array.from({length:10}, (_, i) => game(i, {result:i < 3 ? 'timeout' : 'resigned'}));
  const model = build(games);
  assert.equal(model.timeouts.games, 3); assert.equal(model.timeouts.rate, 30);
  assert.equal(build(games.slice(1)).timeouts.rate, null);
  assert.equal(build(games.map(g=>({...g,white:{...g.white,result:'resigned'}}))).timeouts.games, 0);
});
