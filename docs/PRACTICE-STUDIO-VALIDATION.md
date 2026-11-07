# Practice Studio: premium Home UX and dated progress

Base: `8dae26c`, including the merged navigation fix and mobile practice-dock follow-ups. Branch: `codex/practice-studio`.

Home's existing practice section now puts a clear practice action above an interactive activity chart. Recorded practice, revealed answers and reviewed-game observations have distinct evidence and explanations. The existing practice launcher, fresh Stockfish solution check, saved-review scan and navigation remain responsible for their respective flows.

## Acceptance and data rules

- Store successful and unsuccessful **verified personal-practice attempts**, identified by a per-session run ID and monotonically increasing attempt number. Replayed events cannot increment either lifetime or dated totals. Fresh depth-12 Stockfish validation still precedes practice.
- Keep the original `chess-personal-training:<user>` totals intact. They have no reliable dated attempt history, so the new version-1 `chess-practice-history:<user>` log starts with the next actual attempt. It records identity, exact position/solution ID, timestamp, correctness, reveal status, source time control and motif. No opponent names, PGNs, public samples or credentials are copied.
- Read at most 500 valid events within 90 days. Prune on the next successful attempt write; loading does not rewrite stored data. Account changes clear the visible account's evidence and selection. Unknown versions, malformed histories and unavailable storage fail conservatively without overwriting the original record or affecting saved games.
- Present rolling 7/30-day windows in UTC. The first and last calendar-day buckets can be partial. Distinct positions solved without a reveal take precedence over assisted solutions; a position never counts in both headline totals. The chart counts individual attempts, including retries, and explicitly labels its unit.
- Compare the **first recorded try** on each exact position appearing in both disjoint windows. Require at least five shared positions and tracking coverage beginning before the previous window. Revealed first answers do not count as independent recall. The display states that familiarity and position selection affect these results; this is not a rating or proof of chess improvement. Practice charts describe local exercises from all source formats; source formats are retained for later filtering.
- The separate Reviewed games view reuses the existing weakness report, exact complete saved Stockfish reviews at depth ≥8, and its same-format reviewed-game denominators. A displayed trend needs five eligible reviews in each disjoint 30-day window. Missing or unchecked reviews never count as clean. The UI explicitly states that practice did not establish causation.
- The review check is the existing lazy, cancellable scan of at most 60 saved games. Progress, cancellation and errors are also shown in Studio. Rendering the component starts no engine and makes no new public-data requests. Dated storage failure leaves existing lifetime progress available and reports the dated-save failure.

## Framework and visual system

The npm registry reported **Lit 3.3.3** and **esbuild 0.28.2** as current stable releases during implementation on 2026-11-07. Both are pinned exactly, with a committed lockfile. Lit fits this static-module app as a small Web Component; a full router or application rewrite would disrupt the existing lifecycle without improving this feature.

- `js/practice-progress.js` implements one scoped Lit component with Shadow DOM styles and shared CSS tokens from `css/practice-studio.css`.
- `scripts/build-ui.mjs` builds the locally served `js/vendor/lit.js` runtime: **15,667 bytes**, uncompressed. The bundle retains license notices; the BSD 3-Clause license is included in `js/vendor/LIT-LICENSE.txt`. No production framework CDN or font request is added.
- `npm ci` installs the locked tools. `npm run build:ui` regenerates the runtime; `npm run check:ui` fails on a stale committed bundle. Both test workflows use `npm ci`; unit CI verifies the bundle before tests.
- The generated vendor file is marked as vendored in `.gitattributes`; its significant template-literal whitespace is excluded from Git's whitespace lint. Exact output is checked by `check:ui` instead of altering the library's strings.
- The refined section uses restrained green accents, graphite surfaces, system typography, an original pawn SVG, SVG action arrows, a prominent practice action and separated evidence views. Scoped selectors preserve other screens and route visibility. Desktop scroll offset clears the existing sticky navigation.
- Buttons and the range control have at least 44px touch height; buttons also have at least 44px width. Native keyboard input, visible focus, pressed states, selected-day readout and optional shared feedback remain available. There is no new motion to override reduced-motion settings and no duplicate Shadow DOM audio controller.
- Service-worker version 95 includes the local runtime, component, history helpers and stylesheet. Cached-chart interaction is tested offline; first-ever offline loading still depends on the app's pre-existing chess.js CDN dependency being available in the browser cache.

## Automated verification

The complete unit suite passed **212 tests**. The full Playwright matrix passed **362 scenarios in 11.0 minutes** at 360px, 393px, 430px and 1280px, without failures or skipped tests. After making the synthetic activity chronology and lifetime totals internally consistent, all **32 affected Studio scenarios passed again in 1.3 minutes**. Production code was unchanged for that fixture-only recheck. The final unit rerun, `npm run check:ui` and `git diff --check` also passed.

```sh
npm run check:ui
npm test
npm run test:visual
git diff --check
```

Cloud browser execution uses `/usr/bin/chromium` through an external Playwright configuration that preserves the committed projects and inherited network proxy. It only changes the executable, worker count and artifact directory. The hosted workflow uses Playwright's installed Chromium.

Exact cloud matrix command: `npm run test:visual -- --config /workspace/.onboarding/chess-analyser/playwright.cloud.config.mjs`. The fixture-only recheck adds `visual-tests/practice-studio.spec.mjs` to that command.

New unit cases cover typed minimal writes, empty histories, preserved legacy totals, replayed attempt IDs, disjoint UTC boundaries, distinct-position/reveal counting, same-position first-try comparisons, insufficient samples, incomplete coverage, expiry, the 500-event cap, corrupted/future formats, chronological ordering and format filtering.

A warm cloud Node microbenchmark of the maximum 500-event, 30-day summary over 100 runs measured a 0.30ms median and 1.53ms 95th percentile. This checks the bounded calculation, not physical-device rendering performance.

New browser journeys cover empty and populated Lit rendering; valid SVG charts; keyboard and period selection; touch sizes; legacy totals; no engine/framework-CDN work on load; exact same-position comparisons; separate reviewed-game evidence; actual native Stockfish retry/reveal/solve/reload; duplicate events; dated storage failure; account isolation; unknown versions; offline interaction; reduced motion; shared sound preferences and event deduplication; cancellation and failed-scan recovery. Deterministic activity and trend fixtures illustrate UI states, not genuine user improvement. The native-engine scenario obtains and rechecks actual Stockfish recommendations.

The full matrix also retains the real repeated Review/Back journeys, delayed restoration, native-engine completion/cancellation, mobile coach-dock hit testing, player comparison, Scout, puzzles and audio regressions. Hosted CI and visual QA are required before merge. These Chromium checks do not validate physical-device haptics, speaker quality or Safari.

## Visual evidence

The archived base and current branch use identical synthetic saved-game/activity fixtures. Before and after component exports are included for all requested widths. Component-only captures clip the unrelated fixed navigation for an unobstructed export; ordinary viewport screenshots retain navigation.

| Width | Before | After |
| --- | --- | --- |
| 360px | [Before](screenshots/practice-before-360.png) | [After](screenshots/practice-after-360.png) |
| 393px | [Before](screenshots/practice-before-393.png) | [After](screenshots/practice-after-393.png) |
| 430px | [Before](screenshots/practice-before-430.png) | [After](screenshots/practice-after-430.png) |
| 1280px | [Before](screenshots/practice-before-1280.png) | [After](screenshots/practice-after-1280.png) |

Normal viewports: [360px](screenshots/practice-viewport-360.png), [393px](screenshots/practice-viewport-393.png), [430px](screenshots/practice-viewport-430.png), [desktop](screenshots/practice-viewport-1280.png).

Reviewed-game view: [393px](screenshots/practice-reviews-393.png), [desktop](screenshots/practice-reviews-1280.png).

Home hierarchy: [before mobile](screenshots/practice-home-before-393.png), [after mobile](screenshots/practice-home-after-393.png), [before desktop](screenshots/practice-home-before-1280.png), [after desktop](screenshots/practice-home-after-1280.png).

Inspected every linked image. Text and controls wrap within each requested width; the SVG chart aligns with its range control; the primary practice action is reachable near the section heading; native keyboard focus and all new button target sizes are covered by browser checks. The normal mobile captures retain the bottom navigation, and the desktop section heading clears the sticky bar. Inspection caught and corrected a missing arrow glyph, chart letterboxing and the desktop scroll offset before these final captures. All capture runs reported no horizontal overflow or page errors. The card scrolls vertically on smaller displays; its optional comparison explanation is collapsed initially.
