# Chess Analyser

A responsive, browser-based chess analysis app for importing Chess.com games and analysing arbitrary chess positions.

Live site: https://rk93.github.io/chess-analyser/

## Current features

- Import Chess.com games for any username
- Import filters for last month, last year, or full history
- Local IndexedDB storage so imported games persist in the browser
- Responsive mobile-first game analysis UI
- Home tabs for **Games** and a standalone **Analysis Board**
- Free Analysis Board lets users make legal moves from the starting position and analyse any resulting position
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

## Analysis Board

The **Analysis Board** tab is independent of imported Chess.com games. Users can move pieces legally on a fresh board, flip the board, reset the position, select an engine, and analyse the current position. Engine arrows and evaluation are shown directly on the board.

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

- `index.html` — application shell, home tabs, game analysis UI and settings UI
- `styles.css` — core layout and analysis UI
- `fixes.css` — appearance customiser, home tabs, analysis-board layout and responsive overrides
- `app.js` — imported-game board, game navigation, analysis, engines, sound and piece rendering
- `enhancements.js` — Chess.com import filters and settings persistence
- `lab.js` — standalone Analysis Board and engine analysis
- `manifest.webmanifest` — PWA metadata
- `sw.js` — service-worker caching

## Storage

Imported games are stored in browser IndexedDB. Updating the files in this repository does not delete saved games, but clearing site data for the GitHub Pages origin will remove that browser-local database.

## Android / Google Play direction

The web app is already a PWA. A practical Android packaging route is a **Trusted Web Activity (TWA)** using Google's Bubblewrap tooling. This keeps the GitHub Pages web app as the main codebase while producing an Android package for Play Store distribution.

Typical release path:

1. Make sure the PWA manifest contains production-quality app icons and metadata.
2. Generate a TWA Android project with Bubblewrap.
3. Configure Digital Asset Links so the Android package is verified against the hosted website.
4. Build and sign the Android App Bundle / APK.
5. Test on Android devices.
6. Create the Play Console listing, complete testing requirements, and submit the app.

The web app and GitHub Pages hosting can remain free. Google Play full public distribution requires Google's developer registration fee and any applicable Play policies/testing requirements.
