# Friends & Players validation

This increment starts from `main` commit `07c62ab` (PR #61). It replaces the existing comparison interface rather than adding another Friends screen. It adds no dependencies and changes no IndexedDB schema or personal game records.

## Verified results

- `npm test`: **128 passed**, zero failed, skipped or cancelled.
- Full Playwright run: **104 passed** across 360px, 393px, 430px and the desktop Friends & Players project.
- Final clean run completed successfully after the keyboard-focus and compact-profile checks.

## Acceptance coverage

- The configured username is selected automatically. Recent opponents, favourites and recent searches are labelled by their actual source.
- Keyboard autocomplete, touch selection, Escape dismissal, exact new usernames and account-scoped saved names are covered. Typing and saved-game comparisons make no new public API or Stockfish requests.
- Overview covers Bullet, Blitz, Rapid and Daily; format drilldowns show rated-observation trends, recent form and colour scores. Both users share the selected date window.
- Saved games, public samples and lifetime statistics remain distinct. Missing public records are unknown, not invented zero-percent scores. Samples are never imported into the Games library.
- Public client tests cover sequential bounded archives, cache reuse, server freshness headers, no-store, no-cache, 304 policy inheritance, stale offline data, explicit refresh, Retry-After and aborts.
- Opening results require five completed games per opening/colour/format group; opponent-strength scores require five games per band. Opening and head-to-head replay use the existing Analysis Board/history controls, with no automatic engine analysis.
- Head-to-head encounters are deduplicated across both samples. The empty state says none were found in the selection.
- Mobile coverage includes no horizontal overflow, visible 44px touch targets, selected profile cards above the fixed navigation, reduced motion and reliable return from replay.

The complete suite is run at 360px, 393px and 430px; the Friends & Players flow also runs in the 1280×900 desktop project. Existing Home, game-review, training, navigation, puzzle and offline regressions remain enabled. The cloud uses its installed Chromium and configured proxy through an external config override; repository CI retains its standard Playwright browser installation.

## Before and after

These original browser captures use the same deterministic 16-game local fixture for visual comparison. Public profiles/avatars/ratings in the after screenshots are explicit API fixtures, not claims about real users. The smaller sample intentionally displays “Small sample” for opening performance. The application does not generate those fixture statistics in production.

| Viewport | Before | After |
| --- | --- | --- |
| Mobile, 393px | [Original form](screenshots/friends-before-393.png) | [Discovery and four-format comparison](screenshots/friends-after-393.png) |
| Desktop, 1280px | [Original form](screenshots/friends-before-1280.png) | [Profile cards, comparison bars and study links](screenshots/friends-after-1280.png) |

Before and after were also captured at 360px and 430px during development. Rendered screenshots were inspected for clipping, scrolling and navigation. Full-page captures show the fixed navigation at its original viewport position; scrolling keeps it at the viewport edge.

## Performance and remaining limits

A synthetic local calculation covering 10,000 games, both players, all four format summaries, opening groups and deduplicated head-to-head encounters completed in approximately 191ms in this cloud environment. This is a calculation check, not a mobile-device performance benchmark. PGN parsing for study is lazy and capped; initial comparison does no engine work.

Official Chess.com documentation/API and the GitHub API are currently blocked by the environment proxy. Public-service scenarios are tested with fixtures; live service availability and the current official friends-list capability are unverified. See [research and data contracts](FRIENDS-DISCOVERY-RESEARCH.md). A real-device keyboard/touch check remains useful before release. Remote CI and merge eligibility must be checked on the PR; never bypass required checks.
