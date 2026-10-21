# Chess Analyser — Play Store Release Readiness (21 October 2026)

## Automated checks included in this PR
- Service worker install degrades gracefully when some optional files fail to download.
- Only same-origin assets are cached by the service worker; requests to Chess.com, Lichess, chess APIs and third-party CDNs bypass it.
- App shell can display a cached homepage after one successful online visit and service worker activation. This does **not** guarantee all chess features work offline.
- The UI has an unobtrusive offline banner and a retry control; it does not resize the chessboard.
- Unit checks cover the manifest scope and service-worker behaviour; mobile browser checks cover offline navigation and stable layout.

## Important known risks / manual release blockers
1. **Full offline use isn't guaranteed.** chess.js and some chess-piece artwork are imported from a third-party CDN at runtime. Pre-bundling or vendoring all dependencies is needed before advertising complete offline mode.
2. **Android TWA verification**: test signed AAB/APK from a Play internal-testing track, on real Android device(s), and verify Digital Asset Links at `/.well-known/assetlinks.json` of the live origin. GitHub Pages origin ownership and cert fingerprints must match the Android package. No Android build files are in this web repository's current default branch.
3. **Android Back / lifecycle**: test system gesture and button Back, home exit, app resume after process eviction, Chrome/TWA behavior, and external auth redirects on a physical device. Browser Playwright tests are valuable but not a replacement.
4. **Privacy and declarations**: review `privacy/index.html` against actual API/CDN/token data handling, external services, Data Safety answers, target audience, account requirements, and screenshots before submitting.
5. **Network / resource benchmarking**: measure cold startup, warm startup, memory while evaluating a long PGN, repeated game review, network interruption, and low-memory app restore on representative phones. No real-device performance numbers are claimed.
6. **Icons and store assets**: confirm final PNG/adaptive Android launcher assets and Play Store listing material. PWA manifest includes SVG icons, which are not a substitute for verifying Android resources.
7. **App identity**: avoid implying affiliation or endorsement from Chess.com or Lichess. Pip is an original mascot; externally sourced chess-piece SVGs require licence verification before commercial distribution.
8. **Production deployment**: ensure main branch publishes successfully and clear stale SW caches after version changes.

## Safe release recommendation
Proceed first to Play internal testing, rather than production, after validating these points and collecting crash/performance feedback.
