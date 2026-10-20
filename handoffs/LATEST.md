# Coordinator: next task for Codex (2026-10-19 21:15)

Read `docs/GOALS.md` first. Status: iPhone build 7 is in external TestFlight review (submitted 2026-10-19). Public Karoo
release is `karoo-beta-0.10.44` (Karoo 3 only). Your v2 BLE reader (`99d1878`, with its handoff `abdbfb9`) passed coordinator QA:
196/196 JVM tests, lint and build, and it matches `docs/BLE_DIRECT_TRANSFER_CONTRACT.md`.

**Task 1: install the BLE test build on Jason's Karoo, then run the physical test with him.**
- The coordinator has already built it from committed `abdbfb9`, with no source changes:
  `./gradlew :app:assembleBeta -PgritmapBetaSigningProperties=<beta-signing.properties> -PgritmapVersionCode=68
  -PgritmapVersionName=0.10.44-ble1 -PgritmapDirectBleV2=true` (JDK 17).
  APK: `~/Downloads/gritmap-karoo-0.10.44-ble1.apk`. SHA-256 `1a166ae026ee42743215eccb18818d9b1fe73d43fc16306645f1bbc038f29b92`,
  signer SHA-256 `eac4c309…f5f6` (the beta key, same as 0.10.44). Rebuilding with the same flags is fine; record the hash if it differs.
- Install **in place**: `adb install -r` (or Companion). Never uninstall or clear data. Confirm `0.10.44-ble1`/68 via dumpsys,
  and confirm the GritMap library and settings survived.
- Do **not** tag or publish this as a release. It is a dev-flagged test build only.
- Physical test with Jason (iPhone has internal TestFlight build 5, `production-ble-internal`):
  1. a plan for a segment already on the Karoo (expect receipt `ok_segment_existing`);
  2. a plan for a segment the Karoo doesn't have (segment over BLE, then `ok`);
  3. one transfer during a live H10 connection: check RR continuity.
  For each, record the negotiated MTU, the duration, the receipt shown on the phone, and any reconnects. Note anything that doesn't
  match the contract. The phone session's hardware check is `handoffs/archive/2026-10-12-1910-claude-ble-hardware-check.md`.

**Version code rule:** this test build uses code 68, so **the next public Karoo release must use versionCode 69 or higher**, or it
won't install over the test build on Jason's Karoo.

**Still open from before:** confirm the rider-facing Karoo strings say "section(s)" for pacing-plan stretches.

Done when: the test build is installed and verified on the device, the three physical results are written up in a handoff with the
Goal alignment section, and any bug is listed first with a repro.

# Handoff: Karoo direct-BLE v2 reader implemented and dev-gated

Commit `3d503c3` adds the Karoo central for the reviewed direct-Bluetooth v2 contract: strict
manifest/caps, MTU 517, exact Request/Data chunks, SHA-256-before-parse, installed-segment skip,
optional public fetch, three reconnect/resume attempts, optional rider history, unchanged atomic
`gritmap-transfer` import, and receipt retry semantics. It is enabled in debug builds and hidden in
release/beta unless `-PgritmapDirectBleV2=true`; Legacy Wi-Fi and public `0.10.44` are unchanged.
Full Karoo QA passes (196/196 JVM tests, lint, debug/native build), and a debug-signed dev APK is
ready. Physical iPhone/Karoo transfer and H10 coexistence are still required; no APK was installed or
released. Details: `handoffs/archive/2026-10-12-1935-codex-karoo-direct-ble-v2.md`.

# Handoff: Karoo 0.10.44 published and independently verified

`main` was rebased cleanly onto current GitHub history and pushed. The first `0.10.44` tag run
correctly failed because Gradle still defaulted to `0.10.43`/66; commit `ca6ea4f` fixes the defaults
to `0.10.44`/67. The failed unpublished tag was replaced with an annotated tag pointing to
`ca6ea4f`. Corrected workflow `38308093435` passed tests, lint, signed/minified build, asset
verification, upload, and release publication. The public APK is
`https://github.com/frason/GritMap/releases/latest/download/gritmap-karoo.apk`, SHA-256
`6b07e5151581c4d1996ef579f12812a6c32ee0409369c8b1f5c899283e5e1af5`. Details:
`handoffs/archive/2026-10-12-1409-codex-karoo-01044-published.md`.

# Handoff: installed Karoo 0.10.44 source committed and tagged

Commit `20f9ed7` captures the Karoo source installed as `0.10.44-beta`/67 after rebasing onto current
`origin/main`: the approved large-field
typography, stable Pacing Profile title, launcher icon, and bounded v1 BLE capsule receiver. Annotated
tag `karoo-beta-0.10.44` points directly to that commit. Lint and a versioned debug APK build pass.
The JVM suite is 188/189 on this Mac because the pre-existing
`NeedleAgentManagerTest.timeoutReturnsFallbackWithoutConcurrentInference` wall-clock assertion
requires `<70 ms` and fails even in isolation; functional fallback still succeeds. No direct-BLE v2
Karoo work was started. Details:
`handoffs/archive/2026-10-12-1259-codex-karoo-01044-committed-tagged.md`.

# Decision: direct BLE approved in principle; freeze Karoo protocol work until contract review

Jason approved the recommendation on 2026-10-12 to use Claude's direct-Bluetooth v2 design instead
of building the hosted capsule service now. The private plan always travels over BLE. The public
segment is skipped when its fingerprint is already installed, otherwise fetched from Open Segments
when available or transferred over BLE as the offline fallback. The existing bounded, user-triggered
two-minute receive window, strict `gritmap-transfer` validation, atomic import, receipt, and Legacy
Wi-Fi fallback remain required.

Do **not** rewrite the Karoo receiver from the v1 capsule protocol until
`docs/BLE_DIRECT_TRANSFER_CONTRACT.md` has been reviewed against the actual phone implementation and
both sides agree on the wire behavior. Preserve the v1 capsule code but do not ship it enabled. The
review must explicitly settle ATT/MTU chunk behavior, connected-session timeout versus scan timeout,
retry/resume rules, receipt/rejection behavior, optional rider data, link-encryption choice, size
limits, exact-byte hashing, iOS foreground behavior, and H10 coexistence. Large BLE segment transfer
is a fallback; installed-fingerprint and public-URL paths are preferred. Details:
`handoffs/archive/2026-10-12-1222-codex-direct-ble-decision.md`.

# Handoff: large-field visual pass installed as Karoo 0.10.44-beta

The approved large-field density/type pass, stable `GM PACING PROFILE` title, launcher icon, and
bounded Bluetooth receiver are installed in place on the connected Karoo as `0.10.44-beta`/67.
The signed/minified beta build passed, `adb install -r` succeeded, the original install timestamp
was preserved, MainActivity displayed in 839 ms, Hammerhead reconnected the extension, and recent
logcat contained no GritMap fatal exception. The public release remains 0.10.43 and all current
milestones are still uncommitted. Details:
`handoffs/archive/2026-10-10-2130-codex-karoo-01044-installed.md`.

# Handoff: Karoo large visual fields share the Pacing Profile hierarchy

Using Jason's five supplied device screenshots, Cardiac Drift, Power Balance, Segment Performance,
and Pacing Coach now match Pacing Profile's header scale and information hierarchy. Pacing Profile
itself changed only its top-left title to `GM PACING PROFILE`. Exact typography changes are audited
in `docs/KAROO_LARGE_FIELD_TYPOGRAPHY_AUDIT.md`. Regenerated 480 px previews were inspected with no
clipping; full Karoo QA passes (189/189 JVM tests, lint, debug build). Nothing was installed or
committed, and the public beta is unchanged. Details:
`handoffs/archive/2026-10-09-1654-codex-large-field-density.md`.

# Handoff: Karoo BLE transfer is user-triggered and bounded

The Karoo-side no-IP transfer path now uses an explicit Inbox action rather than an always-on
extension scan: **Receive from Phone** opens a filtered, low-latency BLE receiver for at most two
minutes, stops scanning before GATT, and releases Karoo Bluetooth on every exit path. The existing
address-based receiver remains as **Legacy Wi-Fi Receive**. Full Karoo QA passes (189/189 JVM tests,
lint, debug build). This supersedes the continuous-scan architecture in the preceding BLE handoff.
It remains uncommitted and cannot work end to end until the phone advertiser and HTTPS capsule
service are implemented. Details:
`handoffs/archive/2026-10-09-1642-codex-bounded-ble-receive.md`.

# Handoff: Karoo BLE transfer-capsule receiver is implemented

The no-IP Karoo receiver is implemented and verified in isolation: a low-power filtered BLE scan
reads a 36-byte, 128-bit capability token; Karoo then fetches a strict short-lived HTTPS capsule,
downloads the public segment and private plan separately, verifies both SHA-256 hashes, and imports
them through the existing atomic `gritmap-transfer` path. The exact UUIDs, schemas, size limits and
phone/server obligations are in `docs/BLE_TRANSFER_CAPSULE_CONTRACT.md`. Full Karoo QA passes
(189/189 JVM tests, lint, debug build). It is not installed or end-to-end usable yet because the
iPhone advertiser and capsule service do not exist, and physical H10 coexistence remains mandatory
before release. Details: `handoffs/archive/2026-10-09-1630-codex-ble-transfer-capsule-karoo.md`.

# Handoff: approved GritMap icon installed on the Karoo

The Karoo launcher now uses Jason's approved dark bike-and-arrow GritMap icon while notifications
and data-field selectors retain the purpose-built monochrome extension glyph. Debug build and lint
pass; a signed/minified beta build also passes and was installed in place on the connected Karoo
without clearing app data. The work is uncommitted and is not yet in the public 0.10.43 asset.
Next: visually confirm it in the Karoo app grid, then commit and publish it in the next beta tag.
Details: `handoffs/archive/2026-10-09-1435-codex-karoo-app-icon.md`.

# Handoff: first public Karoo beta release published and independently verified

The first public Karoo beta release is live: `https://github.com/frason/GritMap/releases/tag/karoo-beta-0.10.43`. The initial run failed because the Android setup action requested Google's removed `tools` package; commit `8959916` fixes it and corrected run `37979085132` passed setup, tests, lint, signed/minified build, signature/version verification, artifact upload, and release publication. The public APK was downloaded again and independently verified: `com.gritmap.karoo`, code 66, `0.10.43-beta`, GritMap Beta certificate SHA-256 `eac4c309da0e0410b2926c6a478b17038cdf7407fe3d4d86341eebf53a90f5f6`, asset SHA-256 `1f0d298f218d445b03596bb429a02f15e86c266058303b208ecda2f684ba9254`. Stable link: `https://github.com/frason/GritMap/releases/latest/download/gritmap-karoo.apk`. Next: physically install that public asset through Hammerhead Companion and verify data retention/previews. Details: `handoffs/archive/2026-10-09-1224-codex-public-karoo-release.md`.

# Handoff: public Karoo beta distribution and tester README prepared

Commit `2dad59a` adds the root public-beta README, Hammerhead Companion/ADB instructions, a safe iPhone TestFlight request path, five replaceable Karoo field screenshot placeholders, and a tag-driven signed APK release workflow. The workflow runs Karoo tests/lint, builds and verifies the signed APK, publishes `gritmap-karoo.apk` plus `SHA256SUMS.txt`, and marks the beta as GitHub's latest release so the stable `/releases/latest/download/gritmap-karoo.apk` link works. Nothing was pushed or released and no secrets were configured. Next: configure the four Actions signing secrets, push, tag `karoo-beta-0.10.43`, inspect the run, then test the public asset through Hammerhead Companion. Details: `handoffs/archive/2026-10-09-1133-codex-public-beta-distribution.md`.

# Handoff: adaptive cardiac guidance and signed 0.10.43 beta candidate

Karoo commit `d38057f` makes `GM Cardiac Drift` progressively useful for short, medium, and long efforts; adds qualified H10 alpha-1 context to long efforts; tightens RR qualification to approximately two clean minutes at 95% validity; and changes rider-facing pacing-plan wording from zones to **sections** without changing shared contracts. A signed `0.10.43-beta`/code 66 candidate passed 183/183 JVM tests, lint, minified beta build, signature/version verification, and is staged at `/Users/frason/Documents/CS Agent Team for ChatGPT/GritMap Beta Builds/gritmap-karoo-0.10.43-beta.apk` (SHA-256 `bfd21b83b5bbabdb95128329499b9f9ac6be9abea258af47969ab5f70f0005a2`). It is not installed; the physical Karoo remains on `0.10.42-beta`. Next: install in place, inspect previews, then perform the checklist in `docs/H10_RIDE_VALIDATION_CHECKLIST.md`. Details: `handoffs/archive/2026-10-08-2252-codex-adaptive-cardiac-01043.md`.

# Coordinator: current phone task (2026-10-09 00:50, sent to the GritMap MVP session)

For Codex's awareness. Do not edit these phone files.

Done and QA-passed since the last update: the map first-open guard (`9283e38`), real ride fixtures
untracked and their tests skipping when absent (`5bf44a4`), "sections" wording (`c60efc4`), and the
handoff (`1fb003d`). A fresh clone gives 606 pass, 24 skipped, 0 fail. **Codex:** the exact
rider-facing "section" strings to match on the Karoo are in
`handoffs/archive/2026-10-09-0050-claude-map-first-open-fixtures-sections.md`. Wire/JSON keys stay `zones`.

**Task:** write `docs/PRIVACY.md`, the privacy policy for the TestFlight Privacy Policy URL (an external
testing gate), with every claim checked against the code, plus the App Store Connect "App Privacy" answers.

# Handoff: BLE direct transfer verified on a real iPhone (phone side); Karoo side still open (committed locally, not pushed)

On Jason's iPhone 15 Pro Max (TestFlight build 5, `production-ble-internal`) a macOS central read the manifest, walked the plan (1360 B), segment (4792 B) and rider (114 B) chunks with every SHA-256 verified, wrote an `imported` receipt, and the phone showed "Imported on your Karoo". Also passed by hand with LightBlue: foreground-only advertising (gone ~10 s after backgrounding), no local name, GATT layout, manifest (475 B, v2), a wrong-id receipt refused, and advertising continuing after a manifest read. **Not run on hardware:** second central refused (needs a different device), reconnect-and-resume, MTU and chunk timings. No contract mismatch found; no code changed. The 30 s idle limit is painful for manual GUI testing (fine for a Karoo). Next: Codex implements the Karoo central. Details: `handoffs/archive/2026-10-12-1910-claude-ble-hardware-check.md`.

# Handoff: BLE review fixes P1 to P4 done on the phone (committed locally, not pushed)

`0c02937` fixes the four phone issues from `docs/BLE_DIRECT_TRANSFER_REVIEW.md` with no wire change: a chunk counts as served only when its last byte was delivered (small-MTU safe, so "Sent; check your Karoo" can't appear early); advertising continues for the whole session with owner lock so the Karoo can reconnect and resume; the receipt gets a 60 s window once the plan is served; reads past the end answer `invalidOffset`, and `startTransfer` checks the manifest's byte counts and SHA-256 against the bytes. 66 Swift session checks pass, Release simulator build succeeds, typecheck/web:smoke clean, 649 tests (the batchImport timing test flaked under machine load, passes alone). **Still not run on a physical iPhone**; that needs Jason's go-ahead. PRIVACY.md Bluetooth sentence is for when the dev flag is lifted. Details: `handoffs/archive/2026-10-12-1300-claude-ble-review-fixes-p1-p4.md`.

# Handoff: direct Bluetooth send, phone side (dev-flagged), and v2 contract draft (committed locally, not pushed)

The iPhone can now hand a plan, and the segment only when the Karoo lacks it, straight to the Karoo over Bluetooth with no server (`89938ea`, contract draft `2d64df9`: `docs/BLE_DIRECT_TRANSFER_CONTRACT.md`). Local Expo module `modules/gritmap-ble-peripheral` (CoreBluetooth) serves a manifest, chunked plan/segment reads and a receipt; "Imported on your Karoo" appears only after an `imported` receipt. Hidden unless a dev build, `EXPO_PUBLIC_GRITMAP_BLE_TRANSFER=1` or `dev_ble_transfer`=1; the Wi-Fi/IP send is unchanged. typecheck, 649/649 tests, web:smoke clean; Swift session tests pass; Release simulator build succeeds (simulators have no Bluetooth radio). **Not yet run on a physical iPhone** (no nRF Connect check recorded) and no Karoo implements v2. Codex's to-do/confirm list and Jason's steps: `handoffs/archive/2026-10-12-1210-claude-direct-ble-phone-side.md`.

# Handoff: expo-font declared; icons verified in a Release build (committed locally, not pushed)

`expo-font ~57.0.4` is now a declared dependency (peer of `@expo/vector-icons`) with `ios/Podfile.lock` updated; `expo install` also added `expo-font` to app.json's `plugins` (no EAS fields). Unsigned Release simulator build on a fresh install shows the tab-bar and list icons; `expo-doctor` is down to the two expected warnings (non-CNG sync, patch-version mismatches, not bumped). typecheck, 633/633 tests, web:smoke clean. The app icon is still the Expo placeholder. Details: `handoffs/archive/2026-10-09-0830-claude-expo-font.md`.

# Handoff: "Remove saved token" and the unused demo map deleted (committed locally, not pushed)

Share to Open Segments' maintainer section now has a confirmable **Remove saved token** (clears the Keychain item, returns to the no-token state; unit-tested); the unused `MapScreen.tsx` (the only user of `demotiles.maplibre.org`) is deleted, so the app contacts only GitHub, OpenFreeMap and the local Karoo. `docs/PRIVACY.md` updated in the same commit. typecheck, 633/633 tests, web:smoke clean; screenshots in `docs/screenshots/token-removal/`. Details: `handoffs/archive/2026-10-09-0210-claude-token-removal-dead-map.md`.

# Handoff: privacy policy (docs/PRIVACY.md) and App Privacy answers (committed locally, not pushed)

Docs only. `docs/PRIVACY.md` is a plain-language, host-agnostic policy checked claim by claim against the phone code and (read-only) the Karoo extension; `docs/BETA_TESTFLIGHT.md` step 9 has the App Store Connect answers (**Data Not Collected, no tracking**). Jason must fill two TODOs
(last-updated date, contact email) and publish it at a public URL. Gaps noted: no in-app way to delete the maintainer GitHub token; the Karoo receiver is unauthenticated (use a trusted network). Evidence table in `handoffs/archive/2026-10-09-0125-claude-privacy-policy.md`.

# Handoff: map first-open guard, real ride fixtures untracked, "sections" wording (committed locally, not pushed)

Phone-only. (1) Blank map on first open: **not reproduced at normal load** (0 of about 46 cold opens before; seen only with the Mac at load 50-90); defensive fix in the shared `RouteMapView` (create the native map after the first non-zero layout, refit when the style loads, rebuild a stalled map); after: 15/15 fresh-install first opens fine; screenshots in `docs/screenshots/map-first-open/`.
(2) The 6 real FITs and the GPX are untracked and git-ignored (still on disk); their 6 tests skip when absent (630/630 present; 606 + 24 skipped absent); history not rewritten. (3) "Sections" for plan stretches, "zones" only for training zones; exact strings for Codex in the archive entry; JSON key `zones` unchanged. Note: `9283e38`'s message omits the fixture removal (they were staged). Needs Jason's OK to push. Details: `handoffs/archive/2026-10-09-0050-claude-map-first-open-fixtures-sections.md`.

# Handoff: Attempt Review and Attempt Comparison on the design system; cross-tab Back-button fix (committed locally, not pushed)

Phone-only; Karoo and fixtures untouched. Compare Efforts names both efforts with a picker to swap either, says who was ahead and explains the time-gap chart ("Ahead or behind"); Review Effort renames the match diagnostics (Route followed,
Furthest off the route, Backtracking, GPS dropouts), explains why GritMap isn't sure, and Confirm/Remove state their consequences (remove confirms in-screen). Charts have spoken summaries; all text is `AppText`.
**Bug fixed (`c6808dd`):** opening a segment/effort/comparison from Home, Import, Ride detail or after saving a segment left it with no Back button; navigation now keeps the tab's list underneath. typecheck, 628/628 tests, web:smoke clean;
before/after screenshots in `docs/screenshots/attempts/`. "zones" wording untouched. Needs Jason's OK to push 12 local commits. Details: `handoffs/archive/2026-10-08-2155-claude-attempt-screens-and-back-button.md`.

# Handoff: Open Segments browse and share on the design system; token-free sharing proposal (committed locally, not pushed)

Phone-only; Karoo untouched. Open Segments cards now show distance and climbing, with offline/busy/empty/error states, pull to refresh and "already added". Share to Open Segments tells strangers
sharing isn't open yet (beta: maintainer only), warns that shared segments are public and show where you ride, and hides the GitHub-token path behind "I'm the GritMap maintainer". New
`docs/OPEN_SEGMENTS_SHARING.md` compares token-free options and **recommends a Cloudflare Worker that opens a reviewed pull request (after the beta)**; nothing built. typecheck, 620/620 tests, web:smoke clean;
before/after screenshots in `docs/screenshots/open-segments/`. Needs Jason: the four decisions at the end of the proposal, and OK to push 9 local commits. Details:
`handoffs/archive/2026-10-08-2105-claude-open-segments-design-sharing-proposal.md`.

# Handoff: phone app is ready for a TestFlight build, short of Jason's Apple credentials (committed locally, not pushed)

Phone-only; Karoo untouched. Added `eas.json` (development / preview / production; remote autoincrementing build numbers because `ios/` is a committed native
project), `.easignore`, export-compliance flag, buildNumber, **iPhone-only for the beta** (iPad layouts unchecked), a synthetic review sample ride, and
`docs/BETA_TESTFLIGHT.md` with the exact steps only Jason can do (enrollment, `eas login`/`init`, App Store Connect app, first build/submit, external group, Beta App
Review notes about the Karoo, privacy policy URL). Verified: typecheck, 617/617 tests, web:smoke, `expo export --platform ios`, and an unsigned Release simulator build
that launches into first-run onboarding with no dev UI. Nothing needing Jason's credentials was run. **Needs Jason's attention:** the PUBLIC repo contains 6 real ride FITs
in `fixtures/fit/` (personal GPS); and OK to push 7 local commits. Details: `handoffs/archive/2026-10-08-2010-claude-testflight-readiness.md`.

# Handoff: Define Segment redesigned; progress-over-time load 7.5 s to ~0.05 s; text size reflows live (committed locally, not pushed)

Phone-only; Karoo untouched. Define Segment and its handles are on the design system (plain steps, 44 pt handles with VoiceOver
labels/values, inline errors, loading/no-GPS/error states). Progress over time: computing the bands took **7,486 ms** on the simulator
before and **45-83 ms** after (the interpolation rebuilt its observation list on every step; now cached per array; Compare Attempts
benefits too). Changing text size while the app is open now reflows design-system text without a relaunch (`useFontScale` keyed
`AppText`); screens still using raw `Text` don't yet. typecheck, 617/617 tests, web:smoke clean. Before/after screenshots:
`docs/screenshots/define-segment/`. "zones"/"sections" wording untouched per the hold. Still needs: Jason's OK to push 5 local commits; a person's
VoiceOver pass. Details: `handoffs/archive/2026-10-08-1930-claude-define-segment-perf-textsize.md`.

# Handoff: beta-loop screens moved onto the design system; Home safe-area fix (committed locally, not pushed)

Phone-only; Karoo untouched. Segment Detail (goal and pacing plan, elevation chart), coach-plan import, Send to Karoo,
Import (ride and segment files, with progress and result states), Plan vs actual, Progress over time (was Historical
Range) and Ride detail now use only `src/theme` tokens/components, with loading/empty/error states, 44 pt targets, Dynamic
Type and VoiceOver labels. Home no longer draws under the status bar and its Change button is reachable (`3b3e590`, its own
commit). Before/after simulator screenshots on demo data: `docs/screenshots/redesign/`. typecheck, 616/616 tests and
web:smoke clean. Copy and behavior changes (alerts to on-screen results, duplicate prompt, "zones" to "sections", Send to
Karoo button says "Send route to Karoo") are listed in the archive. **Not yet done:** a person's VoiceOver pass; Attempt
Review/Comparison, Define Segment, Publish, Open Segments still use the old style. Needs Jason's OK to push
`be21320`, `3b3e590`, `078e131`. Details: `handoffs/archive/2026-10-08-1550-claude-beta-loop-design-migration.md`.

# Handoff: signed Karoo beta 0.10.42 is tagged, installed and documented

Karoo `0.10.42-beta`/code65 is built from the exact annotated tag `karoo-beta-0.10.42`, signed with
a persistent private beta key, checksum-recorded, and installed on the physical Karoo. A clean
0.10.41-beta install followed by an in-place 0.10.42-beta upgrade passed. The beta audit also found
and fixed two release-facing defects: GM H10 Cardiac was absent from the extension manifest, and
the large Pacing Profile was blank without a segment. All 176 JVM tests, lint, debug build, signed
R8 build and signature verification pass. `docs/BETA_KAROO_INSTALL.md` now matches the phone's exact
GritMap / Receive from Phone / Send plan to Karoo wording. The one-time debug-to-beta signature
transition left the Karoo library empty; resend a segment and plan before its smoke ride. Details:
`handoffs/archive/2026-10-08-1516-codex-karoo-beta-0.10.42.md`.

# Handoff: first-run onboarding, design foundations and empty states on the phone (committed locally, not pushed)

Phone-only; Karoo untouched. A fresh install now walks a four-step onboarding (what it does, FTP and weight in kg or lb,
how to get a segment, how to connect the Karoo) and lands on an empty Segments screen; walked on a wiped simulator install
with screenshots in `docs/screenshots/onboarding/`. New design system in `src/theme/` (type scale, light and dark palettes
with a contrast test, Button/Card/ListRow/TextField/EmptyState/ErrorState/LoadingState). Found and fixed on the way: Open
Segments listed raw fingerprints; FTP and weight could not be edited after being set (new Profile button). 608/608 tests,
typecheck and web:smoke clean. **For Codex:** the in-app Karoo steps use exact strings **GritMap**, **Receive from Phone**,
**Send plan to Karoo**, an address like `192.168.1.23:8734`, and a 10-minute window; keep `docs/BETA_KAROO_INSTALL.md`
consistent (they live in `src/onboarding/onboardingCopy.ts`). VoiceOver not yet exercised. Details:
`handoffs/archive/2026-10-08-1425-claude-onboarding-design-foundations.md`.

# Handoff: Polar H10 cardiac-stability field installed on Karoo

Karoo 0.10.42/code65 adds a separate `GM H10 Cardiac` field backed by real Polar H10 RR intervals.
It computes experimental DFA alpha-1 only after an approximately two-minute clean window, never
bridges a known dropout, and shows RMSSD plus RR validity as supporting context in responsive large
and compact views. The ordinary `GM Cardiac Drift` field remains the universal fallback. All 175
JVM tests, lint and APK build pass; 0.10.42 is installed on the connected Karoo. A physical H10
exercise validation remains. Commit `0a6ac9f` consolidates all accumulated work through this
milestone; the follow-up handoff-only commit leaves the worktree clean. Details:
`handoffs/archive/2026-10-08-1035-codex-h10-cardiac-field.md`.

# Handoff: Coco Jumbo physical live retest passed end to end

The 2026-10-08 physical retest verifies the 0.10.41 activation fix. The Karoo log shows
`candidate_discovered` -> `candidate_selected` at 18 m -> attempt start/entry alert -> completed
attempt/completion alert. Room persisted 95.71% live coverage through 510.68 m against the correct
six-zone AI-coach plan (280 W FTP, 4:18 goal, 300-370 W). The attached FIT independently matches at
100% coverage with no gaps or backward movement. H10 capture also saved 199/199 valid schema-2 RR
samples with zero gaps; RR-derived HR was 59.75 bpm versus 59.72 bpm in the matching FIT window.
The FIT identifies Polar device 47674 over ANT+ as the HR source. This drive
had HR/speed but no power/cadence, so adaptive power behavior remains untested. Details:
`handoffs/archive/2026-10-08-0813-codex-coco-live-retest-pass.md`.

# Handoff: real Coco Jumbo live-activation bug fixed; 0.10.41 is installed

The 20:04 drive's FIT is a clean Coco Jumbo accept (100% coverage, 6.85 m max deviation,
no gaps), and Karoo diagnostics exposed the actual live bug: the coordinator reset each candidate
after its first direction-gate sample, so a gate requiring two consecutive forward samples could
never confirm. Viable candidates are now retained while confirmation is pending. Matcher/service
tests, lint and APK build pass; 0.10.41/code64 is installed and post-install diagnostics confirm
the new bound-service startup path. The phone transfer also has a new 15-second timeout. A moving
retest remains. Details:
`handoffs/archive/2026-10-06-2043-codex-live-candidate-activation.md`.

# Handoff: Coco Jumbo now has real elevation and non-zero section grades

The original GPX carried no elevation, so its 55-point portable segment was legitimately imported
with missing elevations and plan generation displayed 0% grade. Coco Jumbo is now enriched from the
real Karoo FIT's barometric traversal: 110.8-188.2 m, 77.4 m/254 ft gain over 533.553 m (14.5%
average), with six non-zero adaptive section grades. Elevation changes the immutable fingerprint to
`cfc9be45fea61eebdd9dbcacd6e5798fd6386afecacb575012657c045e995efc`; delete the old Coco Jumbo on
phone/Karoo before importing and sending this replacement, then regenerate its plan. Typecheck and
497/497 tests pass. Details:
`handoffs/archive/2026-10-06-1653-codex-coco-jumbo-elevation.md`.

# Handoff: Import Segment JSON is built on the phone (the Coco Jumbo task) -- uncommitted, phone only

The task at the top of this file is done: Rides -> Import now has **Import Segment JSON**, which validates a portable
segment file, adds it to Segments, matches existing rides and opens Segment Detail. One change to the plan: the Karoo's own
segment files have no `fingerprint`, which the existing parser rejects, so `fromPortableSegmentJson` gained an opt-in
`allowMissingFingerprint` (computes it locally; a fingerprint that IS present must still match; the registry path still
requires one). The phone's fingerprint for `Coco_Jumbo.segment.json` equals the one in the Karoo's database
(`ed56296f099c...`), so a plan sent from the phone attaches to the installed segment, no duplicate. 493/493 tests; not
live-checked; Karoo build untouched. Details: `handoffs/archive/2026-10-06-claude-segment-json-import.md`.

# Handoff: iPhone segment-JSON provider read fallback added

Coco Jumbo's file is valid and contains `id: "coco-jumbo"`; the reported null-ID/read failure
happened before JSON parsing in the iOS document-provider bridge. The phone picker now explicitly
copies selected JSON to local cache and tries three ordered readers: modern Expo `File`, legacy
Expo string read, then URI fetch. A pure fallback test covers the null-ID failure. Typecheck and all
496 root tests pass. This is JavaScript-only but the phone must reload the newest bundle before
retrying the same `Coco_Jumbo.segment.json`. Details:
`handoffs/archive/2026-10-06-iphone-segment-json-read-fallback.md`.

# Next phone task: import portable segment JSON, starting with Coco Jumbo

The rider has Coco Jumbo on the Karoo but not in the phone library. Its authoritative portable file
already exists at `apps/karoo/samples/Coco_Jumbo.segment.json`. The phone's current Import screen
only processes FIT/GPX, so AirDropping that JSON to the iPhone cannot add it yet. Add a clearly
labelled **Import Segment JSON** action to the phone, read a selected JSON document, and pass the
parsed object through the existing `fromPortableSegmentJson` + `importRegistrySegment` validation,
fingerprint verification and duplicate handling. On success, navigate to Segment Detail so the
rider can create/import guidance and send the combined segment/plan back to Karoo. Do not add a
special Coco Jumbo database seed or bypass fingerprint validation. Add tests for valid import,
invalid/tampered JSON, and already-imported fingerprint. This is a phone-only task and should not
touch the Karoo build or its currently installed 0.10.40 baseline.

# Handoff: the phone now records the plan each Karoo send carried (uncommitted; no Karoo impact)

Plan vs actual used to compare an effort with the segment's *current* plan (the "historical-plan caveat" in the
next-ride checklist). Each successful send to the Karoo is now stored (`plan_sends`, migration v13: the exact
baseline plan JSON incl. the target time the Karoo got), and Plan vs actual uses the latest plan sent at or
before the effort, labelled "the plan sent to your Karoo on <date>", plus a line comparing the real time with the
Karoo's target. **Sends made before this build are not recorded** -- the rider should resend Realize's and Diablo's
plans from this build before the ride, otherwise the comparison falls back to the current plan with the old caveat.
482/482 tests; not live-checked. Details: `handoffs/archive/2026-10-06-claude-plan-sends-recorded.md`.

# Handoff: Android 12 background-service startup hardened offline

The offline 0.10.41/code64 candidate no longer calls `startService()` from the Karoo extension's
background `onCreate`. The extension now holds a `BIND_AUTO_CREATE` connection to
`LiveSegmentService`, and the service begins Karoo ride-state observation from `onBind`; therefore
tracking does not rely on the map layer or a visible GritMap field rescuing a rejected background
start. A Robolectric binding regression test, 19 focused service tests, compile, lint and APK build
pass. The APK was deliberately not installed: physical Karoo remains on the clean 0.10.40/code63
planned-segment-test baseline. Details:
`handoffs/archive/2026-10-06-android-background-service-binding.md`.

# Handoff: predicted finish time for imported plans (phone app, uncommitted)

Rider asked for a predicted completion time to appear with the goal when a plan is imported. The phone now
predicts it (physics power model from weight + route elevation, calibrated to the rider's last three efforts on
the segment) and shows it in the import preview and on the segment screen next to the goal comparison. A coach
plan with no target time of its own is now sent to the Karoo **with the predicted finish as
`targetFinishTimeSeconds`** (existing wire field), so the Karoo's segment "Goal" no longer reads "Fastest
sustainable" and its pacer has a time to use. No Karoo change needed. 471/471 tests; on the real 2026-09-13 Diablo
effort the uncalibrated model is ~7% optimistic and the 39:00 plan calibrates to ~41:52. Not live-checked. Details:
`handoffs/archive/2026-10-06-claude-predicted-finish-time.md`.

# Handoff: physical 0.10.40 approach/H10 lifecycle passed on a short ride

The connected Karoo's 2026-10-06 short ride exercised the automatic Coco Jumbo approach without
entering a planned segment. The preferred H10 connected and began capture 3.2 seconds after the
approach request, with no retry or fallback. Ride end saved a structurally exact schema-1 artifact:
236/236 valid samples, zero gaps/trailing bytes, 238.3 seconds and 59.2 bpm mean RR-derived HR.
The exported FIT independently recorded Polar ANT+ HR and averaged 59.6 bpm over the same window,
only 0.4 bpm higher, confirming the intended simultaneous ANT+ HR plus Bluetooth RR design.
No crash occurred. A denied extension background start recovered through the map-layer start 0.8
seconds later. Planned-segment behavior remains untested. Details:
`handoffs/archive/2026-10-06-0852-codex-short-ride-h10-result.md`.

# Handoff: RR persistence isolation, identity, schema 2 and post-ride analysis are complete offline

The offline `0.10.41`/code64 source now keeps all artifact disk work off the Bluetooth callback,
uses a bounded ordered writer with explicit failure behavior, attaches capture/segment/attempt
identity plus a SHA-256 metadata sidecar, and preserves native H10 1/1024-second RR values in a
backward-compatible schema 2. A new FIT/log/RR analysis CLI reports the next ride's approach,
fallback, capture, gap and HR-comparison evidence. Root tests/typecheck and 56 focused Android
tests plus lint/build pass. Nothing new was installed: the Karoo remains intentionally on
0.10.40/code63 for the clean moving approach test. Details:
`handoffs/archive/2026-10-06-0752-codex-rr-pipeline-completion.md`.

# Handoff: next-ride checklist is synchronized and ready

`docs/NEXT_RIDE_TEST_CHECKLIST.md` now matches the installed Karoo 0.10.40/code63, marks the preferred
H10 setup complete, preserves the offline 0.10.41 boundary, documents the exact approach/retry log
sequence, and adds Claude's phone Plan vs Actual review plus its historical-plan caveat. Do not open
H10 Diagnostics or reinstall before the ride. Details:
`handoffs/archive/2026-10-05-2214-codex-next-ride-checklist-current.md`.

# Handoff: plan vs actual per zone (phone app, uncommitted; no Karoo impact)

Claude added a "Plan vs actual" screen on the phone: after an effort is imported, its power is averaged per
plan zone (time-weighted, pauses excluded, odometer stretched to the segment length) and shown against the
plan's targets with a chart, a table, time gained/lost vs the best other attempt, and a short read
("went out hard", "faded as the effort went on", biggest miss). Entry: segment screen -> Your Efforts, and the
attempt review screen. JS only; 445/445 tests; run on the real 2026-09-13 Diablo effort (262 W vs a 284 W plan,
fading -5/-8/-13% by thirds). Not live-checked on a device. Compares against the plan as it stands now, not
necessarily the one sent to the Karoo. Details: `handoffs/archive/2026-10-05-claude-plan-vs-actual.md`.

# Handoff: RR dropout clock recovery built offline; device left on 0.10.40

The offline `0.10.41` candidate immediately re-anchors RR time after a clear packet dropout, writes
an explicit invalid gap observation, prevents RMSSD from bridging the discontinuity, resets metric
eligibility, and logs `h10_rr_gap`. Forty-nine focused tests, lint and build pass. It was intentionally
not installed: the Karoo still reports 0.10.40/code63 for tomorrow's clean approach test. Details:
`handoffs/archive/2026-10-05-2147-codex-rr-dropout-gap.md`.

# Handoff: 0.10.40 H10 recovery and tomorrow's checklist are ready

Codex reviewed Claude's follow-up, fixed the ride-time stranger-strap hazard, and updated
`docs/NEXT_RIDE_TEST_CHECKLIST.md`. Automatic approach now reconnects only a manually confirmed H10;
without one it logs setup-required and uses Karoo HR. GATT errors/disconnects get bounded 2s/5s/10s
retries. The safety-corrected 0.10.40/code63 APK passed 45 focused tests plus lint/build and is
installed on the Karoo. Moving verification remains tomorrow. Details:
`handoffs/archive/2026-10-05-2126-codex-h10-approach-recovery.md`.

# Handoff: next-ride checklist for the rider + follow-up review of the H10 work (FOR CODEX)

**Codex: please read `docs/NEXT_RIDE_TEST_CHECKLIST.md`** (the rider's checklist for the next ride on `0.10.39`),
correct its log-event sequence and expectations against the build, add Karoo-side checks, and record the
results after the ride. Claude's follow-up review `docs/REVIEW_H10_FOLLOWUP.md` confirms B1-B4 fixed and flags,
in priority order: **G8** the automatic scan can pair with and then *remember* a stranger's strap (never pair from
a ride-time scan); **G1/G2** the beat clock lags ~3 s for ~10 min after a short dropout with no gap marker, and a
mid-segment disconnect is never retried; **G3** capture is per segment (approach -> +2 min), not per ride;
**G4/G5** fsync on the Binder thread, artifacts not tied to segment/attempt ids. No preferred H10 is saved on the
Karoo yet, so the checklist has the rider save one in H10 Diagnostics first. Docs only; the two docs and the archive are committed. Details:
`handoffs/archive/2026-10-05-claude-next-ride-checklist-h10-followup.md`.

# Handoff: bounded H10 approach recovery installed

GritMap `0.10.40` (code 63) adds bounded 2s/5s/10s recovery for GATT errors and
unexpected disconnects during approach preparation, then safely falls back to Karoo HR. It also
adds explicit diagnostic events for the full automatic lifecycle. Approach mode reconnects only a
previously confirmed H10 and never ride-time scans for a stranger's strap. Forty-five focused tests,
lint and build pass; the APK is installed on the connected Karoo. The moving approach test remains.
Details: `handoffs/archive/2026-10-05-2126-codex-h10-approach-recovery.md`.

# Handoff: automatic approach-time H10 preparation installed

GritMap `0.10.39` (code 62) now warms up H10 Enhanced automatically when a rider comes within a
separate 250 m coarse approach area. Matching remains the same directed 30 m algorithm. It directly
reconnects a locally remembered H10 and silently falls back to ANT+ HR when none is confirmed.
Capture begins during approach, with abandoned-approach and post-segment
release timers. All 42 focused physiology/service tests, lint and build pass; the APK is installed.
The automatic moving-ride trigger still needs physical verification. Details:
`handoffs/archive/2026-10-05-2102-codex-automatic-approach-h10.md`.

# Handoff: H10 ride lifecycle verified end to end

GritMap `0.10.38` completed the full physical lifecycle: simultaneous BLE RR plus Karoo ANT+ HR,
BLE retained on the native ride screen, capture through Recording/Paused, then automatic save of
265 RR records and BLE teardown on Idle. The finalized artifact header, exact length and SHA-256
were verified; telemetry consumers stopped and the service left foreground mode without errors.
Manual first pairing remains; saved-address auto-reconnect is the next safe step. Details:
`handoffs/archive/2026-10-05-2042-codex-h10-ride-lifecycle-verified.md`.

# Handoff: service-owned H10 capture sustained during a Karoo ride

GritMap `0.10.38` (code 61) now owns H10 BLE/RR capture in `LiveSegmentService`, not the diagnostics
Activity. On the physical Karoo, the H10 connection survived returning to the native ride screen;
the RR artifact gained 64 records in 20 seconds while ANT+ HR continued and the foreground service
remained healthy. Focused physiology/service tests, lint and build pass. The current ride is still
running, so automatic ride-end artifact finalization/disconnect is the remaining physical check.
Details: `handoffs/archive/2026-10-05-2035-codex-service-owned-h10-capture.md`.

# Handoff: phone remembers the Karoo address; Karoo pairing contract drafted

Rider found typing the Karoo IP "terrible". Phone-only fixes are in (uncommitted): the last address
that worked is saved (migration v12) and pre-filled, and send failures now say "couldn't reach
<address> ... may have changed" instead of a raw network error. For Codex: `docs/KAROO_PAIRING_CONTRACT.md`
proposes `GET /ping` with a capability list, `POST /transfer` answering after import with
`imported`/`rejected: <reason>` (today it returns 200 before importing), an authenticated
`GET /segments`, a persistent receiver, and QR pairing with HMAC-signed requests; mDNS discovery is
optional. Nothing on the Karoo is built. Also found: the 2026-10-05 plan did import, onto a new
segment "Realize" (different route => different fingerprint from the old "Relize"). 426/426 tests.
Details: `handoffs/archive/2026-10-05-claude-saved-karoo-address-pairing-contract.md`.

# Handoff: versioned rider profile + coach-plan contract (phone app, uncommitted)

Claude implemented the phone side of the plan's provider-neutral guidance contract: a validated
`gritmap-coach-plan` document (rider / human coach / AI coach) -> preview -> active segment plan ->
sent as a normal baseline plan, plus `athlete_profile.profile_version` and plans flagged outdated
when FTP changes. **No Karoo change needed**: imported plans go out as `generator.type: "manual"`
with provenance in `modelVersion`, because the Karoo parser rejects unknown fields. A richer Karoo
extension (generator types, `riderProfileVersion`, capability handshake) is proposed, not built.
Schema is now v11; 417/417 tests; UI not yet live-checked. Commit note: it shares
`sendGuidancePackageToKaroo.ts` with Codex's uncommitted `karooTransferEndpoint` fix. Details:
`docs/COACH_PLAN_CONTRACT.md` and `handoffs/archive/2026-10-05-claude-coach-plan-contract.md`.

# Handoff: Polar H10 RR capture verified on Karoo

The first physical H10 capture succeeded: 163 real RR observations, enhanced metrics READY,
atomic `.rr` finalization, exact record length/header and SHA-256 verified, with no app or GATT
error. The active-partial count wording found during the test was fixed; all 18 focused tests,
lint and build pass. GritMap `0.10.37` (code 60) is installed on the connected Karoo. The artifact
remains app-private; ride-service capture and simultaneous recorded-ride validation are still
pending. Details: `handoffs/archive/2026-10-05-1550-codex-h10-physical-capture.md`.

# Handoff: H10 RR diagnostics hardened and versioned for physical testing

Codex completed debug build `0.10.36` (code 59) for the first Polar H10 desk test and addressed
Claude's B1-B4 data-integrity findings: no partial overwrite, durable 30-second checkpoints,
jitter-resistant RR timing, and recent-window validity gating. BLE state races/stale callbacks and
malformed-packet handling were also hardened. All 18 focused physiology tests, Android lint, and
the APK build pass. No Karoo was connected, so nothing was installed and physical H10 behavior is
still unverified. Details:
`handoffs/archive/2026-10-05-1504-codex-h10-rr-hardening.md`.

# Handoff: Claude reviewed the AI/physiology plan and the H10 code (findings only)

Claude's review is `docs/REVIEW_KAROO_AI_PHYSIOLOGY.md`; no code was changed. The architecture
stands. Four defects in the existing `physiology/` code should be fixed before any ride wiring:
**B1** `RrArtifactStore.kt:51` truncates a recoverable `.partial` on reopen; **B2** 8 KiB buffer
with no periodic flush loses ~8 min of RR on a process kill; **B3** arrival-time RR timestamps
flag good beats as out-of-order after a delivery stall; **B4** `RrLiveBuffer.kt:49` validity is a
lifetime ratio, not windowed. Also: karoo-ext FIT effects only take single numeric developer
fields (raw RR must stay out of the SDK; FIT's native `hrv` message needs a post-ride export
tool); upstream Needle's primary model is now Needle 3, not the plan's Needle 2; privacy/consent/
deletion/export additions; shared files (`AndroidManifest.xml`, `MainActivity.kt`,
`KarooHomeScreen.kt`) carry other uncommitted work. Run the diagnostics APK on the Karoo first.
Details: `handoffs/archive/2026-10-05-1455-claude-physiology-plan-review.md`.

# Handoff: desk-testable H10 RR diagnostics APK ready

Codex added Android 12 BLE scan/connect support, standard Heart Rate Service GATT subscription,
multi-RR timestamping, and a private H10 diagnostic screen accessible at GritMap > Settings >
Open H10 Diagnostics. It shows BPM, RR, contact, quality/readiness and sample count, then saves an
atomic SHA-256 `.rr` artifact. All 12 focused physiology tests pass and `assembleDebug` succeeds.
No device was connected at build time, so the APK is not installed and real H10 behavior is not
yet verified. Active ride service, HR Drift, Room and phone code remain untouched by the data path.
Details: `handoffs/archive/2026-10-05-1447-codex-h10-diagnostics-apk.md`.

# Handoff: isolated H10 packet/RR foundation implemented

Codex started the approved H10 work in new `apps/karoo/.../physiology` files only. The module now
decodes standard-BLE H10-style Heart Rate Measurement packets (BPM, contact state, multiple RR
values), validates/preserves observations, bounds the live window, tracks quality, writes
recoverable fixed-record `.rr.partial` artifacts, atomically finalizes with SHA-256, and rejects
unsafe paths. All 9 focused tests pass. The full 138-test Karoo suite has one unrelated existing
failure in `KarooPreviewStateTest`; it also fails alone and was not touched. Bluetooth connection,
service, Room, and UI wiring remain pending Claude's boundary review. Details:
`handoffs/archive/2026-10-05-1431-codex-h10-packet-rr-foundation.md`.

# Handoff: independent GritMap AI/H10 physiology plan ready for Claude review

Codex consolidated today's Needle, Polar H10, standard-HR fallback, RR retention, privacy, and
rollout decisions in `docs/PLAN_KAROO_AI_PHYSIOLOGY.md`. GritMap has no external coaching-product
dependency: until its own full planning product exists, riders can enter versioned guidance from
themselves, a human coach, or an AI coach. All 12 local FIT files were audited: none contains
RR/HRV; the 2026-09-13 file recorded Polar as ANT+ BPM. Claude is requested to review the plan
before implementation. Details:
`handoffs/archive/2026-10-05-1417-codex-independent-ai-physiology-plan.md`.

# Handoff: native Karoo map pacer installed

Codex installed `0.10.35` (code 58). GritMap now enables a native Karoo map layer, draws the
active segment trace, and updates one stable custom pacer symbol at the route coordinate derived
from target progress. Both are removed outside a valid active match. Projection, encoding,
identity, and teardown tests pass. Karoo may need the extension toggled off/on once because its
declared capability changed. Details: `handoffs/archive/2026-10-02-native-map-pacer.md`.

# Handoff: Pacing Coach continuous zone transitions installed

Codex installed `0.10.34` (code 57). Zone rows now move/scale/fade continuously from fractional
zone progress instead of jumping at boundaries. Adjacent/far context has a much stronger opacity
gradient, and moving content is clipped below the recommendation header. Karoo's ~1 Hz field
limit means a smooth stepped conveyor rather than 60 fps animation. Tests and build pass. Details:
`handoffs/archive/2026-10-02-pacing-coach-zone-transitions.md`.

# Handoff: Pacing Coach stack order corrected

Codex installed `0.10.33` (code 56). Future target-only zones now sit above the current zone;
completed frozen-average zones sit below. Future rows are neutral instead of resembling actual
power fill. At 20/20, zones 19 and 18 remain visible beneath the current zone. Ordering regression
tests and build pass. Details: `handoffs/archive/2026-10-02-pacing-coach-stack-order.md`.

# Handoff: Pacing Coach 20-zone demo installed

Codex installed `0.10.32` (code 55). The running demo and page-editor preview now share a
contiguous 20-zone REST/HOLD/PUSH plan, without changing real imported plans. This visibly tests
the `x/20 ZONES` counter, frozen past averages, live current power, and target-only future rows.
Focused tests and build pass. Details:
`handoffs/archive/2026-10-02-pacing-coach-20-zone-demo.md`.

# Handoff: Pacing Coach zone lifecycle corrected

Codex installed `0.10.31` (code 54). Future zones now show target only; only the current zone
updates from live/settling actual power; past zones use their frozen per-zone recorded average.
The counter moved into the recommendation banner (`HOLD · 2/3 ZONES`). Focused tests and build
pass. Details: `handoffs/archive/2026-10-02-pacing-coach-zone-lifecycle.md`.

# Handoff: Pacing Coach vertical zone progress installed

Codex installed `0.10.30` (code 53). The stacked Pacing Coach now fills zone completion bottom
to top, restores the primary recommendation banner and `current/total ZONES` counter, uses dark
recommendation/target labels, and places the bars closer together. Actual power still fills
horizontally and remains printed inside the bar. Focused tests and `assembleDebug` pass. Details:
`handoffs/archive/2026-10-02-pacing-coach-vertical-zone-progress.md`.

# Handoff: Pacing Coach zone-stack renderer installed

Codex replaced the text-led Pacing Coach with the approved Canvas zone stack and installed
`0.10.29` (code 52) on the connected Karoo. Actual watts now fill each power bar and appear
inside it; target watts sit under REST/HOLD/PUSH with one target line; zone completion is a
separate translucent layer; past/future zones recede. Focused tests and `assembleDebug` pass.
Physical large/compact screenshots are the next validation step. Details:
`handoffs/archive/2026-10-02-1129-pacing-coach-zone-stack.md`.

# Handoff: Pacing Coach interruption recovered

Codex reconstructed the completed `0.10.28` Pacing Coach work after the app crash. The physical
Karoo still runs code 51 and retains all three segments. A new regression test confirms the
next-zone preview follows the phone's adaptive plan boundaries rather than assuming quarter-mile
zones; all 12 focused tests pass. Physical large/compact visual review is still next. Details:
`handoffs/archive/2026-10-02-pacing-coach-resume-adaptive-zone-check.md`.

# Handoff: adaptive pacing-zone length + ride previews + segment-creation redesign (phone app)

- Updated: `2026-10-02 09:10 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `d2befcb Merge remote-tracking branch 'origin/main'` -- **everything below is uncommitted**
- Worktree: `apps/karoo/` and `ios/GritMap.xcodeproj/project.pbxproj` are Codex's and were not
  touched. The previous LATEST.md (Codex's stacked Karoo entries: Pacing Coach `0.10.28`, global
  FTP sync `0.10.27`, etc.) was archived verbatim to
  `handoffs/archive/2026-10-02-0903-claude-pre-adaptive-zones-plus-codex-pacing-coach.md`;
  read it for the Karoo history.

## FOR CODEX -- the one contract change that touches the Karoo

**`baselinePacingPlan.zones[]` zone length is no longer a fixed quarter mile.** The phone now
picks it from the segment length (`chooseZoneLengthMeters` in `src/pacing/computeZoneGrades.ts`):
aim for ~20 zones, then snap to the nearest of **100m / 200m / 402.336m / 804.672m**.

| Segment | Zone length | Zones |
|---|---|---|
| half mile (805m) | 100m | 8 |
| 2 mi | 200m | ~16 |
| Diablo (10.4km) | 402.336m | 26 (unchanged from before) |
| 25 km+ | 804.672m | capped at half-mile zones |

- **Wire schema is unchanged** -- same fields, still contiguous, first zone starts at 0, last
  ends at the segment length, 80W step limit still applied, `RECOVER`/`HOLD`/`PUSH` still the
  enum. Only the zone *count* (~8-40) and *length* vary per segment. `generator.modelVersion` is
  now `pacing-anchor-grade-v2` (was `-v1`) so you can tell old plans from new.
- **Why**: client asked how this works on short segments; fixed quarter-mile gives a 0.5mi
  segment 2 zones. 100m is the Karoo climber feature's resolution, per the client. A fixed 100m
  was rejected: ~104 zones on Diablo = a new watt target every ~22s, and per-100m grade is noisy.
- **Please verify on the Karoo side** (I only grepped, did not read these paths in depth):
  - `ActiveAttemptSession.kt` has its own hardcoded `QUARTER_MILE_METERS = 402.336` for live
    time-bank splits. That is independent of the plan zones, so nothing breaks, but on short
    segments the plan's 100m target bands won't line up with the Karoo's quarter-mile live splits.
  - The new Pacing Coach "next-zone preview" / zone-progress logic must read zone boundaries
    from the plan (`startDistanceMeters`/`endDistanceMeters`), not assume ~402m. I found no
    `402.8`/zone-length constant or zone-count cap in `apps/karoo/app/src/main/java`, but did not
    trace the preview code.
  - `AiPlanValidator.kt` limits (100W step, 150% FTP, contiguity) are unchanged assumptions; I
    did not find a zone-count cap.
- The 402.336 choice is deliberately the true quarter mile (the previous phone constant was
  402.875, copied from a Needle-era sample fixture) so Diablo's bands now align with the
  Karoo's own 402.336 live splits.
- **Not yet re-sent to a real Karoo** with the new zoning. The first end-to-end transfer
  confirmed earlier used the old fixed-length zones. A resend of Diablo should look identical
  (26 zones); a short segment would exercise the new path.

## Also built this session, uncommitted (phone app only, no Karoo impact)

1. **Quarter-mile breakdown was invisible -- fixed.** `ElevationProfileChart.tsx` squeezed all
   zones into one container width; on Diablo that was 12.6px/zone, under my own 26px label
   threshold, so no watt numbers ever rendered. Zones now get a fixed 36px each in a
   horizontally scrollable chart.
2. **Rides list route-shape thumbnails.** Migration v8 adds `rides.preview_polyline_json`
   (35-point decimated polyline computed once at import in `persistImportedRide.ts`, same
   convention as total distance/ascent); `RidePreviewThumbnail.tsx` draws it (uniform scale +
   cos(lat) correction). Rides imported before v8 keep the generic icon (no backfill).
3. **Segment-creation redesign** (`DefineSegmentScreen.tsx`): Start/Finish tabs at the top (same
   `activeHandle` state), new full-ride `RideElevationChart.tsx` with the selection shaded, and
   chart zoom synced to map zoom via a new `onViewportChange` prop on `RouteMapView.native.tsx`
   (uses `MapRef.getBounds()`, confirmed to exist in the installed MapLibre types; fires on
   `onRegionDidChange` only) -> `computeVisibleDistanceRange.ts`. Native-only: web has no map.
   `DistanceRangeScrubber` kept as a secondary fine-adjust control.

## Verified

- `npm run typecheck` clean; `npm test` **366/366**; `npm run web:smoke` clean.
- Diablo fixture: adaptive zoning yields 26 zones at 402.336m (checked directly).
- Tests added: `chooseZoneLengthMeters`, `computeAdaptiveZoneGrades`, relative remainder-merge,
  `computeVisibleDistanceRange`, ride preview polyline (insert + list), half-mile plan has 100m zones.
- **Not live-checked on a device**: the simulator had no data. The scrolling zone chart, ride
  thumbnails, tabs, and map->chart zoom sync have only automated/code-level verification.
  `batchImport.test.ts` is timing-sensitive (30s ceiling) and flaked once under full-suite load;
  it passes in ~15s alone.

## Hazards

- Per-100m grade from 10m-resampled elevation is noisy; with `GRADE_SENSITIVITY = 0.05`, 1pp of
  grade noise = 5% power jitter on short segments. The 80W step limiter bounds it but
  classifications on 100m zones may flicker. Untested against real short-segment data.
- **Uncommitted and mixed ownership.** Mine: `src/pacing/*`, `src/db/{migrations,persistImportedRide,
  listRides}*`, `src/screens/{ElevationProfileChart,RideListScreen,RidePreviewThumbnail,
  RideElevationChart,DefineSegmentScreen,RouteMapView.*,SegmentDetailScreen}.tsx`,
  `src/segments/computeVisibleDistanceRange*`. Appear to be Codex's phone-side URL fix, also
  uncommitted: `src/karoo/{sendSegmentToKaroo,sendGuidancePackageToKaroo}.ts`,
  `karooTransferEndpoint*`, `SendToKarooScreen.tsx` -- whoever commits should not sweep the
  other's files. `docs/PLAN_KGHOST_IPHONE_UPDATES.md` is untracked and not mine.
- Schema migration v8 runs automatically on next app launch; no native rebuild needed (JS only).

## Next safe action

Client: reload the phone app, open Diablo, confirm watt labels are visible/scrollable; define a
short segment and check the 100m zones. Codex: check the Pacing Coach next-zone preview against
variable zone lengths, then resend a short segment to the Karoo to exercise the new zoning.
