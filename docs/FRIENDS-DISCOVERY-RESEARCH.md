# Friends & Players: API research and data contracts

Investigated on 2 November 2026 for the Friends & Players discovery/comparison increment.

## Friend discovery decision

No supported public friends-list integration was established. Requests to the official [Published Data API documentation](https://www.chess.com/news/view/published-data-api), [PubAPI terms](https://www.chess.com/terms/pubapi), and `https://api.chess.com/pub/player/rk93` were blocked by this cloud environment's outbound proxy with HTTP 403 before reaching Chess.com.

The accessible [`chess-web-api` README](https://github.com/andyruwruw/chess-web-api/blob/master/README.md), retrieved from `raw.githubusercontent.com`, says its endpoint descriptions are copied from the official documentation. Its player endpoint list includes profiles, statistics, archives, clubs, matches and tournaments, with no public friends method. The npm registry metadata identifies the package as version 1.2.0 and an **unofficial** client. This secondary source does not prove that the current official API lacks a friends capability; the official documentation still needs independent revalidation when access is restored.

Accordingly this increment:

- Uses actual opponents from the configured account's locally saved standard-chess games.
- Adds explicitly labelled, account-scoped manual favourites and recent searches.
- Completes locally known usernames; it does not pretend that a global username-search endpoint exists.
- Lets users enter an exact new username and load its public profile explicitly.
- Never labels opponents, favourites or searches as imported Chess.com friends.
- Does not implement a Chess.com sign-in or OAuth flow: no official authorization flow for retrieving friends was verified.
- Does not request cookies, credentials, private pages or undocumented endpoints.

Do not use the unofficial client's `getGameById` website callback: its own README marks it as an unofficial, unstable endpoint. It is not used by this application.

## Public endpoints used

| Endpoint | Purpose | Limits |
| --- | --- | --- |
| `/pub/player/{username}` | Public username and avatar | Selected players only; cached; HTTPS avatar with initials fallback |
| `/pub/player/{username}/stats` | Current recorded ratings and lifetime W/D/L per format | Standard Bullet, Blitz, Rapid and Daily pools stay separate |
| `/pub/player/{username}/games/archives` | Locate completed-game samples | No full-history fetch; archive URLs must belong to the same user and API origin |
| `/pub/player/{username}/games/{year}/{month}` | Recent PGNs, results, dates, ratings and opening metadata | At most three monthly archives per player; sequential requests; retain at most 6,000 games in the displayed sample |

These are the documented profile, statistics and monthly-game endpoints already supported by the public API integration. Live responses were not verified in this environment; automated public-service tests use labelled fixtures. No active-game endpoints are used.

## Sources must remain distinct

- **Saved games:** records already stored on this device; no new network or engine work. They are not all necessarily engine analyzed.
- **Public sample:** bounded completed-game archives cached separately from the user's Games library. A common selected date window is applied to both players. Three calendar months may not fully cover a 90-day selection; displayed coverage and sample counts remain visible.
- **Lifetime stats:** W/D/L and latest rating observations from the public stats endpoint, per format. These do not contain PGN opening histories or rating time series. Missing records display as unknown, not zero-percent performance.
- **Engine evidence:** none is inferred from a public game result or opening score. Existing verified personal-review/training workflows remain separate.

Head-to-head results deduplicate encounters present in both players' samples. An empty result means no encounters were found in the selection, not that the players have never met. Opening performance requires five completed games in each opening/colour/time-control group. Opponent-strength bands require five games before showing a score, and missing opponent ratings are excluded. Outcomes are descriptive and do not establish tactical or positional weaknesses.

## Caching, privacy and performance

Public loads are user initiated, serial, cancellable and bounded. Cache freshness follows `Cache-Control`, `Age` and `Expires`; absent explicit server freshness, the default is 24 hours. `no-store` responses are not persisted, and `no-cache` responses require revalidation. Browser HTTP caching handles conditional validators; manual refresh uses the browser's supported `no-cache` request mode. HTTP 429 honors numeric or date-form `Retry-After`, with no automatic retry loop.

Stale cached data may be used offline with an explicit stale label. A failed load never replaces the personal Games store. Existing `player-comparison` version-1 sample snapshots remain readable and migrate to resource-level caching after refresh. Cancellation and generation checks prevent late responses from repopulating another account's UI.

Discovery never makes network calls while typing. Opening PGNs are parsed lazily only when replay is requested. Replays reuse the existing Analysis Board/history controls, preserve board orientation, and start no Stockfish computation automatically. No new service, dependency, database schema version or private authentication requirement is introduced.
