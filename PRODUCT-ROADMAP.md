# Chess Analyser product roadmap

Home should answer: **How am I doing? Where am I struggling? What should I do next?**

Prefer complete, tested increments. Public game results describe outcomes; tactical advice requires verified engine evidence. Never infer a playing style or a causal weakness from win rate alone. All personal features must filter the selected account, preserve stored games and separate rating pools.

## Friends & Players increment

Merged in [PR #62](https://github.com/rk93/chess-analyser/pull/62) as `32bd26f`. Its updated unit and browser CI jobs passed after pinning the visual runner to Ubuntu 24.04, which the installed Playwright version supports.

| Priority | Improvement | Acceptance criteria | Status / validation |
| --- | --- | --- | --- |
| P0 | Preserve navigation and stored data | Existing mobile/desktop routes, personal reviews, training and offline shell pass; no IndexedDB schema change or library contamination | Complete: 128 regression tests and 104 browser checks passed |
| P1 | Intelligent player selection | Autofill the configured user; searchable opponents/favourites/recent searches; keyboard and touch selection; account-scoped persistence and clear loading/empty/error states | Implemented; documented public friends access was not established, so no private or undocumented integration is attempted |
| P1 | Multi-format profile comparison | Separate Bullet/Blitz/Rapid/Daily, recorded public ratings and avatars, per-format drilldown, common date window, source separation, cache-first bounded fetch, cancellation | Complete: fixture coverage, all three mobile widths and desktop passed |
| P2 | Opening and head-to-head study | Opening sample thresholds, colour/format groups, rating bands, representative opening/game replay through existing Analysis Board; deduplicate head-to-head encounters | Implemented; no engine claims inferred from outcomes |

Validation and original before/after screenshots: [FRIENDS-PLAYERS-VALIDATION.md](docs/FRIENDS-PLAYERS-VALIDATION.md).

Research and limitations: [FRIENDS-DISCOVERY-RESEARCH.md](docs/FRIENDS-DISCOVERY-RESEARCH.md). No friends endpoint or authorization flow was verified, and the UI labels alternative discovery sources explicitly. Official docs and live API access remain blocked by the environment proxy; the accessible secondary documentation is not presented as authoritative proof of current friends capabilities.

## Opponent Scout increment

Merged in [PR #63](https://github.com/rk93/chess-analyser/pull/63) as `198fef0`. Extends Friends & Players and its existing data client and Analysis Board.

| Priority | Improvement | Acceptance criteria | Status |
| --- | --- | --- | --- |
| P1 | Offline cached public study | Initial load reuses cached metadata/archives; explicitly labelled refresh revalidates; personal Games remain separate | Implemented; offline and explicit-refresh browser coverage |
| P2 | Three preparation actions | White openings, Black defences, difficult result samples or repeated lines; supporting counts, dates, colour, format and evidence limits | Implemented; insufficient samples remain explicit |
| P2 | Repeated opening lines | Legal first six plies from at least three distinct games, split by colour; actual board replay; reject invalid PGNs and nonstandard starting positions | Implemented; no Stockfish or active-game endpoints |
| P2 | Duration and recent changes | Explicit UTC timestamps, five-duration minimum; disjoint 30-day windows with ten outcomes each; per-colour repertoire share thresholds | Implemented; duration means wall-clock elapsed time |
| P0 | Bounded, cancellable study | Lazy parsing of at most 200 newest selected-format games; progress every ten; cancel/retry; invalidate on account/source/cohort changes | Implemented; full validation recorded in the linked report |

Validation, acceptance evidence and screenshots: [OPPONENT-SCOUT-VALIDATION.md](docs/OPPONENT-SCOUT-VALIDATION.md).

## Weakness evidence and personal Home increment

Merged in [PR #64](https://github.com/rk93/chess-analyser/pull/64) as `b753246`. One evidence framework powers Home; existing Game Review, Analysis Board, personal training and saved data remain the source of truth.

| Priority | Improvement | Acceptance criteria | Status |
| --- | --- | --- | --- |
| P2 | Game-history weakness observations | Opening/colour/timeout/short-loss/rating-band/recent-decline signals; documented minima, known-result denominators, one format per finding, recent date coverage and source-game links | Implemented; descriptive outcomes never become tactical diagnoses |
| P2 | Saved engine evidence | Exact, complete, versioned Stockfish cache; depth ≥8; legal stronger alternatives; recurrence in at least three distinct games; reviewed-game denominators, precise source positions and phase estimates | Implemented for repeated blunders, immediate missed mates, stronger captures and phase patterns; broader structural/motif diagnoses remain planned |
| P2 | Reliable trends and coverage | Disjoint 30-day windows; history trends need ten outcomes each, engine trends five eligible reviews each; missing reviews never count as clean games | Implemented; UI reports coverage and withholds unsupported trends |
| P3 | Personal Chess Pulse | Four distinct saved-rating pools; 7/30-day changes need a prior observation; interactive 7/30/90-day chart with keyboard/touch exploration | Implemented; no live-rating claims or cross-format strength ranking |
| P3 | Actionable Home | Personal greeting, Pip's actual-data insight, three growth priorities, expandable evidence, resume the last saved game at its move, opening/practice shortcuts, real recent boards and per-pool saved rating bests | Implemented; existing weekly, DNA, training and puzzle flows retained |
| P0 | Privacy, responsiveness and navigation | Explicit saved-review check, at most 60 recent games, progress/cancel/retry, account and navigation invalidation; no background engine work, schema changes or additional endpoints | Implemented; full regression matrix and before/after evidence documented below |

Validation and screenshots: [WEAKNESS-HOME-VALIDATION.md](docs/WEAKNESS-HOME-VALIDATION.md).

## Premium sound and tactile UI increment

Starting point: `main` commit `b753246`. Dedicated branch: `codex/premium-feedback`. Extends the original move-sound preference and press-feedback hooks; the old two-tone implementation is replaced by one shared controller.

| Improvement | Acceptance criteria | Status |
| --- | --- | --- |
| Original generated sounds | Distinct move/capture/check/mate/castle/promotion/illegal, puzzle/training outcomes, win/loss/draw, milestone, review-completion and optional UI-tap events; no downloaded sound assets | Implemented with a single lazy AudioContext, bounded cached buffers and one active voice |
| Saved preferences | Preserve explicit legacy sound on/off; new installs muted; Classic at 35%, light haptics enabled where supported, UI taps off; volume, theme and reduced-animation controls | Implemented inside the existing Settings panel; no migrations or duplicate controls |
| Tactile interaction | Existing press effect shared across screens; actual-coordinate piece/rook motion, legal targets, capture/success feedback, short route fades and evaluation/progress transitions | Implemented; device and app reduced-motion settings suppress effects |
| Quiet autoplay and cleanup | 0.3–0.5s playback and automatic puzzle replies silent; no autoplay haptics; one event per outcome; cancel pending voices, motion and callbacks on navigation/visibility changes | Implemented, including the first automatic guided step and pending puzzle replies |
| Safety and regression coverage | Trusted-gesture activation only, mute/volume-zero, event deduplication, rejected/absent audio and vibration support, preference persistence, mobile/desktop and real audio lifecycle tests | 172 unit tests and 232 browser checks passed; inspected screenshots in the linked report |

Validation: [FEEDBACK-VALIDATION.md](docs/FEEDBACK-VALIDATION.md). Initial rating-best cards remain silent; achievement sound is tied to an actually earned puzzle milestone rather than rendering old achievements. Existing opt-in coach speech keeps its separate controls.

## Remaining priorities from the product transformation brief

1. **P0 reliability:** maintain navigation and mobile review controls; investigate concrete regressions before adding features.
2. **P1 discovery refinements:** additional profile learning links and cached-sample management (cache-first offline loading is covered in the Scout increment); reconsider real friend import only with verified official documentation and authorization support.
3. **P2 intelligence:** build on the initial weakness framework with repertoire deviations, geometry-verified motifs, pawn-structure/king-safety evidence and reviewed opening-position associations. These need dedicated engine/board validation and must not be inferred from results.
4. **P3 command-centre refinements:** comparable training-improvement history, useful practice continuity and additional verified milestones. The initial Pulse, personal insight, growth evidence and saved-review resume are covered by the current increment.
5. **P4 coherent screen improvements:** Games filtering/previews, guided review moments, Analysis Board sharing, Explorer attribution, educational puzzles, interactive analytics and public Top Player study links. Extend existing components rather than adding parallel implementations.

These are later independently shippable stages, not completed capabilities of this increment. Each requires full regression checks, 360/393/430px and relevant desktop coverage, screenshot inspection, evidence/source disclosures and a review-ready PR. Do not merge while required checks are incomplete.

## Current increment: personal insights and training

| Feature | Player benefit | Data dependencies | Priority | Status | Validation / PR |
| --- | --- | --- | --- | --- | --- |
| Personal Home / Chess DNA | Results, current streak, colour scores, rating trends and personal rating bests | Local standard-chess games, rated observations grouped by time control | P0 | Implemented | 114 regression tests and 81 browser tests passed; branch `codex/personal-chess-insights` |
| Opening intelligence | Strongest/weakest observed results and a source-game review action | PGN Opening/ECOUrl, colour, time control, at least five completed games per group | P0 | Implemented | Sample-size, missing-data and account-isolation checks; merged in PR #61 |
| Rolling weekly performance report | Wins/draws/losses, activity comparison and rating changes with a pre-week baseline | Game end timestamps, saved archives, separate rated pools | P0 | Implemented | Disjoint date-window and rating-baseline unit checks |
| Learn from your games | Exercises from the player's own verified mistakes, with local progress | PGN positions, verified Stockfish reviews, fresh depth-12 solution check | P0 | Implemented | Real-engine browser check covers retry, solve, reload and account switching |
| Evidence-based improvement coach | Prioritize repeat missed captures/checkmates found across at least three distinct reviewed games | Verified practice candidates; no guessed fork/pin labels | P1 | Implemented, limited to reliable motifs | Unknown, incomplete, low-depth and stale solutions rejected |
| Public player comparison | Compare results, colour performance, ratings and openings in one time-control pool | Local games or three public monthly archives per player; 24-hour isolated cache | P1 | Implemented | Mocked API tests cover bounded requests, cache reuse, no library contamination and Retry-After; live endpoint access remains blocked |

## Next independently shippable increments

| Opportunity | Expected player benefit | Required evidence / dependencies | Priority | Status / acceptance criteria |
| --- | --- | --- | --- | --- |
| Early-game mistake intelligence | Locate recurring weak decisions in an opening and show verified alternatives | Verified reviews associated with opening, side and exact position | P1 | Partial: phase patterns and exact source positions implemented; opening-specific position associations remain planned |
| Weekly coach report with three concrete actions | A short, actionable practice plan | Recent verified-review coverage, recurring positions and local progress | P1 | Planned: show reviewed-game denominator, distinguish missing reviews from clean play, never invent weekly tactical totals |
| Repeated tactical motif detection | Identify reliable forks, pins, hanging pieces and missed mates | Board geometry, legal continuations, engine verification and motif-specific regression positions | P1 | Planned: initial increment groups only objectively identifiable best-move captures and checkmates; no speculative motif names |
| Training improvement over time | Show whether practice carries over into real games | Versioned attempt history, per-game review coverage and comparable periods | P1 | Planned: count assisted answers separately and account for differing game/review sample sizes |
| Spaced personal puzzle training | Revisit difficult positions at useful intervals | Verified exercises and persistent per-player progress | P2 | Planned: accessible session queue, due dates, reveal/assist state and multi-move solution verification |
| Performance by time of day | Find descriptive patterns without small-sample exaggeration | Explicit timezone and reliable timestamps; minimum samples | P2 | Planned: distinguish UTC time from local playing time and avoid causal claims |
| Game-duration and clock insights | Understand elapsed duration and time-management observations | Explicit UTC start and actual end timestamps; reliable clock annotations with increment semantics for future move-time work | P2 | Partial: Scout elapsed-duration median and explicit timeout results implemented; per-move clock research remains |
| Most instructive recent game | Find the best review target, beyond the latest loss | Verified evaluation swings, player identity and review availability | P2 | Planned: rank only analyzed games and make missing coverage visible |
| Personal milestones | Recognize rating bests and meaningful achievements | Separate rated pools and reliable historical baselines | P2 | Partial: saved-rating bests implemented; additional achievements need explicit definitions and persistence |
| Recent versus historical performance | Compare like-for-like results and opponent strength | Pool, colour, opponent ratings, sufficiently large comparable periods | P2 | Partial: weakness findings show qualified recent/previous 30-day trends and sample sizes; adjustment for changing opponent mix remains planned |

## Validation and release policy

- Previous increment (#61) validation: `npm test` (114 passed) and the full Playwright matrix at 360px, 393px and 430px (81 passed), including existing game-review, offline and navigation regressions. Real Stockfish training and mobile/desktop screenshots were verified. Live public API availability remains unverified.
- Capture and inspect mobile and desktop screenshots for changed flows.
- Test account switching, old/missing/corrupt data, unknown outcomes and empty samples.
- Home summaries do no engine or network work. Personal-training discovery is explicit and bounded to the most recent 60 saved standard-chess games; fresh computation begins only when an exercise is selected.
- Underpromotion exercises are omitted until the practice board supports choosing a promotion piece; its current automatic queen promotion must not make an exercise unsolvable.
- Public comparisons use sequential requests, at most three monthly archives per player, keep at most 6,000 games per public sample and cache samples separately for 24 hours. They never import another player's samples into the Games library.
- Commit only reviewed source, tests and documentation. Keep dependencies, generated reports and local cloud helpers out of commits.
- The user authorized committing passing changes and merging a PR after successful review. Do not bypass branch protection, required reviews or failing checks.
- GitHub API access (`api.github.com`) is currently blocked by the environment network policy. A domain addition is saved in the environment configuration draft. Native Git and public GitHub PR/Actions pages are reachable; PR #62's merge and successful updated jobs were verified through those sources. Authenticated PR creation and merging still require a working supported authenticated interface.
- No unattended recurring runner is installed or scheduled. A future scheduled execution should inspect this roadmap and current repository state before selecting its next complete increment.
