# Pip welcome, review progress and tactile controls

Base: merged PR #65, `56cf236949af8a0af4f588ba8d1ca10d213894f4`. Branch: `codex/pip-welcome-review-engagement`.

## Behaviour and acceptance

- First Home visit offers **Begin with sound** and **Continue silently**, without blocking access to any screen. The explicit choice is remembered per browser. Choosing sound enables the existing master preference only when no explicit preference was previously saved. Existing mute disables the sound choice until the user changes Settings. The silent choice preserves an existing enabled preference while skipping this introduction.
- The original adventure composition is generated lazily through the existing AudioContext, gain and voice controller. Classic/Modern use a 4.3s miniature fanfare; Soft uses a 3.1s plucked melody. Existing volume, visibility and navigation cancellation apply. No recordings, audio downloads, page-load sounds or separate player are introduced.
- Game Review shows actual completed positions in the first engine pass and actual completed critical checks in the next phase. Counts include the starting position, so six moves require seven positions. Startup and public-preview work remain indeterminate. Each progress bar describes its own phase; it is not a whole-review percentage or time estimate.
- Five concise study tips can be explored while analysis runs. They are labelled as general guidance, with no claim that an unfinished engine review discovered a particular weakness. There are no artificial delays, looping waiting sounds or per-position pings. An explicit review start has one brief cue; the existing fresh verified-completion event owns the completion chime.
- Stop and navigation cancellation abort the active local search using UCI `stop`. The shared engine waits for that search's `bestmove` before starting the next queued position, preventing an old result from being assigned to a new search. Aborted queued tasks never start. Signal, review-key and generation checks prevent cancelled results from publishing into a later review. Changing Reduce Motion stops visual feedback without cancelling the analysis. Existing in-flight public-preview requests may finish within their original timeout; cancellation prevents further planning and late UI publication.
- Retry follows the existing review path. A stopped preview can still be explored. Unverified guidance is labelled **Review preview**; completed verified guidance is labelled **Review ready**. The waiting card occupies the existing guide column on desktop and sits above the board on mobile, preserving board dimensions and existing navigation.
- Buttons, native checkbox/select interactions and rating-chart steps reuse the shared controller. UI sounds remain off by default; light haptics are independent. Range feedback is limited to one tick per 120ms. Carousel feedback follows a completed user scroll that changes the selected card, rather than every pixel or programmatic layout scroll. Settings changes remain silent except for the existing explicit preview button.
- Existing saved game data, IndexedDB schemas, public comparison samples, engine evaluations, review classifications and depth choices remain intact. No new dependencies or external services. The service-worker shell is bumped to v91 and includes the new shared modules.

## Validation

Final clean run on 2026-11-03: **177 unit tests and 260 Playwright checks passed**, with zero failures and zero skips. This includes all 28 new Home/review checks across 360px, 393px, 430px and 1280×900 desktop, plus the existing regression matrix.

| Check | Command | Result |
| --- | --- | --- |
| Complete unit suite | `npm test` | 177 passed |
| Complete browser suite | `npm run test:visual -- --config /workspace/.onboarding/chess-analyser/playwright.cloud.config.mjs` | 260 passed in 6.7 minutes |
| Patch whitespace | `git diff --check` and `git diff --cached --check` | Passed |

The external cloud config extends the committed project matrix with installed Chromium, inherited session proxy and external report paths. It removes no tests and keeps TLS verification enabled. Final browser assertions include changing system Reduce Motion during a held native review without stopping the engine, followed by explicit Stop and a successful Retry.

Unit coverage includes the bounded original score in all themes, actual progress phases and invalid counts, independent/throttled UI feedback, and a controlled shared-worker queue proving that cancellation drains its result before the next search starts.

Browser coverage uses real Chromium audio nodes and real Stockfish. A test-only wrapper holds the third `go` command after two actual positions complete, allowing deterministic progress, Stop, Retry and navigation assertions. It releases the native search on Stop so the real engine still emits its own `bestmove`; completed reviews are produced by the real engine. Cached public-preview data is a separate labelled fixture. Tests also cover silent/muted welcome choices, reload, missing hardware, reduced motion, keyboard slider input, native wheel/scroll events, quiet programmatic updates and mobile/desktop board dimensions.

All pre-existing Home, personal training, comparison, Scout, weakness, puzzle, review, offline and browser-back suites remain enabled. Haptics are audited through a vibration stub; physical vibration, speaker comfort and Safari have not been tested on devices. Cloud browser runs use installed Chromium with inherited proxy and TLS verification. The existing CI workflow is retained, with its timeout increased from 15 to 20 minutes for the expanded matrix; no scenarios or checks are removed. Hosted CI must pass before merge.

## Screenshot evidence

Before screenshots serve archived unmodified `56cf236`. Both versions use the same viewport and actual native engine held after two completed positions. The old status shows the third in-flight position; the new panel correctly says two positions are completed. Captures wait for the real piece artwork.

| View | Before | After |
| --- | --- | --- |
| First Home, 393px | [Before](screenshots/pip-home-before-393.png) | [After](screenshots/pip-home-after-393.png) |
| Review wait, 393px | [Before](screenshots/pip-review-before-393.png) | [After](screenshots/pip-review-after-393.png) |
| First Home, desktop | [Before](screenshots/pip-home-before-1280.png) | [After](screenshots/pip-home-after-1280.png) |
| Review wait, desktop | [Before](screenshots/pip-review-before-1280.png) | [After](screenshots/pip-review-after-1280.png) |

Additional mobile checks: [360px Home](screenshots/pip-home-after-360.png), [360px review](screenshots/pip-review-after-360.png), [430px Home](screenshots/pip-home-after-430.png), [430px review](screenshots/pip-review-after-430.png).

Screenshots were visually inspected at 360px, 393px, 430px and 1280×900. The welcome choices and review actions remain readable and tappable, hidden actions stay hidden, the desktop board retains its original 493px column, and navigation stays accessible. Automated capture checks found no horizontal overflow in either state at all four widths. Independent browser assertions also check actual board width while the engine is held, preventing a collapsed board from passing a text-only progress test.
