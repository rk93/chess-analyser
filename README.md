# Chess Analyser

A responsive, browser-based chess analysis app for importing and reviewing Chess.com games.

Live site: https://rk93.github.io/chess-analyser/

## Current features

- Import Chess.com games for any username
- Import filters for last month, last year, or full history
- Local IndexedDB storage so imported games persist in the browser
- Responsive mobile-first analysis board
- Fixed 8×8 board geometry
- Board flipping and move navigation
- Multi-PV best-move arrows drawn directly on the board
- Lichess Cloud evaluation
- Live Stockfish fallback via chess-api.com
- Selectable engine mode: Auto, Lichess Cloud, or Stockfish Live
- Move and capture sounds with an on/off preference
- Visual appearance customiser
  - Piece styles: Neo, Bases, Classic
  - Board themes: Green, Brown, Blue, Grey
  - Miniature previews before selecting a style
- User preferences saved locally
- Progressive Web App support through a service worker and web manifest

## Piece artwork

The app does not bundle Chess.com piece artwork. The selectable piece styles use open-source SVG sets from Kadagaden/chess-pieces and are presented as visual presets with familiar style names.

## Analysis behaviour

`Auto` engine mode first checks Lichess Cloud for a cached position. If no cloud evaluation is available, the app falls back to the live Stockfish service.

The principal variation is shown in move order starting with the best move from the position currently displayed on the board.

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

- `index.html` — application shell and settings UI
- `styles.css` — core layout and analysis UI
- `fixes.css` — appearance customiser and responsive overrides
- `app.js` — chess board, game navigation, analysis, engines, sound and piece rendering
- `enhancements.js` — Chess.com import filters and settings persistence
- `manifest.webmanifest` — PWA metadata
- `sw.js` — service-worker caching

## Storage

Imported games are stored in browser IndexedDB. Updating the files in this repository does not delete saved games, but clearing site data for the GitHub Pages origin will remove that browser-local database.
