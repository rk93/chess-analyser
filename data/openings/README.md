# Opening line catalogue

Source: [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings), pinned at commit [`3ba6b20d31b2e6125cb0e6a2e792f400717d9d39`](https://github.com/lichess-org/chess-openings/tree/3ba6b20d31b2e6125cb0e6a2e792f400717d9d39).

The `eco`, `name` and `pgn` fields come from that revision's `a.tsv` through `e.tsv`, in source order. `id` is a stable row index for this pinned snapshot. `gambit` means the supplied name contains “gambit”; this includes accepted/declined branches, rather than an engine judgment about sacrifices.

Upstream's README states: “As a collection of facts, this data set is in the public domain. Considerable effort was spent curating and cleaning the data. Insofar as that qualifies for copyright, the work is released under the CC0 Public Domain Dedication.” License: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

These are named paths to opening positions, including transpositions. They are not an exhaustive tree of every legal opening continuation. The app follows every ply of the selected path, then explicitly offers free Stockfish play. It does not claim that an opening has one universally correct endpoint or force a real opponent to follow that path.

The snapshot is shipped with the app, fetched only when the player opens the lesson selector, and cached by the existing service worker after that explicit load for later offline use. No opening data is scraped or fetched from an active game. Unit validation plays every catalogue PGN with chess.js, covering legal moves and line endpoints.
