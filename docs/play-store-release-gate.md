# Chess Analyser — Play Store release quality gate

The release candidate is **NO-GO** until all P0/P1 checks below pass. No software can be guaranteed 100% free of defects; use reproducible evidence and zero known critical defects as the shipping criterion.

## Automated checks (required on release commit)
- [ ] Unit and integration tests pass on the exact release SHA.
- [ ] Browser end-to-end tests cover game import, review completion, rapid Next/Previous, direct move selection, jump to first/last move, and switching between games.
- [ ] Verify displayed position FEN equals the active ply, including promotion, castling, checks and final positions.
- [ ] Verify the green best-move arrow is legal in the **currently displayed** position, remains visible after board flip and piece/theme change, and does not point to a previous position.
- [ ] Ensure cached MultiPV lines match the displayed FEN and are never overwritten by late asynchronous responses.
- [ ] Simulate offline mode, rate limits, missing engine, cancelled requests, slow network and corrupted/old review cache.
- [ ] Confirm screen transitions do not unexpectedly repeat expensive analysis or reparse an entire PGN on every navigation click.
- [ ] Check voice toggle, cancellation on navigation/game switch, unsupported speech environments and screen-reader usability.
- [ ] Run browser tests at mobile and desktop viewport sizes; check touch controls, layout, orientation and accessibility.
- [ ] Verify game import errors, storage quota handling and safe recovery from interrupted analysis.

## Reliability and release criteria
- [ ] Zero open P0/P1 issues; no data loss, broken navigation, wrong-board arrows, invalid chess recommendations, or crashes.
- [ ] No console errors or unhandled promise rejections in the standard review journey.
- [ ] Establish measured budgets for review navigation latency, first review result and memory on target Android devices; record baseline and detect regressions.
- [ ] Confirm saved review/game data remains readable after app upgrades and clearing optional caches does not lose game data unexpectedly.
- [ ] Confirm privacy disclosures, permissions, third-party API use, offline behaviour and store listing match the actual distributed build.
- [ ] Test the **installed Android package** (not just GitHub Pages) on at least one low-end and one mainstream device.
- [ ] Complete a closed testing rollout and check crash/ANR feedback before production release.
- [ ] Record the tested commit SHA, app version, test evidence, known noncritical limitations and rollback path.

## Operating rule
Automated daily audits and GitHub Actions may detect defects and open PRs. They must **not** silently merge, publish, or declare Play Store readiness. A release requires a separate documented GO decision after passing the above criteria.
