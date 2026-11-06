# Review exit and global navigation

Base: `36ca4f6` (main after PR #67). Branch: `codex/review-navigation-and-tactics`.

## Root cause and reproduction

Opening a saved game schedules `restoreReview()` after 120ms. Exiting before that callback runs leaves the same game title/key and, when no quick analysis is running, the old cancellation handler does not invalidate its token. The callback subsequently restores the cached review and unhides `#reviewGuideCard` inside the already hidden `#analysisView`.

Several mobile CSS rules used `body:has(#analysisView #reviewGuideCard:not([hidden]))` to hide global navigation. `:has()` matches that child even when its parent screen is hidden. Those two-ID selectors also outranked the later style-attribute/Home overrides. Games was visible while every bottom tab had `display:none`.

PR #58 (`491d509`) added a mutation observer that cleared classes and inline nav styles. It did not observe late guide-card attribute changes and could not remove this content-dependent CSS match. PR #60 (`365aa6a`) added more style-attribute selectors and immediate exit tests. Several regressions manually changed classes/styles instead of opening a cached game, so no real restore callback was pending. An immediate post-Back assertion could also pass before the 120ms callback fired.

The natural reproduction uses saved PGN/review fixtures and actual Home → Games → saved-game → Back actions. No visibility, classes or history state are injected. All three mobile widths reproduced the failure on the first exit. The recorded state was:

```json
{"reviewDisplay":"none","guideHidden":false,"navDisplay":"none","body":"","screen":"gamesTab"}
```

The permanent delayed-cache test also runs real navigation. It extends the existing 120ms restore timer to 700ms in that test browser only, representing a slow device, then waits past the callback. It changes no CSS, route state or engine result. This removes the accidental masking caused by an extra assertion before Back. The natural reproduction does not use this timing instrumentation.

Baseline comparisons serve an archived main tree using an explicit HTTP-server `--directory`, separate from the working branch. The first comparison-server setup accidentally served the working directory; those comparison passes were discarded and the baseline was rerun against the archive.

## Implementation

- `app-navigation.js` owns the active screen, top-level hidden/display states, selected tab and the semantic `data-chess-screen` attribute. Existing Home, Games, Board, Explorer, Puzzles and Settings entry points delegate to it. Native history restoration uses those same entry points, with Review restoration supported for Forward.
- One mobile CSS rule hides navigation when the route is Review. Remove the old guide-card/body-class/style-substring nav selectors and the repair observer; no repeated CSS overrides, polling or visibility resets on each click.
- Review exit invalidates restoration tokens, cancels pending render/timer work and native analysis, stops playback, closes depth/summary UI and resets guided state. Cached data is preserved. Restore/render/summary/prompt callbacks must still belong to the Review route before touching its UI.
- Training leaves its floating dock when another screen becomes active. No IndexedDB migration, user-data deletion or changed chess/engine calculations. The offline shell includes the shared route controller.
- Completion/reopening coverage exposed another lifecycle race: the stored record lost its native version/depth fields when a late legacy preview overwrote it. The cache now rejects that downgrade, preserves a newer native-review version, permits same-version native reanalysis at another depth and still honours explicit clearing. Late reads and connection openings cannot replace newer in-memory writes. Native completion/reopening now verifies the persisted version, depth, exact positions and absence of a depth dialog; the browser report includes that metadata as an attachment.

## Verification

| Check | Result |
| --- | --- |
| Natural reproduction on archived main | All three mobile widths lost navigation on the first real cached-review exit; before screenshots retained |
| Permanent delayed-cache regression on archived main | Three expected failures at 360px, 393px and 430px: navigation was hidden after Back |
| Complete unit suite, `npm test` | 200 passed; no failures, cancellations or skipped tests |
| Complete Playwright suite, `npm run test:visual -- --config /workspace/.onboarding/chess-analyser/playwright.cloud.config.mjs` | 330 passed in 10.4 minutes; all three mobile widths and desktop, with no failures or skipped scenarios |
| Inspected capture journeys | Ten additional real exits at each of the four widths; visible navigation, no horizontal overflow, no page errors |
| Patch hygiene | `git diff --check` passed |

The clean full-suite run followed all runtime and test changes. Cloud verification uses the committed project matrix through the existing system-Chromium/proxy wrapper, preserving TLS verification; no scenarios are filtered out. Hosted CI remains a separate merge requirement.

The permanent lifecycle suite performs ten complete Home → Games → Review → Back → Home → Games → Review → Back journeys per viewport (20 review exits), alternating the app button and browser Back. Every return crosses the delayed-callback window. It checks bounds, opacity, visibility, touch sizes and `elementFromPoint()` for all eight buttons; every destination is also actually clicked during each cycle. A second scenario uses native Stockfish through Stop, completion, cached reopening and browser Forward/Back. A third repeats Home recent-game → Review → Back ten times. The separate timing scenario checks both Back paths and browser Back while the depth dialog is open.

Previous CSS-simulation regressions in `navigation-return.spec.mjs`, `real-pgn.spec.mjs` and `mobile-review.spec.mjs` are replaced with genuine saved-game/guide actions. The layout case retains its board/control-position, perspective and progress checks while using actual pieces and visible transport controls. The structural unit check now asserts the route contract instead of requiring the old workaround. Four cache tests cover preview downgrades, newer-engine priority, native depth changes, clearing, unrelated namespaces and concurrent writes.

Chromium runs at 360px, 393px and 430px with mobile/touch enabled, plus 1280px desktop. Browser Back exercises the same History API path used by Android Back; these runs do not claim testing on a physical Android device or Safari. Hosted unit CI and mobile visual QA must both pass before merge.

## Before and after

| Width | Archived main, navigation missing after Back | Fixed branch, after ten real exits |
| --- | --- | --- |
| 360px | [Before](screenshots/nav-before-360.png) | [After](screenshots/nav-after-games-360.png) |
| 393px | [Before](screenshots/nav-before-393.png) | [After](screenshots/nav-after-games-393.png) |
| 430px | [Before](screenshots/nav-before-430.png) | [After](screenshots/nav-after-games-430.png) |

Home after review: [360px](screenshots/nav-after-home-360.png), [393px](screenshots/nav-after-home-393.png), [430px](screenshots/nav-after-home-430.png). [Desktop](screenshots/nav-after-games-1280.png). Native Stockfish lifecycle captures: [after Stop](screenshots/nav-after-cancelled-393.png), [after completion](screenshots/nav-after-completed-393.png).

Inspected all linked navigation screenshots. The baseline has no bar; the fixed mobile views show all eight destinations inside the viewport, including Explorer, Puzzles and Settings, with no horizontal overflow or overlapping labels. Normal navigation screenshots use no screenshot-only CSS. Capture checks recorded ten exits at each width, visible navigation, zero page errors and no horizontal overflow. Actual button hit testing and clicks are in the permanent tests; screenshots alone do not prove actionability.
