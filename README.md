# Chess Analyser

A responsive, browser-based chess analysis app for importing Chess.com games, reviewing complete games, analysing arbitrary chess positions, and exploring historical performance.

Live site: https://rk93.github.io/chess-analyser/

## Current features

- Import Chess.com games for any username
- Import filters for last month, last year, or full history
- Local IndexedDB storage so imported games persist in the browser
- Home tabs for **Games**, **Analysis Board**, and **Analytics**
- Responsive mobile-first game analysis UI
- Automatic evaluation when navigating through imported-game moves
- Background prefetch of upcoming positions to make Next/Previous analysis feel faster
- Lichess Opening Explorer information for supported positions
- **Game Review** for complete imported games
  - estimated White and Black accuracy
  - move labels: Best, Excellent, Good, Inaccuracy, Mistake, Blunder
  - evaluation graph across the game
  - largest evaluation swing highlighted
  - summary counts by move-quality category
- Standalone Analysis Board with drag-and-drop legal moves
- **Position Setup** mode
  - freely add or remove pieces
  - choose White or Black to move
  - clear the board or restore the starting position
  - load the custom position back into the Analysis Board and analyse it
- Multi-PV best-move arrows drawn directly on the board
- Lichess Cloud evaluation
- Live Stockfish fallback via chess-api.com
- Selectable engine mode: Auto, Lichess Cloud, or Stockfish Live
- Move and capture sounds with an on/off preference
- Visual appearance customiser with Neo/Bases/Classic piece presets and Green/Brown/Blue/Grey board themes
- Progressive Web App support through a service worker and web manifest

## Analytics

The **Analytics** tab reads games already stored in IndexedDB and calculates historical statistics locally, so opening the dashboard does not download the games again.

Filters currently include:

- Last 30 days, last 3 months, last year, or all history
- All time controls, Rapid, Blitz, Bullet, or Daily
- Both colours, White only, or Black only

The dashboard currently includes:

- total games, wins, draws, losses and score percentage
- current, highest and lowest rating within the selected history
- average and median opponent rating
- most frequently played opening
- most frequently played opponent
- average and longest game length
- longest winning and losing streaks
- White-versus-Black performance
- rating-history chart
- monthly activity chart
- most common openings with game count, W-D-L record and score percentage
- frequent opponents with game count, W-D-L record, score and average rating
- performance against lower-rated, similarly-rated and higher-rated opponents
- performance by day of week
- game-ending/result reasons
- common time-control and colour statistics

Opening names are derived from the Opening/ECO metadata already present in imported PGNs where available. If no opening information is present, the dashboard labels the game as `Unknown opening` instead of guessing.

## Game Review

Open an imported game and press **Review game**. The app evaluates positions throughout the game, calculates an estimated accuracy score for each side, assigns move-quality labels, plots an evaluation graph, and highlights the largest evaluation swing.

The review uses Lichess Cloud evaluations where available. For positions not available from the cloud, the browser may use a limited number of live Stockfish requests and interpolate remaining gaps. Accuracy and move labels should therefore be treated as useful analysis estimates rather than an attempt to reproduce Chess.com's proprietary Game Review scoring exactly.

## Analysis Board and Position Setup

The **Analysis Board** tab is independent of imported Chess.com games. In normal mode, users can drag pieces to make legal moves, flip the board, reset the position, select an engine, and analyse the current position.

Press **Position setup** to build a position freely. Select a white or black piece from the palette and tap squares to place it, use the eraser to remove pieces, choose the side to move, then press **Use position**. A valid setup requires exactly one king for each side before it can be loaded into the analysis board.

## Piece artwork

The app does not bundle Chess.com piece artwork. The selectable piece styles use open-source SVG sets from Kadagaden/chess-pieces and are presented as visual presets with familiar style names.

## Analysis behaviour

`Auto` engine mode first checks Lichess Cloud for a cached position. If no cloud evaluation is available, the app falls back to the live Stockfish service.

The principal variation is shown in move order starting with the best move from the position currently displayed on the board.

## Product direction

Analytics is intended to become the foundation of the future coaching pipeline:

**Import games → understand recurring mistakes → create personalised training → measure improvement.**

Historical metadata can be calculated immediately. Engine-derived analytics such as mistake frequency, tactical themes and accuracy trends can later reuse persisted Game Review records rather than repeatedly analysing the same games.

## Running locally

This is a static web app. Serve the repository directory with any static HTTP server, for example:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Project structure

- `index.html` — application shell, home tabs, Game Review, Analysis Board, Analytics and settings UI
- `styles.css` — core layout and analysis UI
- `fixes.css` — appearance customiser, review/setup UI and responsive overrides
- `analytics.css` — responsive Analytics dashboard styles
- `app.js` — imported-game board, navigation, analysis, engines, sound and piece rendering
- `enhancements.js` — Chess.com import filters and settings persistence
- `lab.js` — standalone Analysis Board and home-tab navigation
- `position-setup.js` — custom position editor
- `game-review.js` — full-game evaluation, accuracy estimates, move labels and graph
- `auto-analysis.js` — automatic move-by-move analysis and upcoming-position prefetch
- `opening-insights.js` — Lichess Opening Explorer information
- `analytics.js` — historical aggregation, filters, tables and charts
- `manifest.webmanifest` — PWA metadata
- `sw.js` — service-worker caching

## Storage

Imported games are stored in browser IndexedDB. Updating the files in this repository does not delete saved games, but clearing site data for the GitHub Pages origin will remove that browser-local database.

## Android / Google Play direction

The web app is already a PWA. A practical Android packaging route is a **Trusted Web Activity (TWA)** using Google's Bubblewrap tooling. This keeps the hosted web app as the main codebase while producing an Android package for Play Store distribution.

Typical release path:

1. Add production-quality app icons and final manifest metadata.
2. Generate a TWA Android project with Bubblewrap.
3. Configure Digital Asset Links so the Android package is verified against the hosted website.
4. Build and sign the Android App Bundle.
5. Test on Android devices.
6. Complete the Play Console listing, testing requirements, privacy disclosures and submission.

The web app and GitHub Pages hosting can remain free. Google Play public distribution requires Google's developer registration fee and compliance with current Play policies.
