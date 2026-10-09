# Handoff: expo-font declared; icons verified in a Release build (committed locally, not pushed)

- Updated: `2026-10-09 08:30 PDT`
- Agent: `Claude`
- Head: `build: declare expo-font (required peer of @expo/vector-icons)` (handoff committed on top)

## Outcome

- `npx expo install expo-font` -> `expo-font ~57.0.4` in `package.json` / `package-lock.json` (it was only present transitively at 57.0.1), `pod update ExpoFont --no-repo-update` -> `ios/Podfile.lock` (ExpoFont 57.0.1 -> 57.0.4, checksum). `expo install` also added `"expo-font"` to the **`plugins` array in `app.json`** (no EAS fields touched; it has no effect on the committed `ios/` project but keeps doctor/CNG config consistent). Tell me if you would rather drop that line.
- `ios/` needed `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` for `pod install` on this machine (CocoaPods crashes otherwise).

## Verified

- Unsigned Release build for the iOS simulator, installed on a fresh install (iPhone 17 Pro, seeded demo DB, no dev client, `main.jsbundle` embedded): tab bar icons (flag, bike, map pin), list chevrons and the efforts icons render (`docs/screenshots/release-icons/01-home-tabbar.png`, `02-segment-detail-icons.png`). `ExpoFont.framework` is in the app bundle.
- `npx expo-doctor`: **19/21 pass; only the two expected warnings remain** (non-CNG app.json sync; patch-version mismatches). The `expo-font` peer warning is gone.
- `npx tsc --noEmit` clean; `npm test` 633/633; `npm run web:smoke` clean.

## Doctor item 2: app.json settings mirrored in `ios/` (checked)

| app.json | Native value | OK |
|---|---|---|
| `ios.bundleIdentifier` com.gritmap.app | `PRODUCT_BUNDLE_IDENTIFIER` com.gritmap.app | yes |
| `ios.supportsTablet` false | `TARGETED_DEVICE_FAMILY = 1` (Debug and Release) | yes |
| `ios.config.usesNonExemptEncryption` false | `ITSAppUsesNonExemptEncryption` false in `Info.plist` | yes |
| `version` 1.0.0 | `CFBundleShortVersionString` 1.0.0 (literal) | yes (`MARKETING_VERSION` 1.0 is unused because Info.plist is literal) |
| `ios.buildNumber` 1 | `CFBundleVersion` 1 (EAS remote versioning overrides at build time) | yes |
| `scheme` gritmap | `CFBundleURLSchemes` gritmap, com.gritmap.app, exp+gritmap | yes |
| `userInterfaceStyle` light | `UIUserInterfaceStyle` Light | yes |
| `orientation` portrait | `UISupportedInterfaceOrientations` Portrait **and** PortraitUpsideDown | differs slightly (upside-down also allowed on iPhone); harmless, say if you want it removed |
| `icon` assets/icon.png | `AppIcon` 1024 (same image, re-encoded, no alpha) | yes |
| local-network string and ATS | `NSLocalNetworkUsageDescription`, `NSAllowsLocalNetworking` in `Info.plist` | yes |
| plugins (maplibre, secure-store, font) | native pods in `Podfile.lock` | yes |

## Item 3: patch-version mismatches (NOT bumped, for after TestFlight)

expo 57.0.12 (wants ~57.0.27), react-native 0.86.2 (0.86.3), @expo/metro-runtime 57.0.10 (~57.0.16), expo-crypto 57.0.1 (~57.0.3), expo-dev-client 57.0.13 (~57.0.19), expo-document-picker 57.0.1 (~57.0.3), expo-file-system 57.0.4 (~57.0.7), expo-sqlite 57.0.1 (~57.0.4). Use `npx expo install --check` after the first TestFlight round, then rebuild and re-test.

## Something to know

- `assets/icon.png` (and the native AppIcon) is still the **Expo template placeholder icon**, not a GritMap icon. TestFlight accepts it; the App Store needs a real one before public release.

## Goal alignment

- `docs/GOALS.md` Priority 1 (TestFlight build for strangers; a stock `expo-font` peer missing could crash icons in a standalone build). No shared contract touched; `.easignore`, `eas.json` and app.json EAS fields untouched.

## Next safe action

Jason rebuilds (`eas build -p ios --profile production`) from this commit; later bump patch versions; replace the placeholder icon before any public App Store release.
