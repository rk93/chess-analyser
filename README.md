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

Imported games and review data are stored locally in the browser. Clearing site data will remove that local data.

This is a personal/open-source project and is not affiliated with Chess.com or Lichess.
