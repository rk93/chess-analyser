# Chess Analyser

A free, browser-based chess analysis and game-review app.

**Live app:** https://rk93.github.io/chess-analyser/

## What it does

- Import games from Chess.com
- Review complete games with local **Stockfish 19**
- Show accuracy, move classifications and evaluation swings
- Automatically show the best move during guided review
- Analyse any position or paste a PGN
- Explore openings, common continuations and similar database games
- Track rating, openings, opponents and other game-history analytics
- See personal Home insights: weekly results, colour scores, streaks and rating trends separated by time control
- Compare opening results with sample sizes and review a relevant saved game
- Practise verified mistakes from your own games, with fresh Stockfish solution checks and per-player progress
- Compare two players using saved games or a bounded, cached sample of public Chess.com archives
- Works well on desktop and mobile and can be installed as a PWA

## Import and sync in Settings

Use **Settings → Your game library** to sync your personal Chess.com account independently of Home. Manual sync checks the latest two active monthly archives and newly discovered months; automatic checks retain their 24-hour freshness guard. **All history** imports up to 12 additional months per action, with completed batches preserved after cancellation or failure. Imports add missing games without duplicates and refresh the app without a page reload.

**Import a public player** supports Chess.com and Lichess, including your own Lichess username. Public study collections have their own storage and never change your personal Chess.com account, Home statistics or ratings. Open a collection to filter its games and use the existing Game Review. Classical and correspondence are labelled separately. Each collection has Sync latest, Load older games and a confirmed Remove collection action.

Lichess uses its documented anonymous game export, streamed in batches of up to 300 finished standard-chess games. No password, access token or Explorer connection is required. Up to 12 study collections and 2,000 saved games per collection are retained on this device. Study data remains separate from Friends & Players comparison samples. Public APIs may delay publishing games or limit requests; the Settings tips explain cancellation, retry, storage limits and offline access. Importing itself does not run Stockfish.

## Game Review

Game Review analyses every position locally with Stockfish and compares the change in winning chances after each move.

Moves are classified as **Best, Great, Excellent, Good, Book, Inaccuracy, Mistake or Blunder**. Critical positions are searched more deeply, and guided review shows the engine move, tactical context and opening/database information where available.

## Running locally

This is a static web app, so no backend is required.

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

Run the regression tests with:

```bash
npm test
```

## Main technologies

Vanilla JavaScript · chess.js · Stockfish WASM · IndexedDB · Chess.com Public API · Lichess Opening Explorer · GitHub Pages

## Notes

Personal insights use only the selected player's saved standard-chess games. Rating trends use rated games and keep each time control separate. Unknown results are excluded from percentages. Opening comparisons need five completed games with the same opening, colour and time control; observed results do not establish an opening's intrinsic quality.

The weekly report covers a rolling seven-day window. Its rating changes require a saved observation from before that window; incomplete archives can produce incomplete reports. Personal practice checks up to 60 recent saved games for verified reviews, then rechecks each selected solution locally before teaching it. A changed recommendation requires the game to be reviewed again.

Public player comparisons are available in **Analytics → Friends & Players**. Your configured username is filled in automatically. Pick a recent opponent, search locally known usernames, or enter an exact new username. Favourites and recent searches are stored separately for each configured account. These suggestions are not imported Chess.com friends; no supported public friends-list integration has been verified.

The **Overview** compares Bullet, Blitz, Rapid and Daily without combining ratings across formats. Select a format for rating sparklines, recent form and colour scores. **Saved games**, **Public sample** and **Lifetime stats** remain distinct sources. Public profiles show recorded ratings and available avatars; lifetime statistics do not supply historical opening or rating trends.

Opening fingerprints show the most recorded White and Black groups, sample sizes, colour/format-specific outcomes and opponent-strength details. **Replay** opens the existing Analysis Board and its Forward/Back controls, with no automatic engine work. Head-to-head encounters are deduplicated within the available selection; finding none does not imply that the players have never met.

Fetching is explicit, cancellable, sequential and limited to three monthly archives per player. Cache freshness respects API response headers, with a 24-hour default. Samples retain up to 6,000 displayed games and stay separate from the Games library. Both players use the same selected date window, with actual sample coverage disclosed. Offline caches are labelled when stale. See [API research and evidence limits](docs/FRIENDS-DISCOVERY-RESEARCH.md).

See [PRODUCT-ROADMAP.md](PRODUCT-ROADMAP.md) for implemented increments, evidence requirements and planned features.

Imported games and review data are stored locally in the browser. Clearing site data will remove that local data.

This is a personal/open-source project and is not affiliated with Chess.com or Lichess.
