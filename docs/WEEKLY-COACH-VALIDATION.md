# Evidence-based weekly coach report

Base: merged PR #66, `40a54ba`. Branch: `codex/weekly-coach-report`.

## Behaviour and acceptance

The existing weekly Home card now contains a format-specific study plan. Its original all-format activity and per-format rating observations are retained and labelled separately. The initial focus is the most-played format in the last seven days, with Rapid preferred for ties. Results and detailed review coverage are expandable; up to three distinct actions remain directly available.

- Current and previous windows are disjoint rolling seven-day intervals in UTC. Future, undated, duplicate, foreign-account and nonstandard-chess games are excluded. Each plan uses one supported time control. Score differences need ten known results in both windows; unknown outcomes remain visible and never become losses. Differences are descriptive, with the opponent/colour caveat visible.
- Recurring engine actions reuse `engineWeaknesses` and need at least three distinct supporting games. A single saved moment can still be offered, explicitly without a recurrence claim. The existing saved-review reader verifies complete, exact, versioned reviews, legal alternatives and depth of at least eight. No forks, pins or structural weaknesses are inferred from results.
- Opening actions need at least five known results, three losses and score at most 40%, within the same colour, format and current week. The action uses actual opening metadata and a source game. Outcome patterns do not establish the cause of a loss.
- Coverage separates eligible reviews, inspected games without eligible evidence, and games not inspected. The weekly Check button reuses Home's existing controller and scanner, checking at most 60 cached reviews from the selected format's last 14 days. Growth's original check keeps its 90-day selection. Both use the same cancellable path; weekly evidence can also be supplied by Growth's scan. No additional remote data requests or Stockfish work run when Home renders.
- Actions open the existing Game Review or opening replay. Personal practice uses the existing launcher and an actual fresh depth-12 Stockfish check before entering the board. A changed solution is withheld. Existing solved/assisted records help prioritise positions not yet solved without help; missing assistance metadata is labelled neutrally. Practice completion continues to use the original per-player training progress.
- Study checkmarks are self-reported activity, kept for seven days and never presented as playing improvement. Only bounded hashed action identities and timestamps are persisted, scoped to the configured account, with at most 100 records. Broken or unavailable storage does not delete or modify saved games.
- Account/import/review invalidation clears stale evidence. Scan cancellation, navigation and other practice searches invalidate pending checks. The shared launcher's request token is separate from its discovery token, preserving the existing practice search while preventing a stale solution from opening later. New weekly practice checks use the already-supported engine AbortSignal.
- The report uses existing Home tokens, native accessible controls, preserved keyboard focus/open evidence sections, optional shared tactile feedback and reduced-motion settings. No new dependencies, engine calculations, schemas, public-comparison data stores or audio implementation. The existing offline shell is bumped to v92 and includes both weekly modules.

## Automated verification

| Check | Result |
| --- | --- |
| Complete unit suite, `npm test` | 187 passed; no failures or skipped tests |
| Complete Playwright regression matrix, `npm run test:visual -- --config /workspace/.onboarding/chess-analyser/playwright.cloud.config.mjs` | 300 passed in 8.0 minutes across 360px, 393px, 430px and 1280px projects |
| Final affected-flow verification, same configuration with `visual-tests/weekly-coach.spec.mjs` | All 40 weekly scenarios passed in 1.2 minutes after shortening the format/status labels, adding a specific checkbox label and conservatively describing older practice records; the complete 187-test unit suite passed again |
| Screenshot layout checks | Before/after captures at all four widths reported no horizontal overflow and visible navigation |
| Patch hygiene | `git diff --check` passed |

The full 300-scenario run preceded the final report-only refinements described above. All 40 affected weekly flows and all unit tests were rerun afterward; unrelated browser flows were not repeated.

Unit tests cover exact date boundaries and exclusions, format/colour/sample minima, unknown outcomes, review-source isolation, inspected/unchecked denominators, distinct actions, existing assisted practice history, conservative handling of older records, and bounded seven-day study marks.

The 40 weekly browser scenarios cover all four viewport projects: no automatic worker creation, three sourced actions, missing/partial/shallow caches, persisted activity, source navigation, actual native Stockfish revalidation and puzzle solving, cancellation of a held native search, concurrent existing practice discovery, account switching, quota failures, offline saved evidence, reduced motion and 44px controls. A 70-game extension proves that only 60 reviews are inspected and that the remaining games stay explicitly unchecked. A delayed module import proves Cancel/Retry and account changes reject old completions.

Saved-review fixtures are synthetic, deterministic records for evidence/UI tests. The dedicated real-engine practice scenario obtains the cached solutions from actual Stockfish at depth 12 and checks again before opening the exercise; it also verifies that solving the mate writes the original training progress. No live public API capability is claimed. Physical vibration/speaker comfort and Safari are not verified by Chromium viewport tests.

Cloud checks use the committed project matrix through the existing external Chromium/proxy wrapper, with TLS verification and all scenarios retained. Hosted CI must pass before merge.

## Screenshot evidence

Before: archived, unmodified `40a54ba`, using the same 24 saved-game fixture and cached reviews as after. Full-card component captures temporarily clip the unrelated fixed navigation overlay; normal viewport/action captures retain navigation. This makes all report content visible without obscuring any study action.

| View | Before | After |
| --- | --- | --- |
| Weekly card, 393px | [Before](screenshots/weekly-before-393.png) | [After](screenshots/weekly-after-393.png) |
| Weekly card, desktop | [Before](screenshots/weekly-before-1280.png) | [After](screenshots/weekly-after-1280.png) |

Additional evidence: [expanded coverage](screenshots/weekly-evidence-393.png), [360px viewport](screenshots/weekly-viewport-360.png), [393px viewport](screenshots/weekly-viewport-393.png), [430px viewport](screenshots/weekly-viewport-430.png), [desktop viewport](screenshots/weekly-viewport-1280.png), [360px actions](screenshots/weekly-actions-360.png), [430px actions](screenshots/weekly-actions-430.png).

Inspected the final mobile viewport captures at 360px, 393px and 430px, desktop viewport/card captures, the full 393px before/after cards, expanded evidence, and the 360px/430px action views. Format labels fit, narrow headings wrap cleanly, actions remain readable and tappable, and navigation remains available while scrolling. The expanded view explicitly shows unknown outcomes, the score-comparison minimum, eligible versus inspected versus unchecked games, and source depth. Static screenshots do not establish physical haptic quality or Safari behaviour.
