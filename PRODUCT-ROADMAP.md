# Chess Analyser product roadmap

Home should answer: **How am I doing? Where am I struggling? What should I do next?**

Prefer complete, tested increments. Public game results describe outcomes; tactical advice requires verified engine evidence. Never infer a playing style or a causal weakness from win rate alone. All personal features must filter the selected account, preserve stored games and separate rating pools.

## Current increment: personal insights and training

| Feature | Player benefit | Data dependencies | Priority | Status | Validation / PR |
| --- | --- | --- | --- | --- | --- |
| Personal Home / Chess DNA | Results, current streak, colour scores, rating trends and personal rating bests | Local standard-chess games, rated observations grouped by time control | P0 | Implemented | 114 regression tests and 81 browser tests passed; branch `codex/personal-chess-insights` |
| Opening intelligence | Strongest/weakest observed results and a source-game review action | PGN Opening/ECOUrl, colour, time control, at least five completed games per group | P0 | Implemented | Sample-size, missing-data and account-isolation checks; PR pending GitHub API access |
| Rolling weekly performance report | Wins/draws/losses, activity comparison and rating changes with a pre-week baseline | Game end timestamps, saved archives, separate rated pools | P0 | Implemented | Disjoint date-window and rating-baseline unit checks |
| Learn from your games | Exercises from the player's own verified mistakes, with local progress | PGN positions, verified Stockfish reviews, fresh depth-12 solution check | P0 | Implemented | Real-engine browser check covers retry, solve, reload and account switching |
| Evidence-based improvement coach | Prioritize repeat missed captures/checkmates found across at least three distinct reviewed games | Verified practice candidates; no guessed fork/pin labels | P1 | Implemented, limited to reliable motifs | Unknown, incomplete, low-depth and stale solutions rejected |
| Public player comparison | Compare results, colour performance, ratings and openings in one time-control pool | Local games or three public monthly archives per player; 24-hour isolated cache | P1 | Implemented | Mocked API tests cover bounded requests, cache reuse, no library contamination and Retry-After; live endpoint access remains blocked |

## Next independently shippable increments

| Opportunity | Expected player benefit | Required evidence / dependencies | Priority | Status / acceptance criteria |
| --- | --- | --- | --- | --- |
| Early-game mistake intelligence | Locate recurring weak decisions in an opening and show verified alternatives | Verified reviews associated with opening, side and exact position | P1 | Planned: distinguish results-based opening observations from engine-confirmed mistakes; link to real source positions |
| Weekly coach report with three concrete actions | A short, actionable practice plan | Recent verified-review coverage, recurring positions and local progress | P1 | Planned: show reviewed-game denominator, distinguish missing reviews from clean play, never invent weekly tactical totals |
| Repeated tactical motif detection | Identify reliable forks, pins, hanging pieces and missed mates | Board geometry, legal continuations, engine verification and motif-specific regression positions | P1 | Planned: initial increment groups only objectively identifiable best-move captures and checkmates; no speculative motif names |
| Training improvement over time | Show whether practice carries over into real games | Versioned attempt history, per-game review coverage and comparable periods | P1 | Planned: count assisted answers separately and account for differing game/review sample sizes |
| Spaced personal puzzle training | Revisit difficult positions at useful intervals | Verified exercises and persistent per-player progress | P2 | Planned: accessible session queue, due dates, reveal/assist state and multi-move solution verification |
| Performance by time of day | Find descriptive patterns without small-sample exaggeration | Explicit timezone and reliable timestamps; minimum samples | P2 | Planned: distinguish UTC time from local playing time and avoid causal claims |
| Game-duration and clock insights | Understand time-management issues | Reliable start/end or clock annotations with increment semantics | P2 | Research: do not substitute time control, end timestamp or move count for actual elapsed duration |
| Most instructive recent game | Find the best review target, beyond the latest loss | Verified evaluation swings, player identity and review availability | P2 | Planned: rank only analyzed games and make missing coverage visible |
| Personal milestones | Recognize rating bests and meaningful achievements | Separate rated pools and reliable historical baselines | P2 | Partial: saved-rating bests implemented; additional achievements need explicit definitions and persistence |
| Recent versus historical performance | Compare like-for-like results and opponent strength | Pool, colour, opponent ratings, sufficiently large comparable periods | P2 | Planned: display sample sizes and uncertainty; never label a small fluctuation statistically significant |

## Validation and release policy

- Validation completed: `npm test` (114 passed) and the full Playwright matrix at 360px, 393px and 430px (81 passed), including existing game-review, offline and navigation regressions. Real Stockfish training and mobile/desktop screenshots were verified. Live public API availability remains unverified.
- Capture and inspect mobile and desktop screenshots for changed flows.
- Test account switching, old/missing/corrupt data, unknown outcomes and empty samples.
- Home summaries do no engine or network work. Personal-training discovery is explicit and bounded to the most recent 60 saved standard-chess games; fresh computation begins only when an exercise is selected.
- Underpromotion exercises are omitted until the practice board supports choosing a promotion piece; its current automatic queen promotion must not make an exercise unsolvable.
- Public comparisons use sequential requests, at most three monthly archives per player, keep at most 6,000 games per public sample and cache samples separately for 24 hours. They never import another player's samples into the Games library.
- Commit only reviewed source, tests and documentation. Keep dependencies, generated reports and local cloud helpers out of commits.
- The user authorized committing passing changes and merging a PR after successful review. Do not bypass branch protection, required reviews or failing checks.
- GitHub API access (`api.github.com`) is currently blocked by the environment network policy. A domain addition is saved in the environment configuration draft. Branch push permission was verified with a dry run. PR creation, issue/discussion research, server-side checks and merging require API access to be restored.
- No unattended recurring runner is installed or scheduled. A future scheduled execution should inspect this roadmap and current repository state before selecting its next complete increment.
