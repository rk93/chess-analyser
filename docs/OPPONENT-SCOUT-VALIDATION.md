# Opponent Scout and cached public study

Base: `main` commit `32bd26f` (merged PR #62). Branch: `codex/opponent-scout`.

Scout extends Friends & Players, its existing public-data client and its Analysis Board replay. It adds no dependencies, database schemas, automatic engine work, active-game endpoints or changes to saved personal games.

## Acceptance and evidence

| Behaviour | Acceptance evidence |
| --- | --- |
| Three practical preparation actions | White opening, Black defence and a difficult opening sample or repeated-line exercise; insufficient evidence gives a useful next step instead of invented advice |
| Evidence separation | Source and selected period remain visible above Scout; each action shows supporting games and UTC dates; one time control at a time; lifetime statistics cannot supply PGNs |
| Opening frequency and outcomes | At least five known results per named opening/colour/format; difficult samples additionally require at least three losses and a score of at most 40%; score means wins plus half draws |
| Repeated lines and real replay | First six legal plies from at least three distinct games of the same colour; illegal PGNs and nonstandard starting positions excluded; existing board can replay exactly those six plies and return to Scout |
| Reliable durations | Explicit UTC start and actual end timestamps; reject invalid calendar dates and reversed/missing timestamps; median needs five games; labelled wall-clock elapsed time, including time away in Daily games |
| Recent results and repertoire | Disjoint rolling 30-day windows; ten known outcomes in each for score change; repertoire share requires ten named-opening games per colour/window, five recent occurrences and a 20-point increase |
| Timeout observations | Only explicit timeout losses; a displayed rate needs three such losses and ten known outcomes; no inference from short games or the nominal time control |
| Bounded computation | Lazy PGN parsing, at most 200 newest selected-format games; progress and an event-loop yield every ten games; tested real parser stops after the first ten when cancelled |
| Cancellation and isolation | Cancel/retry, navigation away and account changes; late imports cannot repopulate a previous account's report; edited cohort data invalidates the in-memory report |
| Cached public study | Initial “Load public data” is cache-first; “Refresh public data” explicitly revalidates; browser test reopens the page online, goes offline and reuses the persisted public sample without API requests |
| Mobile and regression safety | 44px study controls, reduced motion, no horizontal overflow, source/pool/period controls, board navigation, existing review/training/puzzle/offline checks |

## Validation

- `npm test`: **138 passed**, zero failed, skipped or cancelled.
- Complete Playwright regression matrix: **140 passed**, zero failed or skipped, at 360px, 393px, 430px and the 1280×900 desktop player-study project.
- After strengthening the custom-start PGN fixture to include six proven legal plies in the selected format, its browser check was rerun separately at all four viewports: **4 passed**.
- Fresh archived-main before/after captures and scrolled study views were inspected. No horizontal page overflow was detected; existing navigation remained visible.

The complete run includes the existing Home, real Stockfish personal-training, game-review, puzzle, offline and browser-back regressions. The final application code passed a clean complete run after the SVG correction. Logs and generated browser diagnostics remain in the external cloud helper directory, not the repository.

Cloud browser verification uses installed Chromium 154 through an external Playwright config, with TLS verification enabled. Repository CI retains Playwright 1.56.1 and its supported Ubuntu 24.04 runner. This is emulated viewport coverage, not a physical-phone test.

## Screenshots

Before captures serve the archived, unmodified `32bd26f` tree. Before and after use the same deterministic 40-game Alpha/Beta fixture; Rapid contains ten games, five per colour. These are test data, not real player statistics. Before shows the existing Rapid comparison; after shows Scout using those games.

| Viewport | Before | After |
| --- | --- | --- |
| 393px mobile | [Existing comparison](screenshots/scout-before-393.png) | [Opponent Scout](screenshots/scout-after-393.png) |
| 1280px desktop | [Existing comparison](screenshots/scout-before-1280.png) | [Opponent Scout](screenshots/scout-after-1280.png) |

Before/after captures were also taken at 360px and 430px. Rendered captures and scrolled study/line views were inspected for overflow, clipped cards, missing glyphs and navigation. Study arrows use SVG. Full-page images show the fixed navigation at its initial viewport position; scrolling exposes the content underneath it. Automated checks confirm no page overflow and visible navigation at each width.

## Limits and remaining work

Observations are descriptive; they do not predict a future move or prove tactical, positional or endgame weaknesses. No engine-verified preparation recommendations are generated. The broader weakness framework and repertoire-deviation analysis remain separate roadmap stages.

Sample dates, opponents and available archive coverage can differ. The newest-200 cap also limits recent-versus-previous comparisons; the UI shows both denominators and withholds comparisons below threshold. Missing opening names and unplayable PGNs reduce coverage. Whole PGNs are validated lazily; a corrupt PGN supplies no repeated legal line. Duration validation excludes nonpositive intervals and intervals over 732 days. No extra history is downloaded for Scout.

The offline check covers a previously loaded app with cached public data and its external chess library already available. A cold offline launch cannot guarantee loading the existing external chess.js dependency. Live Chess.com access and authoritative friends-list documentation remain blocked in this environment, so public-service paths use explicit API fixtures.

GitHub public PR/Actions pages and native Git are reachable. The GitHub API remains restricted; any new PR's required hosted checks must pass before merge.
