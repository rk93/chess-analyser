# Premium sound, haptics and interaction feedback

Base: `b753246` (merged PR #64). Dedicated branch: `codex/premium-feedback`.

## Behaviour and preferences

The original two-tone move function and press-feedback listener now use a shared controller. The existing `chess-analyser-pref:sound` on/off setting is preserved. A user with no saved sound choice starts muted; other defaults are **Classic**, **35% volume**, **haptics on where supported**, **UI taps off**, and normal animations unless the device requests reduced motion.

Settings adds bounded volume, Classic/Soft/Modern themes, light haptics, optional UI taps, reduced animations and an explicit capture-sound preview. Changing a setting or loading the page never previews audio automatically. Sound and haptics remain independent; existing optional coach speech retains its own controls.

| Source | Meaningful feedback |
| --- | --- |
| Game Review | Adjacent forward moves use actual SAN/flags for move, capture, check, mate, castling and promotion; known participant results support victory/defeat/draw at the ending; backward/jump navigation uses a quiet transport cue; loading a source position is silent |
| Analysis Board and Explorer | Legal selection and move targets, optional selection/capture haptics, illegal-attempt feedback, piece motion and rook motion for castling; DOM square coordinates stay accurate when flipped |
| Puzzles and training | Distinct incorrect/success sounds, one sound for a terminal puzzle outcome, a distinct actually earned streak milestone, brief visual response and optional completion haptics |
| Completed reviews | A single fresh verified-completion event; cached and off-screen completions do not sound |
| Home, Games, Analytics, Friends & Players and other screens | Reused press/focus feedback, short route fades and separately opt-in UI taps; rendering existing personal bests is silent |

Where multiple move properties apply, one sound wins: mate, promotion, check, castle, capture, ordinary move. Puzzle/training completion replaces the ordinary move sound for that outcome. Achievement sound replaces puzzle success on a milestone; effects do not stack multiple sounds.

## Lifecycle and performance

- No AudioContext before a trusted pointer, keyboard or accessibility click and a requested audible action. Programmatic startup navigation/moves cannot unlock audio.
- One lazy context per document, with generated mono buffers cached by event/theme. All waveforms are original deterministic percussion/chimes; no Chess.com or other sound files are copied or fetched. Source generation is brief and bounded.
- Only one active voice. New events stop/disconnect the previous source and gain; ended nodes disconnect, and page hide disposes context/buffers. Resume failures, unavailable APIs and vibration errors are contained.
- Mute, volume zero and changed preferences stop pending audio. Navigation (including direct Settings and saved-game requests), visibility loss and reduced-motion changes cancel audio and motion; enabling reduced animations also immediately cancels active motion. Async AudioContext resume checks its generation/context again before starting.
- Fast review playback at 300/500ms is silent, including its initial guided step and replay rewind. Relaxed playback can sound once per move; autoplay never vibrates. Automatic puzzle replies are silent. A singular fresh review-completion chime is independent of the following fast move playback.
- Puzzle reply timers and guided-review initial callbacks are identity/lifecycle guarded. Leaving a puzzle cancels its reply; returning can resume the pending reply silently.
- New piece motion is 125ms, screen fades 120ms, and success/incorrect pulses are brief. Animations use existing elements, never change legal moves or engine evaluations, and cancel on route cleanup. Both the app setting and system `prefers-reduced-motion` suppress animation while preserving immediate selected states and legal targets.
- Existing game libraries, IndexedDB schemas, review/engine calculations, source attribution and coaching data are preserved. Service-worker cache is bumped and includes the shared controller assets for the existing offline shell.

## Validation

Final clean run on 2026-11-03: **172 unit tests and 232 Playwright checks passed**, with no failures or skips. The browser matrix covers 360px, 393px and 430px touch viewports plus 1280×900 desktop; it includes the final direct-Settings and manual-navigation cleanup assertions.

| Check | Command | Result |
| --- | --- | --- |
| Complete unit suite | `npm test` | 172 passed |
| Complete browser suite | `npm run test:visual -- --config /workspace/.onboarding/chess-analyser/playwright.cloud.config.mjs` | 232 passed in 5.6 minutes |
| Patch whitespace | `git diff --check` and `git diff --cached --check` | Passed |

The external cloud config extends the committed Playwright config with the installed Chromium executable, the inherited session proxy and external report paths. TLS verification remains enabled; no scenarios are removed. Hosted CI runs `npm test` and `npm run test:visual` using the repository workflows and its Playwright-installed Chromium.

Unit coverage exercises preferences/defaults and corrupt/unavailable storage, semantic precedence, real participant results, trusted activation gating, mute/volume-zero, independent haptics, deduplication, UI-tap priority, rapid/relaxed autoplay, hidden contexts, pending resume cleanup, rejected/missing APIs, buffer reuse/disconnection and finite original waveforms for all events/themes.

Browser coverage uses actual Chromium AudioContext/AudioBufferSourceNode methods with test-only audit wrappers. It verifies source counts, one context, applied gain, distinct waveform signatures, legal positions, flipped-board motion, puzzle/training outcomes, earned milestones, real review transport, cached/fresh/late completion routing, immediate cancellation of manual voices during navigation, cancellation after autoplay deadlines, unsupported APIs, UI taps, persistence, keyboard/touch targets and reduced motion. Vibration is audited through a stub; physical vibration and subjective speaker/timbre comfort still depend on real hardware.

Existing Home, comparison, Scout, weakness, real Stockfish personal training, review, puzzles, offline and browser-back regressions remain enabled. Public-service test scenarios use fixtures. No new live API capability is claimed.

Cloud verification uses Chromium 154 with TLS verification enabled. CI retains Playwright 1.56.1 on supported Ubuntu 24.04. Viewport checks do not replace a physical iOS/Android audition. Safari's prefixed AudioContext and browsers without audio/vibration are handled; only the available Chromium browser is exercised end-to-end here.

## Screenshots and motion

Before captures serve archived, unmodified `b753246`. Both states use default settings and a real starting chess position, selected on e2. Settings and board views are captured at 360/393/430px and 1280×900 desktop. A native Web Animation is also paused at its 60ms midpoint to inspect actual piece motion; final legal piece positions are checked separately.

| View | Before | After |
| --- | --- | --- |
| Settings, 393px | [Before](screenshots/feedback-settings-before-393.png) | [Controls](screenshots/feedback-settings-detail-393.png), [full page](screenshots/feedback-settings-after-393.png) |
| Settings, desktop | [Before](screenshots/feedback-settings-before-1280.png) | [After](screenshots/feedback-settings-after-1280.png) |
| Board selection, 393px | [Before](screenshots/feedback-board-before-393.png) | [After](screenshots/feedback-board-after-393.png) |

Additional inspected captures: [360px controls](screenshots/feedback-settings-detail-360.png), [430px controls](screenshots/feedback-settings-detail-430.png), [desktop board](screenshots/feedback-board-after-1280.png), and [piece-motion midpoint](screenshots/feedback-motion-393.png).

Inspection confirmed readable settings without clipped theme labels, visible selected squares and legal targets, actual moving pieces, and accessible navigation. Automated width checks found no horizontal overflow at all four widths. Captures wait for the real piece artwork to load. Generated reports and logs remain outside the repository; representative images accompany this report.

Required hosted CI must pass before merge. GitHub API access may still require the previously documented environment change; native Git push and a manual PR link are the fallback.
