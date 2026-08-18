# Dev setup

GritMap uses an Expo development build, not Expo Go (`docs/MVP.md` line 17). This is a
platform requirement independent of any specific feature — some dependencies (navigation's
native modules today; a map library, a local sync server, etc. later) need native code that
Expo Go doesn't ship.

## Prerequisites

- Xcode (for iOS) with CocoaPods (`gem install cocoapods` or `brew install cocoapods`).
- Android Studio (for Android), with an emulator image created. No physical Android device is
  required or used for MVP development — see `docs/MVP.md` line 15-16 (no live GPS dependency).
- Node matching this repo's CI (`.github/workflows/ci.yml` uses Node 26).

## Commands

- `npm run prebuild` — regenerates the `ios/`/`android/` native projects from `app.json` +
  installed native dependencies. Run this after adding or upgrading any native dependency (a
  new Expo config plugin, a native module like a map library). Both native project directories
  are committed to the repo (not gitignored — only build *artifacts* under them are, e.g.
  `ios/Pods/`, `android/build/`), so review the diff after running it.
- `npm run ios` — builds and launches the dev client in the iOS Simulator (`expo run:ios`).
- `npm run android` — builds and launches the dev client in the Android emulator
  (`expo run:android`).
- `npm run start` — starts the Metro bundler for an already-installed dev client
  (`expo start --dev-client`). Use this for fast-refresh iteration once `npm run ios`/`android`
  has installed the dev client once; you don't need to rebuild the native app for JS-only
  changes.
- `npm run web` — runs the web target, used only for CI's `web:smoke` build check; the app has
  no supported web runtime target per `docs/MVP.md`.

## Known gotcha: CocoaPods requires a UTF-8 locale

`pod install` (run automatically by `npm run prebuild` and `npm run ios`) fails with
`Encoding::CompatibilityError: Unicode Normalization not appropriate for ASCII-8BIT` if the
shell's `LANG`/`LC_ALL` aren't UTF-8 — this shows up in shells that don't set a locale by
default (some CI runners, some non-interactive shells). Fix by adding to your shell profile:

```bash
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
```

or exporting them inline for a single command: `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npm run ios`.

## Why not Expo Go

Expo Go bundles a fixed set of native modules and can't load a project's own native
dependencies. Anything requiring native linking (`react-native-screens`,
`react-native-safe-area-context` today; a future map library or local HTTP server) needs a
custom dev client instead, built once via `npm run ios`/`npm run android` and reused across
Metro sessions until a native dependency changes.
