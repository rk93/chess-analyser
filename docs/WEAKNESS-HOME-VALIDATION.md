# Personal Home and weakness evidence

Base: `198fef0` (merged PR #63). Branch: `codex/weakness-home-command-centre`.

## What changed

Home now leads with an interactive rating Pulse, a personal greeting and Pip's data-supported next action. It shows up to three growth priorities, expandable evidence, saved-game resume with the actual move, opening/practice shortcuts, opening labels on the existing real-board recent cards, and saved personal rating bests by format. Existing weekly reports, Chess DNA, personal training and daily puzzles remain accessible.

The weakness framework separates outcome observations from saved engine evidence. Both use account-filtered standard-chess games, exclude future/undated games from the recent cohort, show their source and dates, and group evidence by time control. Public comparison samples are never mixed into personal saved games.

## Evidence contracts

| Finding | Required evidence |
| --- | --- |
| Difficult opening results | Same named opening, colour and format; five known outcomes, at least three losses, score ≤40% |
| Colour difference | Ten known outcomes per colour in one format; at least a 20-point score gap |
| Losses on time | Ten known outcomes, at least three explicit timeout losses, at least 20% of known results |
| Short losses | Ten games with known results and explicit positive PGN PlyCount; at least three losses in ≤40 plies; unknown lengths are excluded from denominators |
| Recent decline | Ten known results in each disjoint rolling 30-day window; score decreases by at least 20 percentage points |
| Rating bands | Ten known outcomes, at least five losses and score ≤30%; recorded ratings must be finite; similar means within 100 points |
| Saved engine patterns | Verified-review contract v1 and explicit local Stockfish provenance, complete label/evaluation arrays, exact positions and move flags, finite depth ≥8 throughout; selected player's stronger moves must be legal and improve the evaluation |
| Recurring engine observations | At least three distinct qualifying games per format; repeated blunders, immediate missed checkmates, stronger captures or estimated phase patterns; multiple mistakes in one game cannot satisfy recurrence |
| Trend indicators | Same finding/format; history needs ten known outcomes per 30-day window, engine patterns five eligible reviews per window; engine trends compare affected-game rates rather than raw error counts |

Score is wins plus half draws. Sample labels describe evidence size, not statistical confidence. Opponents, opening mix and review coverage can differ across windows; a changing rate does not prove a causal skill improvement or decline. Phase estimates use non-pawn material ≤13 points for endgames; otherwise moves through full move 10 are opening, then middlegame. The UI discloses this heuristic.

Pawn structure, king safety, positional weaknesses, forks/pins and multi-move missed tactics are not diagnosed by this increment. New detection types need their own verifiable board/engine evidence. Underpromotion practice remains subject to the existing practice-board limitation.

## Data, computation and privacy

- Initial Home summaries use saved data; neither framework nor chart starts engine analysis or fetches another history.
- Checking engine evidence is explicit, scans at most 60 newest games in the 90-day cohort, yields progress every five games and supports cancellation/retry. No new Stockfish search runs in this scan.
- Missing, partial, shallow, malformed and unsupported reviews are excluded. Eligible reviewed-game denominators and scanned/available coverage are visible; unchecked games are not labelled mistake-free.
- Account, import, navigation and review-cache changes invalidate pending work. Late imports cannot publish another account's findings. Existing personal training shares the saved-review loader and still checks a selected practice solution freshly at depth 12.
- Resume stores only the saved-game identity and ply in an account-scoped localStorage record. Source-game actions resolve against the current user's saved library. Existing schemas, preferences, games and training attempts are preserved.
- Pulse uses saved rated observations, one format at a time. Seven/thirty-day deltas require a rated observation before the respective window. Missing pools and insufficient charts stay unknown. Rating bests are not claimed to be all-time Chess.com records.

## Validation

- `npm test`: **154 passed**, zero failed, skipped or cancelled, including Black-perspective evidence coverage.
- Complete Playwright matrix: **176 passed**, zero failed or skipped, at 360px, 393px, 430px and 1280×900 desktop.
- The clean browser run completed after the shared fixture was corrected and keyboard-focus/cache-invalidation checks were added. Existing Home, Friends & Players, Scout, real Stockfish personal training, puzzle, offline, review and browser-back regressions remain enabled.
- Before/after and scrolled section captures were inspected at all four viewports; no horizontal page overflow was detected and navigation remained accessible.

Generated reports and run logs remain in the external cloud helper directory rather than the repository. Source, tests, roadmap, validation and representative screenshots are committed together.

Coverage includes evidence thresholds, unknown outcomes and ratings, future/old/duplicate/foreign games, shallow or corrupt review arrays, legal alternative moves, distinct-game recurrence, review denominators, trends, separate rating pools, real Stockfish positions, existing personal training, source navigation, resume/reload/account switching, cancellation, empty data, reduced motion and minimum 44px new controls.

The real-engine browser case runs local Stockfish at depth 8 on each nonterminal position of a short legal game, stores those results as three distinct source-game review fixtures, and verifies recurrence and exact-position/source-game links without new searches during discovery. Other cache scenarios use explicitly synthetic fixtures to test validation gates; these are test data, not real player claims.

Cloud browser checks use Chromium 154 and the configured proxy with TLS verification enabled. Repository CI uses Playwright 1.56.1 on supported Ubuntu 24.04. Viewport emulation is not a physical-device test. External chess.js availability is still required for a cold launch; this change does not introduce a new dependency.

## Before and after

Before serves the archived, unmodified `198fef0` tree. Both states use the same deterministic 80-game Alpha/Beta fixture covering all formats and 80 days. Results and ratings are fixtures. Before/after captures plus scrolled growth/recent views were made at 360/393/430px and 1280×900 desktop.

| Viewport | Before | After |
| --- | --- | --- |
| Mobile 393px | [Existing Home](screenshots/home-command-before-393.png) | [Pulse and growth dashboard](screenshots/home-command-after-393.png) |
| Desktop 1280px | [Existing Home](screenshots/home-command-before-1280.png) | [Personal command centre](screenshots/home-command-after-1280.png) |

Rendered before/after captures and scrolled growth/recent views were inspected. New SVG controls render clearly, cards fit their columns, and horizontal scrolling stays within the recent-games rail. No horizontal page overflow was detected and navigation remained visible at each viewport. Full-page captures show the fixed navigation at its initial viewport position; scrolling reveals the content underneath it.

A synthetic calculation over 10,000 saved games (2,160 within the 90-day cohort), including weakness findings and all four Pulse pools, completed in about 26ms in this cloud environment. This is a local calculation measurement, not a phone performance benchmark. Heavy saved-PGN parsing remains explicit and capped at 60 games.

GitHub API access has previously been restricted; public pages and native Git remain the available fallback. Any PR still requires successful hosted checks before merge. No required checks or protections are bypassed.
