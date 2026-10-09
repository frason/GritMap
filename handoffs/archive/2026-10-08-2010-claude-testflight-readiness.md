# Handoff: phone app is ready for a TestFlight build, short of Jason's Apple credentials (committed locally, not pushed)

- Updated: `2026-10-08 20:10 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `8e66df4 build: TestFlight readiness (eas.json, iPhone-only, export compliance, review sample)` (handoff committed on top)
- Worktree: clean for phone files. `apps/karoo/*` untouched (Codex's uncommitted H10 work).

## Outcome

Nothing needing Jason's Apple ID, an Expo login or any remote resource was run. The repo now has everything for
`eas build -p ios --profile production` + `eas submit`, and `docs/BETA_TESTFLIGHT.md` lists, in order, the steps only Jason can do
(Apple Developer enrollment check, `eas login`/`eas init`, creating the App Store Connect app, first build and submit, internal vs
external groups and Beta App Review, review notes about the optional Karoo dependency, privacy policy URL and the App Privacy answers).

## Changed (`8e66df4`)

- **`eas.json`**: profiles `development`, `development-simulator`, `preview` (internal), `production`; `cli.appVersionSource` is
  **`remote`** and `production.autoIncrement` is true. **Why remote:** `ios/` and `android/` are committed native projects (bare workflow).
  With local versioning every production build would rewrite `ios/GritMap/Info.plist` and the Xcode project and dirty git; remote keeps the
  counter on EAS, and the first value is read from the project (build 1).
- **`app.json` + `ios/`**: `supportsTablet: false` (and `TARGETED_DEVICE_FAMILY = 1`, iPad orientation key removed), `buildNumber "1"`,
  `ITSAppUsesNonExemptEncryption = false` in both `app.json` and the committed `Info.plist` (the committed Info.plist is what a bare build uses,
  so `app.json` alone would not have applied). **iPad decision:** set to iPhone-only; only phone layouts have been designed and checked, GOALS says
  iPhone for the beta, and it avoids iPad screenshot requirements. Re-enable after verifying iPad layouts.
- **`.easignore`**: same rules as `.gitignore` plus `apps/`, `fixtures/`, `docs/`, `handoffs/`, `registry/` etc., so the Karoo project and real ride files
  are not uploaded to Expo's servers.
- **Review sample**: `scripts/make-review-sample-gpx.ts` -> `docs/beta-review-sample-ride.gpx`, a synthetic ride along the public "Diablo Northgate to
  Junction" Open Segments entry (invented timing). Imported on the simulator it matched that segment (1 effort, 99%); removed afterwards.
- `docs/BETA_TESTFLIGHT.md`, `docs/screenshots/testflight/release-build-first-run.png`.

## Verified

- `npx tsc --noEmit` clean; `npm test` 617/617; `npm run web:smoke` clean.
- `npx expo export --platform ios`: production Hermes bundle builds. Searched the bundle strings: no tokens, no `Karoo-Morning`/personal ride names, no
  `jfrasier`; only the example address `192.168.1.23:8734` and the public registry owner `frason`.
- `xcodebuild -configuration Release -sdk iphonesimulator` (unsigned, derived data in scratch): **BUILD SUCCEEDED**. Built app: `UIDeviceFamily = 1`,
  `ITSAppUsesNonExemptEncryption = false`, privacy manifest and library privacy bundles present. Installed on a second simulator (iPhone 17 Pro, fresh
  install): launches into first-run onboarding with no dev gear, no dev menu, no Metro dependency (`main.jsbundle` embedded).
- Reviewed, no change needed: `PrivacyInfo.xcprivacy` (no tracking, no collected data, UserDefaults/file-timestamp/boot-time reasons; expo-file-system and
  React Native ship their own); usage strings (only `NSLocalNetworkUsageDescription`; the app uses no camera/photos/location/contacts; file picker and Keychain
  need none); icon 1024x1024 RGB (no alpha) and splash 1024x1024.
- **Not run (needs Jason):** `eas login`, `eas init`, `eas build`, `eas submit`, App Store Connect setup. `eas-cli` is not installed here.

## External state

- A second simulator (iPhone 17 Pro) had the Release app installed and was shut down. The main QA simulator still has the dev client + demo data; Metro running.
- Nothing pushed. Local unpushed commits: `be21320`, `3b3e590`, `078e131`, `854e224`, `ba8419e`, `d4aa1af`, `8e66df4` (+ this handoff).

## Goal alignment

- `docs/GOALS.md` Priority 1: "EAS/TestFlight setup" for the ~2026-10-15 beta; the last phone-side blocker. No shared contract touched. Karoo: nothing for Codex
  to do; testers also need `docs/BETA_KAROO_INSTALL.md`. "zones"/"sections" wording untouched (hold).

## Hazards and blockers

- **Real ride files are in the PUBLIC repo.** `https://github.com/frason/GritMap` is public and `fixtures/fit/` has 6 of Jason's real Karoo ride FITs
  (e.g. `Karoo-Morning_Ride-2026-09-13-0647.fit`) plus a real GPX, used by tests. That contradicts "never commit personal GPS data" and exposes dates, routes and likely
  home/start location, in git history as well. Not changed here: it needs Jason's decision (replace with synthetic fixtures, then consider history rewrite / repo
  visibility). Recommended before inviting strangers.
- Team ID `FX769T9X3C` is committed in the Xcode project; not a secret, but confirm it is the paid team.
- First EAS build will need Jason to choose "let EAS manage credentials"; `eas init` will edit `app.json` (project ID) which should be committed.
- Beta App Review may question the Karoo dependency; review notes are drafted in `docs/BETA_TESTFLIGHT.md`. A privacy policy URL must exist before external testers.
- `NSBonjourServices _expo._tcp` stays in Info.plist (dev-client tooling); harmless in production.

## Next safe action

Jason works through `docs/BETA_TESTFLIGHT.md` (enrollment check, then `eas login` and `eas init`), and decides what to do about the real FIT fixtures in the public repo.
After the first TestFlight build is live: send the tester email (TestFlight link + Karoo install guide) and do a VoiceOver pass on a real iPhone.
