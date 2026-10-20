# Android / Google Play packaging

Play Console app ID: `com.kiranova.chessanalyser`  
Publisher: Kiranova  
Website: https://rk93.github.io/chess-analyser/  
Manifest: https://rk93.github.io/chess-analyser/manifest.webmanifest

This project is currently a web PWA. Android packaging will use a Trusted Web Activity (TWA), so the deployed website remains the source of the user interface.

## One-time initialization (needed before the Android workflow can build an AAB)

On a machine with Node.js 22+, JDK 17, and Android SDK:

```bash
npm install -g @bubblewrap/cli
mkdir -p android/twa
cd android/twa
bubblewrap init --manifest https://rk93.github.io/chess-analyser/manifest.webmanifest
```

Answer Bubblewrap's prompts with:

- Application name: Chess Analyser
- Launcher name: Chess Analyser (or a shorter label if requested)
- **Package ID: `com.kiranova.chessanalyser`** (must match Play Console)
- Start URL: `/chess-analyser/`
- Host: `rk93.github.io`
- Version name: `1.0.0`; version code: `1`
- Theme/background: `#262421`
- Target SDK: **36 or higher** (verify `android/app/build.gradle` after generation).
- Use the existing chess app icon. Bubblewrap can use manifest icon URLs, but check generated launcher icons visually.

**Do not commit the generated upload keystore or passwords.** Back it up securely. Commit generated TWA source, `twa-manifest.json` and Gradle wrapper files after reviewing, while excluding keystore files.

If using Play App Signing, protect the *upload key* and keep it consistent for future releases. The first signed bundle's upload certificate may need to be registered in Play Console.

## GitHub Actions builds

Once `android/twa/twa-manifest.json` and generated project exist, run the `Android Bundle` workflow manually. It tests the web code and builds an unsigned verification artifact when signing secrets are absent. For a Play-uploadable signed bundle:

- Configure repository secret `ANDROID_UPLOAD_KEYSTORE_BASE64` (base64 of the keystore).
- Configure `ANDROID_UPLOAD_KEYSTORE_PASSWORD`, `ANDROID_UPLOAD_KEY_PASSWORD`, `ANDROID_UPLOAD_KEY_ALIAS`.
- Trigger the workflow again and upload the resulting signed `.aab` from GitHub Actions artifacts.

The workflow deliberately does **not** generate or upload credentials.

## Trusted Web Activity verification

A TWA only displays without the browser toolbar after Digital Asset Links association is verified:

```json
[{"relation":["delegate_permission/common.handle_all_urls"],"target":{"namespace":"android_app","package_name":"com.kiranova.chessanalyser","sha256_cert_fingerprints":["REPLACE_WITH_PLAY_APP_SIGNING_CERT_SHA256"]}}]
```

Publish that JSON to `https://rk93.github.io/.well-known/assetlinks.json` **in the separate `rk93.github.io` repository**. Use the SHA-256 app signing certificate fingerprint from Play Console; when testing a sideloaded build signed using your upload key, its fingerprint may differ. Do not use a placeholder in production.

Before closed testing: verify offline handling, Chess.com import, PGN loading, Lichess OAuth redirect, Stockfish WASM, mobile board sizing, navigation, and storage persistence. Recheck Play Data Safety: the web app has optional Lichess OAuth and sends Chess.com usernames to external APIs. Complete declarations based on final shipping code.

## Next steps

1. Initialize and commit the generated Android project as described above.
2. Verify target SDK and Digital Asset Links.
3. Configure signing secrets and build a signed AAB.
4. Upload to Play Console internal testing, validate on a physical Android phone, then run the closed test.
