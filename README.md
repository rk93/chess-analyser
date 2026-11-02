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

Public player comparisons are available in **Analytics → Friends & Players**. Fetching is explicit, sequential and limited to three monthly archives per player. Samples are cached for 24 hours, retain up to 6,000 games and stay separate from the Games library. Comparisons disclose their date ranges and sample sizes; they do not establish which player is stronger.

See [PRODUCT-ROADMAP.md](PRODUCT-ROADMAP.md) for implemented increments, evidence requirements and planned features.

Imported games and review data are stored locally in the browser. Clearing site data will remove that local data.

This is a personal/open-source project and is not affiliated with Chess.com or Lichess.
