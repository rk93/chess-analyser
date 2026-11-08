# Personal Practice Plan

Base: `01bfccd` (Practice Studio merged in PR #70). Branch: `codex/practice-plan`.

## Acceptance criteria

1. Derive suggested revisits from actual versioned dated attempts. Keep lifetime totals, saved games, settings and public samples intact. Do not invent dates for old aggregate progress.
2. Use disclosed 1/3/7/14-day study intervals. A missed or revealed answer restarts the interval. Earlier practice, retries and multiple visits on the same UTC day cannot manufacture a longer interval. Incomplete retained history yields conservative scheduling.
3. Remember one unfinished verified position per account as a small versioned reference. Resume across reloads without storing duplicate PGNs; dismiss explicitly. Unknown future formats and storage failures must preserve records and leave ordinary practice usable.
4. Reuse the existing scan of at most 60 saved games and fresh native Stockfish depth-12 solution check when a planned position is selected. No scanning or engine work on Home load. Show progress, cancellation and useful errors when evidence is no longer available.
5. Extend the existing Lit Studio with accessible ready/upcoming/resume states and 44px controls. Preserve the shared navigation controller, practice dock, feedback preferences and reduced-motion behavior.
6. Add unit/integration tests; run the full regression matrix at 360/393/430px and desktop; capture and inspect matching before/after screenshots. Hosted checks must pass before merge.

## Implementation and evidence rules

`practice-plan-core.js` reconstructs a schedule from the existing version-1 dated history. There is no separate schedule database. It processes at most 500 retained attempts within the existing 90-day window and produces one entry per exact position/solution identity. The last source format and motif are retained for display; formats are not treated as comparable playing strength.

- A position starts with a one-day interval. A clean **first recorded attempt of a UTC day**, at or after the existing due time, progresses through 1, 3, 7 and then 14 days. The maximum is 14 days.
- Any missed or revealed attempt within that UTC day takes precedence over clean retries, resets the interval, and suggests the next visit 24 hours after that day's last recorded attempt. The first clean due visit after assistance begins again at one day.
- Clean practice before the due time leaves both the interval and due time unchanged. A midnight boundary alone cannot shorten the 24-hour minimum. If the first try on a due day was early, later tries that day do not extend it.
- A truncated first day cannot establish clean recall. Earlier missing history is not reconstructed from aggregate counters. The disclosed rule is deliberately conservative and is a study reminder, not an experimentally calibrated memory model or proof of playing improvement.
- Ready positions are ordered by due date. The Studio shows at most three additional ready positions and an unfinished position once, without duplicate rows. The existing discovery list prioritises ready positions ahead of new and previously solved positions and keeps its eight-card display limit.

`practice-plan-store.js` keeps one `chess-practice-resume:<user>` reference: version, exact position/solution identity, last update, source format, motif and reveal flag. No duplicate PGN, opponent name or credential is saved. References expire from the UI after 90 days and are replaced by the next successful practice start. Dismissing a reference leaves attempts, lifetime progress and saved games intact. Unknown versions, malformed data, future timestamps and storage failures do not overwrite the original record.

Only a successful fresh Stockfish check creates an unfinished reference. Revealing before making a move records **no fabricated attempt**, but marks the unfinished reference as assisted. Resuming it retains that flag across reloads. A successful move clears the reference; a failed retry after solving restores it. Starting a different position or explicitly dismissing ends the previous unfinished visit. Actual failed saves are shown in the existing practice dock and Studio; ordinary practice and its original progress remain usable.

Choosing Resume or a ready position uses the current saved-game collection, existing saved-review reader and the existing fresh depth-12 Stockfish solution check. A position that is absent or ineligible in the latest 60 games produces an explanation instead of being launched from stale history. Scans report actual rows checked and accept cancellation. Cancellation, leaving Home, hiding the practice view, switching accounts or hiding the browser page invalidates the pending launch; native UCI work is stopped and drained by the existing engine controller. No route visibility rule or coach-dock layout is replaced.

The existing Lit component renders the plan with source labels, UTC dates, accessible buttons, original SVG dismissal, an expandable explanation and responsive desktop grouping. It uses the shared opt-in sound/haptic controller and adds no animation, dependency or remote endpoint. Home reads the small local history/reference only. Service-worker version 96 includes the two new local helpers. The plan refreshes when returning to Home or the visible browser page; there are no notifications, recurring jobs or play-volume incentives.

A warm cloud Node microbenchmark of 500 retained attempts across 100 positions over 100 runs measured a 0.36ms median and 0.61ms 95th percentile for schedule calculation. This is a bounded-computation check, not a physical-device rendering benchmark.

## Reproduced account-switching race

An existing guard ran **before** awaiting `readSavedReview()`. While that read was pending, switching accounts and starting another discovery replaced the module's shared exercise array. The old call then appended its result into that new array before reaching its next generation check. Cancelling the old caller did not undo the append.

The permanent regression holds two actual saved-review reads, starts discovery for `alpha`, switches to `motif-source-3`, starts the second discovery, and releases the old result first. The selected Black account has no eligible move in its only saved game. Before the fix, the test failed with **one** White knight-fork exercise belonging to the first account; the expected count was zero. The fix checks the abort signal, generation and account immediately after each awaited read, before using its result.

The same controlled journey on archived `01bfccd` produced `foreignExercises: 1`; the working branch produced `foreignExercises: 0`. The permanent test passes at 360px, 393px, 430px and desktop. These are real discovery/account events and delayed saved data, not simulated CSS states.

| Reproduced defect | Corrected behavior |
| --- | --- |
| [Foreign exercise in the second account](screenshots/plan-race-before-393.png) | [No foreign exercises](screenshots/plan-race-after-393.png) |

## Automated validation

The complete unit suite passed **229 tests**, without failures or skips. The complete browser matrix passed **398 unique scenarios** at 360px, 393px, 430px and desktop. Environment interruptions required resumed validation: each of the three **105-scenario mobile groups** completed on the frozen final source before the last transition, and all **83 desktop scenarios** passed in a separately retained **2.6-minute** batch. Every result was matched by project, file and complete test title against Playwright's 398-scenario manifest: **zero missing, failed or skipped scenarios**. This is complete matrix coverage across recovered runs, not a claim that an interrupted process finished.

All **36 new practice-plan checks** passed separately. The corrected pending-reply regression passed **20 consecutive executions** (five per viewport) in **30.8 seconds**. `npm run check:ui` and staged `git diff --check` passed. The source and tests were frozen during final validation; only this report changed.

```sh
npm run check:ui
npm test
npm run test:visual
git diff --check
```

Cloud execution uses the same four committed projects with system Chromium and the inherited proxy through `/workspace/.onboarding/chess-analyser/playwright.cloud.config.mjs`. The corrected full-matrix command was `npm run test:visual -- --config /workspace/.onboarding/chess-analyser/playwright.cloud.config.mjs --workers=4`. After its mobile groups completed, another environment transition terminated the runner. The desktop batch used that command with `--project desktop-players --reporter=list,json`, retained a separate JSON report and passed all 83 scenarios. Hosted CI uses Playwright's installed Chromium and runs the complete matrix normally.

Coverage verification compared the frozen `--list --reporter=json` manifest with the completed mobile log and desktop JSON results. The external audit produced `expected: 398`, `passed_unique: 398`, `mobile: 315`, `desktop: 83`, `missing: 0`, `failed: 0`, `skipped: 0`. Interrupted attempts are not counted as completed runs. Verified orphaned test servers and headless automation browsers were cleaned up before resuming.

Seventeen new unit cases cover interval progression/capping, exact due boundaries, same-day and early attempts, midnight, missed/revealed precedence, retained history, account-scoped minimal references, expiry, corrupt/future schemas, unavailable storage and dismissal. The nine new browser journeys cover real native Stockfish resume/reveal/retry/solve, no invented attempts, restored assistance, ready-position priority, missing evidence, future formats, quota failures, actual UCI Stop/drain, cancellation after view/navigation/account changes, offline keyboard dismissal, reduced motion and the reproduced delayed-read race. The original Studio, Review/Back loops, game library, comparisons, Scout, audio, puzzles and weekly-coach checks remain part of the full suite.

The first uninterrupted full run passed 397 checks and exposed a timing assumption in the existing puzzle-reply cancellation test. Its automated Home click could arrive after the 280ms opponent reply had already executed, so its assertion that the knight was still on b8 no longer described a pending reply. The trace and source were inspected. That test now uses Playwright's clock to keep the real reply pending during the real navigation click, advances time while away, then verifies the silent reply after returning. No production puzzle delay, cancellation logic or assertion was relaxed. The corrected check passed individually, in the 20-run stress check and in every final viewport group.

Deterministic history/evidence fixtures illustrate UI states. The native-engine case obtains and rechecks actual Stockfish recommendations. No live public API capability is claimed. Chromium viewport verification does not verify Safari or physical-device haptic/speaker behavior. Multi-move training and underpromotion choice remain outside this stage. Hosted Tests and Mobile visual QA must pass before merge.

## Screenshot inspection

Matching fixtures run on archived merged main (`01bfccd`) and the branch. Normal viewports retain navigation; component-only exports clip the unrelated fixed navigation for an unobstructed comparison. Captures report no horizontal overflow, page errors or workers on Home. Every linked layout was inspected for clipping, wrapping and action placement. Desktop navigation was also measured as visible with `clip-path: none` and the Home button hit-tested successfully.

| Width | Before | After |
| --- | --- | --- |
| 360px | [Before](screenshots/plan-before-360.png) | [After](screenshots/plan-after-360.png) |
| 393px | [Before](screenshots/plan-before-393.png) | [After](screenshots/plan-after-393.png) |
| 430px | [Before](screenshots/plan-before-430.png) | [After](screenshots/plan-after-430.png) |
| 1280px | [Before](screenshots/plan-before-1280.png) | [After](screenshots/plan-after-1280.png) |

Additional evidence: [360px plan and navigation](screenshots/plan-navigation-360.png), [desktop plan grouping](screenshots/plan-panel-1280.png), [scheduling explanation](screenshots/plan-method-393.png), [next suggested revisit](screenshots/plan-upcoming-393.png).
