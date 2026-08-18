# Chess Analyser

Chess.com-style analysis board for games from the `rk93` Chess.com account.

## Current version

The latest packaged build is **v12**. It includes:

- automatic Chess.com game sync into IndexedDB
- responsive mobile analysis UI
- fixed 8x8 board geometry
- multi-PV engine arrows
- Lichess cloud evaluation with live Stockfish fallback
- Kaneo / Neo-inspired SVG chess pieces

## Run locally

This is a static web app. Serve the extracted app directory with any static HTTP server, for example:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

The repository also contains `chess-analyser-v12.zip`, which is the exact build produced in the ChatGPT development session. Extract it before running if the individual source files are not yet present.
