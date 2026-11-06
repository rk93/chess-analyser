# Verified tactical motifs

Base: `36ca4f6` (weekly coach merged in PR #67). Branch: `codex/review-navigation-and-tactics`. The branch was updated to this newly merged base before final integration and validation.

## Acceptance and evidence

- Extend the existing saved-review reader, weakness report and personal-training discovery. No second engine, analysis pipeline or puzzle-progress store. Public opponent results never supply a tactical label.
- A checking knight fork must be a legal recommended knight move, directly checking the king and attacking a queen/rook. Simulate **every** legal opponent reply; at least one original target must still be legally capturable by that knight. Reject defences that capture the knight or leave it pinned. This deliberately omits non-checking forks and speculative material gains.
- An absolute pin must be a newly created legal bishop/rook/queen ray through one opposing knight/bishop/rook/queen to its king, with no intervening pieces. Reject existing pins, blocked rays and any legal reply that captures the pinner. Pinned pawns and relative pins are outside this initial scope. The explanation states the movement restriction, not a guaranteed material gain.
- Starting positions cannot already have the nonmoving king in check. Invalid FEN/UCI, illegal moves and unavailable board support supply no motif. Existing mate/capture fallback labels remain available; a capture alone does not establish a hanging-piece diagnosis.
- Named motifs in either Home or practice require complete exact versioned saved reviews, depth ≥8 and verified player-side mistake candidates. Named practice motifs also require a positive player-perspective evaluation loss; Home retains its existing loss gate. Recurring Home observations need three distinct games within one time control; eligible clean reviews remain in the denominator. Source positions retain exact FEN, ply, depth, side and game identity.
- The existing weekly plan prioritises a qualifying specific motif over generic repeated blunders. Home evidence contains a plain explanation and the existing source-game/position actions. Practice retains its fresh native Stockfish depth-12 solution check. The motif lesson is hidden before solving or revealing, then available in a collapsed inline section. Retry, navigation and position changes hide/reset the lesson. Revealed solutions continue to count as assisted practice in the original storage.
- Rendering Home does no engine or remote work. Existing explicit scans stay bounded to 60 games and retain cancellation/account guards. No storage migration, changed chess legality, new audio, credentials or public data fetching. The updated offline shell includes the classifier.
- The existing browser chess.js 1.4.0 dependency is also installed as a **development-only** dependency for real legal-position unit tests. Unit CI now installs dependencies before testing; there is no additional production library/download.

## Verification

The final complete unit suite passed **200 tests**. The final full Playwright matrix passed **330 scenarios in 10.4 minutes** at 360px, 393px, 430px and 1280px. All 20 tactical scenarios and all 40 weekly-coach scenarios are included, alongside the complete navigation/review/audio/puzzle/comparison regressions. No failed or skipped checks remain. See [navigation validation](NAVIGATION-LIFECYCLE-VALIDATION.md) for the exact commands and negative-control results on archived main. `git diff --check` passed.

Real-position unit cases include White/Black symmetry, queen and rook targets, capturable knights, pins on knights after king replies, blocked opening rays, diagonal and orthogonal pins, existing/relative pins, removable pinners, invalid input, player-side/exact/depth gating, and per-format distinct-game minima. The adversarial `R2rk3/1r6/8/8/2N5/8/8/3K4 w - - 0 1` position is important: after `Nd6+`, only some defences leave `Nxb7` legal, so it must not be called a reliable fork.

The browser flows exercise saved evidence without a worker, the three-game minimum, incomplete metadata in practice, account switching, exact source position/game routes, offline cache use, reduced motion, touch targets and a native Stockfish fork exercise through reveal/retry/solve/progress/reload. Deterministic evidence/UI records are synthetic fixtures. The dedicated native-engine scenario obtains depth-12 evaluations and its actual recommendation before creating the saved fixture, then checks the solution again before practice. This verifies the integration without claiming that arbitrary fixture labels are real engine diagnoses.

Hosted CI must pass before merge. Chromium viewport checks do not verify Safari, physical haptic/speaker quality or broader tactical motifs.

## Screenshots

| View | Before | After |
| --- | --- | --- |
| Home growth areas, 393px | [Before](screenshots/motifs-before-393.png) | [After](screenshots/motifs-after-393.png) |
| Home growth areas, desktop | [Before](screenshots/motifs-before-1280.png) | [After](screenshots/motifs-after-1280.png) |
| Personal practice choices, 393px | [Before](screenshots/motifs-practice-before-393.png) | [After](screenshots/motifs-practice-after-393.png) |
| Solved-position lesson, 393px | [Before](screenshots/motifs-lesson-before-393.png) | [After](screenshots/motifs-lesson-after-393.png) |

Additional inspected evidence: [source explanations](screenshots/motifs-evidence-393.png), [360px lesson viewport](screenshots/motifs-lesson-viewport-360.png), [430px lesson viewport](screenshots/motifs-lesson-viewport-430.png).

Captured before/after at 360px, 393px, 430px and 1280px using the same saved-game/evidence fixture on the archived main and working branch. All captures reported no horizontal overflow or page errors. Inspected all linked images: card labels wrap, identical-position explanations are shown once with every source link retained, desktop cards align, and the lesson is readable above the dock with navigation available. Component-only exports temporarily clip unrelated fixed overlays; ordinary lesson and navigation viewports retain them. The board/practice flows are verified separately by native-engine browser tests.
