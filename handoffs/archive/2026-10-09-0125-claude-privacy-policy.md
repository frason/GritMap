# Handoff: privacy policy (docs/PRIVACY.md) and App Store Connect privacy answers (committed locally, not pushed)

- Updated: `2026-10-09 01:25 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `docs: GritMap privacy policy and App Store Connect privacy answers` (handoff committed on top)
- Worktree: clean for these files. `apps/karoo/` was only read.

## Outcome

- `docs/PRIVACY.md`: plain-language, host-agnostic (no repo links), covering local-only storage, no accounts/analytics/ads/tracking, the three kinds of network use, Karoo local-network send, what sharing to Open Segments makes public and permanent
  (maintainer-only in the beta), the coach/AI "Share request", the Karoo extension and H10 data, TestFlight/Apple, deletion, children, changes, contact. **Two TODOs for Jason:** the last-updated date and a contact email/form (no email written in).
- `docs/BETA_TESTFLIGHT.md` step 9 rewritten: publish `docs/PRIVACY.md` at any public URL; **App Privacy answers: Data Not Collected, no tracking, no data-collecting SDKs**, with the reasoning and two decisions for Jason.

## Claim-by-claim evidence

| Policy claim | Backed by |
|---|---|
| Rides (route, times, distance, elevation, power/HR/cadence/speed/temperature) stored on the phone | `src/db/migrations.ts` (`rides`, `ride_points`), `src/db/persistImportedRide.ts`, `src/db/DatabaseProvider.tsx` (expo-sqlite on device) |
| A copy of the imported file is kept in the app | `src/import/retainFitFile.ts` (copies into `Paths.document`) |
| Segments, goals, plans stored locally | `src/db/migrations.ts` (`segments`, `active_goal`, `segment_plans`, `plan_sends`), `src/db/insertSegment.ts`, `src/db/segmentPlans.ts` |
| Profile (FTP, weight, max HR) local; weight kept in kg | `src/db/migrations.ts` (`athlete_profile`), `src/db/setAthleteProfile.ts`, `src/onboarding/riderNumbers.ts` |
| Settings (Karoo address, onboarding done) | `src/karoo/savedKarooAddress.ts`, `src/db/appSettings.ts`, `src/onboarding/onboardingState.ts` |
| GitHub token only for maintainers, in the Keychain | `src/registry/registryCredentials.ts` (`expo-secure-store`), `src/screens/PublishToRegistryScreen.tsx` ("I'm the GritMap maintainer") |
| No location, camera, microphone, photos, contacts, health, notifications on iPhone; only the file picker | `ios/GritMap/Info.plist` (only `NSLocalNetworkUsageDescription`), `package.json` (no expo-location/camera/contacts/notifications/media/health), `src/screens/ImportScreen.tsx` (document picker) |
| Backups may include app data | no `isExcludedFromBackup` anywhere in `src/` or `ios/`; files are in `Paths.document` |
| No analytics, crash reporter, ads, tracking SDK | `package.json` dependencies (no Sentry/Firebase/Amplitude/etc.), no such imports in `src/`; `ios/GritMap/PrivacyInfo.xcprivacy` (`NSPrivacyTracking` false, no collected data types) |
| No update checks | `ios/GritMap/Supporting/Expo.plist` (`EXUpdatesEnabled` false) |
| Open Segments reads GitHub (IP and requested files visible, no identifier sent) | `src/registry/registryClient.ts` (`api.github.com` contents list, `raw.githubusercontent.com` fetch; headers only `Accept`), `src/registry/registryConfig.ts` |
| Maps from OpenFreeMap | `src/screens/RouteMapView.native.tsx:46` (`https://tiles.openfreemap.org/styles/liberty`; the style then references that host's tiles, sprites and fonts) |
| No other services contacted | all `fetch(` calls in `src/`: registryClient, `src/karoo/fetchWithTimeout.ts` (LAN only), `ImportScreen.tsx` (a local file URI fallback). `src/screens/MapScreen.tsx` names `demotiles.maplibre.org` but is imported nowhere (dead code) |
| Send to Karoo is direct over the LAN; what is sent | `src/karoo/sendSegmentToKaroo.ts`, `sendGuidancePackageToKaroo.ts` (segment, plan, riderHistory FTP/weight/maxHR), `karooTransferEndpoint.ts` (plain `http://host:port`), `ios/GritMap/Info.plist` (local-network string, ATS local networking) |
| Karoo receives only while its receive screen is open (~10 min), unencrypted | `apps/karoo/.../importing/HttpSegmentInbox.kt` (one-shot `ServerSocket`, timeout), `src/onboarding/onboardingCopy.ts` (10-minute window), plain HTTP above |
| Sharing publishes name, route+elevation, matching settings, random id, fingerprint; not rides/times/profile; public and not removable in the app | `src/segments/toPortableSegmentJson.ts`, `src/registry/registryClient.ts` `publishRegistrySegment` (PUT to the public repo), no delete function anywhere |
| Coach/AI "Share request" is user-initiated; message contents | `src/screens/ImportCoachPlanScreen.tsx` (`Share.share`), `src/pacing/buildCoachPlanRequest.ts` (segment name, distance, grade table, FTP, goal) |
| Karoo: location + Bluetooth permissions; INTERNET only for the LAN receiver | `apps/karoo/app/src/main/AndroidManifest.xml` (permissions and its own comment) |
| Karoo: no analytics/crash/HTTP-client libraries | `apps/karoo/app/build.gradle.kts` (dependencies: compose, room, coroutines, serialization only); grep found no okhttp/retrofit/HttpURLConnection/firebase/sentry in `app/src/main` |
| Karoo keeps segments/plans/attempts/logs on the device | Room (`DatabaseProvider`), `importing/SegmentInbox.kt` (app external files dir), `service/BoundedDiagnosticLog.kt` |
| H10 heart-rate/RR data stays on the Karoo in private storage; not sent anywhere | `service/LiveSegmentService.kt` (`H10CaptureController(filesDir/physiology)`), `physiology/RrArtifactStore.kt`; no network code in `physiology/` |
| Karoo not included in cloud backup/device transfer | `apps/karoo/app/src/main/AndroidManifest.xml` (`allowBackup=false`) and `res/xml/data_extraction_rules.xml` (excludes everything) |
| TestFlight/Apple handles beta crash/feedback | Apple's TestFlight behaviour (not app code); stated as Apple's policy |

## Gaps and things to know (not fixed)

- **No way to delete the GitHub token in the app** (`clearRegistryToken` exists but no screen calls it). The policy says deleting the app removes data and notes iOS may keep Keychain items; only maintainers are affected.
- The Karoo receiver has **no authentication** (anyone on the same Wi-Fi who knows the address while the receive screen is open could send a package). The policy tells riders to use a trusted network; the pairing contract (post-beta) addresses it.
- "Material changes will also be mentioned in release notes" is a commitment Jason must be willing to keep.
- App Privacy "Data Not Collected" relies on Apple's definition of collect; see the decision in `docs/BETA_TESTFLIGHT.md`. This is not legal advice; a quick human read is advisable before publishing.
- Open Segments sharing for everyone (`docs/OPEN_SEGMENTS_SHARING.md`) will change the answers; revisit the policy and App Privacy first.

## Verified

- Claims checked by grep/reading the code as listed above. Documentation only: no code changed, so typecheck/tests were not rerun for this change (last green: 630 tests, typecheck, `web:smoke` at `c60efc4`).

## Goal alignment

- `docs/GOALS.md` Priority 1 (beta-ready loop for strangers; TestFlight requires a privacy policy URL for external testers), and the "nothing may assume Jason's data" principle. No shared contract touched. Codex: nothing required; the Karoo claims above are read-only checks (tell me if any Karoo behaviour changes, e.g. network use).

## Next safe action

Jason: fill the two TODOs in `docs/PRIVACY.md`, publish it at a public URL (Vercel site or GitHub), paste the URL into App Store Connect, and enter the App Privacy answers from `docs/BETA_TESTFLIGHT.md` step 9.
