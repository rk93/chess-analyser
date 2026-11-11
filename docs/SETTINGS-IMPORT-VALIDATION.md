# Settings imports and recovery sync

Base: main `3142de1aa75ebc894d5a2023409811ecc6bc0d32`, after PR #72. Branch: `codex/settings-game-import-sync`.

## Result and scope

Settings starts with a game-library section: personal Chess.com username/range/sync, a public-player importer with Chess.com/Lichess selection, saved study collections and expandable tips. Collections offer Open games, Sync latest, Load older games and a two-step Remove collection action. Removing a collection preserves personal saved games. Settings' independent sync refreshes Home and Games without reloading the page. The Games Sync button updates the active personal or study collection.

The previous two Chess.com implementations competed: the original automatic importer had a 24-hour guard, while `import-fix.js` intercepted manual clicks, rescanned all history for compact Sync and forcibly reloaded the page. Both now delegate to the shared controller. Automatic checks retain a 24-hour guard; explicit manual sync revalidates recent archives. No new authentication flow, second review engine, framework or dependency is introduced.

Personal Chess.com games keep the existing `rk93-chess-analyser` v1 database. Public study collections use a separate `chess-analyser-study-games` v1 database; they never write to the personal games store or change `chess-username`. Lichess study collections, including the user's own Lichess account, do **not** power the Chess.com Home dashboard or mix ratings with it. Friends & Players keeps its separate existing comparison samples.

The existing cards, sorting, result filters, source labels, keyboard actions, PGN replay and authoritative Stockfish Review serve study games. Lichess profile initials are shown without querying Chess.com for a same-named user. The Review result sound uses the reviewed player's perspective. Classical and correspondence have distinct library filters; no cross-platform rating comparison is introduced.

## API evidence and limits

The official Lichess OpenAPI [user-export definition](https://github.com/lichess-org/api/blob/master/doc/specs/tags/games/api-games-user-username.yaml) explicitly describes anonymous exports, 20 games/second throttling, reverse chronology, streaming, `max`, `until`, `pgnInJson` and finished/ongoing filters. The [GameJson schema](https://github.com/lichess-org/api/blob/master/doc/specs/schemas/GameJson.yaml) supplies variant, players, ratings, timestamps, result, clock and PGN fields. Both upstream files were read on 11 November 2026.

- `GET https://lichess.org/api/games/user/{username}` uses `Accept: application/x-ndjson`, `max=300`, `pgnInJson=true`, `ongoing=false`, `finished=true`, supported standard-chess performance types and no credentials. Neither the existing optional Explorer OAuth token nor a password is used.
- The importer streams and decodes fragmented UTF-8 NDJSON, bounds response size/record count, rejects ongoing/variant/anonymous/unrelated or unsupported-result records and preserves distinct site URLs. Completed PGNs feed the existing review input shape. Book/engine scores are not fabricated from exports.
- `until` uses the last consumed game's **creation timestamp**, in milliseconds, rather than its finish timestamp. Latest sync deduplicates, and explicit older batches advance the cursor. A full new latest page resets an older cursor to permit filling a gap before previously saved history.
- Chess.com requests use documented public archive URLs, restricted to the requested player and site, sequentially. Latest checks the latest two active archives plus newly discovered months; historical imports take at most 12 months per action. Completed archive metadata advances only after persistence; failure/cancellation retains completed batches for safe retry.
- Up to 12 public study collections and 2,000 saved games per collection are retained. These are bounded downloaded histories and may be incomplete; neither a latest sync nor an empty sample proves complete lifetime coverage. Personal saved games are not truncated.
- HTTP errors, invalid usernames, unknown public users, timeouts, storage failures and cancellation have visible status. A 429 honors Retry-After, with at least a minute before this client retries. Browser revalidation is requested on explicit sync. Imports themselves do no Stockfish work.

Live Chess.com/Lichess traffic is outside this environment's enforced network allowlist. API contracts were checked from the official upstream source; browser integration uses controlled public-API responses, not a claimed live import. A real-device public-user import remains part of release smoke testing. Browser viewport tests also do not establish physical Android lifecycle/audio/vibration performance or Play Store readiness.

## Verification

Thirteen new unit tests cover legal PGN normalization, result/clock/source semantics, rejected inputs, same-name identities, deduplication, URL restrictions, historical pagination, sequential cancellation, fragmented streaming, hard limits, rate-limit recovery, malformed/error responses and concurrent-job prevention.

Eight new browser scenarios run at 360px, 393px, 430px and 1280px: manual freshness bypass and Home refresh without a reload; same-name Lichess isolation/persistence/native Review; other-player Chess.com import/active collection sync/confirmed removal; cancellation and retry; invalid usernames/rate limits/offline replay; creation-cursor history; interrupted personal history recovery; real IndexedDB bounds/cursor/deduplication and personal-data preservation. Touch-target and horizontal-overflow assertions cover the new Settings controls. Existing navigation/review regressions remain in the full matrix.

Final local validation passes **234 unit/integration tests**, the UI bundle build check and **494 Playwright checks**, with no failures, missing tests, skips, retries or flaky results. The browser report matches the complete manifest: 129 checks at each mobile width and 107 on desktop, in 678 seconds. [Sanitized results](screenshots/settings-import/test-results.json).

Unit tests use Node 20.20.2. Browser tests use Node 22.23.4 and the separately installed Sparticuz Chromium 141.0.7390.0 binary; hosted Playwright uses Chromium 141.0.7390.37. The local run matches the major version, not the exact hosted build. No browser package or application dependency was added to the repository. Hosted CI remains a separate merge gate.

All twelve Settings before/after and study-library captures below were inspected. The new controls have minimum 44px targets, no horizontal overflow and clear source/ownership labels. The full-page mobile images include the fixed navigation at its viewport position; actual route/hit-target checks also pass in the browser suite. Names, dates, ratings and game counts in these captures are controlled fixtures, not live player observations.

| Viewport | Settings before | Settings after | Lichess study library |
| --- | --- | --- | --- |
| 360px | [Before](screenshots/settings-import/settings-before-360.png) | [After](screenshots/settings-import/settings-after-360.png) | [Games](screenshots/settings-import/study-games-360.png) |
| 393px | [Before](screenshots/settings-import/settings-before-393.png) | [After](screenshots/settings-import/settings-after-393.png) | [Games](screenshots/settings-import/study-games-393.png) |
| 430px | [Before](screenshots/settings-import/settings-before-430.png) | [After](screenshots/settings-import/settings-after-430.png) | [Games](screenshots/settings-import/study-games-430.png) |
| Desktop, 1280px | [Before](screenshots/settings-import/settings-before-1280.png) | [After](screenshots/settings-import/settings-after-1280.png) | [Games](screenshots/settings-import/study-games-1280.png) |
