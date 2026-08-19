# Handoff: First root-app UI increment complete (import → list → detail)

- Updated: `2026-08-18 15:39 PDT`
- Agent: `Claude`
- Branch: `main`
- Head (root-app work): `895239e scaffold: add MapLibre dependency + minimal MapView screen
  (closes #47)` — already pushed to `origin/main` as of this update.
- Local `main` is currently 4 commits ahead of `origin/main`, all of them Codex's parallel
  `apps/karoo/` work (responsive fields, GM label rename) — not touched or pushed by this
  update; see the Parallel Karoo sections below and their own archived handoffs.
- Worktree: clean

## Manual pass: duplicate-decision modal + multi-file batch import — done, both verified

The one gap flagged in the previous handoff ("only a single fresh import was manually
verified... worth a manual pass before considering this fully proven") is now closed:

- Downloaded both real fixtures fresh into the iOS Simulator via Safari (`fixtures/fit/*.fit`
  served over a local `python3 -m http.server`), confirmed byte-identical to the source files
  before use (355 KB / 277 KB, exact match).
- **Fresh single import**: selected fixture B (`...2026-08-09-0844.fit`) alone via the real
  system document picker (Browse → On My iPhone → Downloads). Imported cleanly, footer read
  `Imported: 1 · Replaced: 0 · Duplicate: 0 · Failed: 0`, and the Ride List correctly showed a
  new "Sunday, Aug 9 · 34.5 mi · 2h 36m" row.
- **Multi-file batch + duplicate modal, combined**: re-opened the picker, multi-selected
  *both* fixtures (A already imported earlier this session as `debug-fixture.fit`, B just
  imported above) in one picker session. Both rows showed `Pending` simultaneously, confirming
  sequential batch processing works. The duplicate modal correctly appeared for the first file
  processed, with the exact matched-rule copy: *"Karoo-Morning_Ride-2026-08-09-0844.fit matches
  an existing ride byte-for-byte."*
  - Tapped **Keep Existing** on file 1 → row correctly settled to `Duplicate`, footer
    `Duplicate: 1`, and the flow automatically advanced to file 2's duplicate prompt (no manual
    re-trigger needed).
  - Tapped **Replace Existing** on file 2 → row correctly settled to `Replaced`, footer ended
    `Imported: 0 · Replaced: 1 · Duplicate: 1 · Failed: 0`.
- **Verified the replace at the DB level, not just the UI**: queried the on-device
  `gritmap.db` directly — still exactly 2 rows in `rides` (not 3), confirming
  `replaceImportedRide` updated the existing row in place rather than inserting a new one;
  `updated_at_ms` on the replaced row was bumped to the replace time; `imported_files` now
  points at the new file's `sha256`/`original_filename`. Ride List after the batch still shows
  exactly 2 rides, and the Aug 2 row's filename updated from `debug-fixture.fit` to
  `Karoo-Morning_Ride-2026-08-02-0837.fit`, matching the DB.
- This exercises every remaining unverified branch of `ImportScreen.tsx`'s orchestration: the
  `awaitDuplicateDecision()` pause/resume across multiple pending files, both resolution paths,
  and the footer tally — not just the "single clean import" path already covered last session.

## Outcome

The root Expo app has a working core loop for the first time: **import a real FIT file →
see it in a ride list → view its detail**. All 8 PRs from
[`docs/PLAN_first_ui_increment.md`](../docs/PLAN_first_ui_increment.md) (reviewed by Codex,
revisions incorporated, then implemented sequentially in this session) are committed and each
was verified before moving to the next — typecheck/tests/`web:smoke` after every PR, plus
real on-device verification via the iOS Simulator for every native-dependent piece (not just
"it builds"). Figma mock the screens were built against:
https://www.figma.com/design/cyaMDDfLBKFc4NNK1SUUnb?node-id=29-205

## Changed

1. `eb1d91a` `nav/app-shell` — bottom-tab + native-stack navigation shell; semantic theme
   tokens (`src/theme/{colors,spacing,icons,Icon}.ts`) mirroring the Figma variable names.
2. `364e3ee` `scaffold/dev-client-prebuild` — moved off Expo Go (`docs/MVP.md` already
   required this independent of any feature); `ios/`/`android/` native projects generated and
   committed; found and fixed a real `metro.config.js` gap (expo-sqlite's web target needs
   `wasm` registered as an asset extension, or `web:smoke` breaks outright).
3. `b4dd800` `db/expo-sqlite-adapter` — `toSyncDatabase.ts` bridges real `expo-sqlite` to the
   interfaces `migrations.ts`/`persistMatchCandidate.ts` already expect, using its one-shot
   `execSync`/`getFirstSync`/`runSync`/`getAllSync` (confirmed auto-finalizing by reading the
   `.d.ts` — this was the main required revision from Codex's review). Migration v3 adds
   `rides.total_distance_meters`/`total_ascent_meters`, populated once at import time.
4. `5d1d233` `db/persist-imported-ride` — `insertImportedRide`/`replaceImportedRide` with an
   injected `generateId` (not a bare `crypto.randomUUID()` global) and a `runMany` bulk-insert
   path for `ride_points` that explicitly finalizes its prepared statement even on error.
5. `0b98633` `import/import-fit-file` — `extractRideIdentity()`'s rules (device ID source,
   no-stable-activity-ID finding, start/duration fields) were derived by parsing both real
   fixtures directly and inspecting actual FIT message fields, not guessed; tests assert exact
   values. `importFitFile()` orchestrates parse → dedupe → persist with no filesystem access.
6. `0231b7d` `import/fit-import-screen` — `expo-document-picker`/`file-system`/`crypto` added
   and re-linked; retained-file cleanup ordering (delete-new-on-failure, delete-old-on-replace-
   after-commit) implemented per the incorporated review.
7. `87c8fe2` `db/ride-queries` — `listRides`/`getRideDetail`, reading the v3 summary columns
   directly, no runtime aggregation.
8. `a237275` `ui/ride-list-and-detail` — real screens replacing PR 1's stubs.

## Verified

- Every PR: `npm run typecheck && npm test && npm run web:smoke` — all green throughout: 43
  tests after PR 3 growing to 76 by PR 7/8, 0 failures at any point.
- **Real on-device verification, not simulated**: downloaded an actual Karoo fixture
  (`Karoo-Morning_Ride-2026-08-02-0837.fit`) via Safari in the iOS Simulator, imported it
  through the real system document picker in the running dev-client build, then independently
  confirmed success by querying the app's on-device `gritmap.db` directly with `sqlite3` —
  `start_timestamp_ms`, `duration_ms`, `total_distance_meters`, `device_id`, and
  `ride_points` row count all exactly matched values hand-computed from the raw FIT file, and
  the retained file existed on disk at the recorded URI with the correct byte size. Then
  confirmed the Ride List and Ride Detail screens render that same ride correctly — exact
  distance/duration/elevation matches on both screens (elevation converted to feet correctly:
  550.0 m → 1804 ft).
- This exercised the full native chain together (document picker → file read → crypto hash →
  file retain → sqlite persist → query → render), not each piece in isolation.

## External state

- The iOS Simulator (`iPhone 17`, udid `694299A2-AD95-4A4D-99C0-9F682C34DEE6`) has the dev
  client installed with one real imported ride in its on-device `gritmap.db`
  (`Karoo-Morning_Ride-2026-08-02-0837.fit`, imported as `debug-fixture.fit`). This is
  simulator-local state, not committed to the repo — harmless to leave, or reset via
  `xcrun simctl erase` if a clean slate is wanted.
- A background HTTP server used to get the fixture onto the simulator (`python3 -m http.server
  8899` in `fixtures/fit/`) was killed after use.
- A Metro bundler (`npx expo start --dev-client`, backgrounded during this session) may still
  be running on `localhost:8081` — check `ps aux | grep "expo start"` and stop it if not
  needed, it doesn't need to stay up between sessions.

## Hazards and blockers

- This checkout is shared with cron (paused) and with Codex's concurrent Karoo sessions —
  check `git branch --show-current` and `git status` before running git commands here. Codex
  landed several `apps/karoo/` commits during this session (see git log / archived handoffs)
  entirely independently; no conflicts occurred because each side only ever staged its own
  files explicitly, never a broad `git add`.
- **Not done, flagged in the plan but out of scope for this increment**: PR #54 (MapLibre
  scaffold) is still unmerged and unreviewed. Once it merges, `expo prebuild --clean` needs to
  be re-run to link MapLibre natively — this wasn't needed yet since no screen uses it.
- Segment definition (needs a map) is deliberately not part of this increment — see the plan's
  Context section for why. It's the natural next phase once PR #54 lands.
- The "rescan against every segment on replace" MVP requirement is a documented no-op (no
  segment-scanning orchestrator exists anywhere yet) — tracked as a known follow-up, not
  forgotten; see the comment in `persistImportedRide.ts`'s `replaceImportedRide`.
- ~~Duplicate-decision and batch-import flows... not separately exercised on-device~~ —
  **resolved this update**, see the "Manual pass" section above. Both resolution paths and
  sequential multi-file processing are now confirmed on-device and at the DB level.

## Parallel Karoo status (carried forward, see archive for full history)

Codex has been actively shipping on `apps/karoo/` throughout this session, entirely
independently — most recently: overlay crashes fixed, then replaced with a native in-ride
alert (karoo-ext has no public API for the native Climber sheet), persistent Target
Power/Pacing Profile fields remain. Current APK is versionCode 4 (`Version 0.3.0`), built and
verified but the Karoo was disconnected before install — reconnect and
`adb install -r apps/karoo/app/build/outputs/apk/debug/app-debug.apk` when ready. Full
blow-by-blow is in `handoffs/archive/` (search for "Parallel Karoo").

## PR #54 / issue #47 — resolved, not via a raw merge

PR #54 had genuine merge conflicts (its `App.tsx` change targets the old template stub;
`main` now has a real navigation shell) plus two unrelated scratch files
(`state/tmp_issue5_body.md`, `tmp_adapter_check.mjs`) that Karen's own verdict on #47 had
already flagged as scope creep. Rather than merge as-is, `895239e` brings in just #47's
actual scope directly on `main`: the `@maplibre/maplibre-react-native` dependency and a
standalone `src/screens/MapScreen.tsx` (not wired into any navigator yet). Re-verified fresh
rather than trusting the PR's stale verdict — `Map`/`mapStyle` read from the installed
v11.3.6 source, typecheck/`web:smoke` both pass, and `expo prebuild --clean` + a real
on-device build confirm MapLibre links and signs correctly (0 errors, existing app data
intact). This also closes out issue #19's remaining gap (ios/android + DEV_SETUP.md already
existed from this session's earlier `scaffold/dev-client-prebuild` commit; only the
MapLibre-linked part was missing).

PR #54 is closed with an explanatory comment
(https://github.com/frason/GritMap/pull/54#issuecomment-5333831582); issue #47 closes via
`895239e`'s commit message once pushed.

**New flagged risk, not yet real:** `MapScreen.tsx` isn't reachable from the entry graph, so
`web:smoke` never tries to resolve MapLibre's native-only imports for web. The moment
segment-definition work wires this screen into actual navigation, that risk (previously
flagged in `docs/PLAN_first_ui_increment.md`) becomes live and will need addressing.

## Next safe action

The root-app import→list→detail increment (all 8 PRs, PR #54's MapLibre scaffold, and now the
manual duplicate/batch-import pass) is fully verified and pushed. Remaining priorities, in no
particular order: integrating issue #43 from its worktree; handing off issue #53; or starting
segment-definition work now that a map exists to build on (`src/screens/MapScreen.tsx`, not
yet wired into navigation — see the flagged `web:smoke` risk above once it is).

Note: local `main` is 4 commits ahead of `origin/main` from Codex's parallel `apps/karoo/`
work (responsive fields + GM label rename) — not this update's to push; confirm with Codex's
own handoff entries before pushing those.

## Parallel Karoo field-suite update — Codex, 2026-08-18 13:34 PDT

- Read this handoff before editing and kept all work under `apps/karoo`; Claude's active MapLibre,
  iOS, package, and root screen files were not staged or changed by Codex.
- Installed verified GritMap 0.3.0 first with `adb install -r`, backed up the private Room files,
  and confirmed versionCode 4 plus retained database/WAL.
- `45c357b apps/karoo: add pacing field suite` adds the agreed six-field library and bumps the APK
  to 0.4.0/versionCode 5:
  - graphical GritMap Pacing Coach;
  - enhanced graphical GritMap Pacing Profile;
  - graphical GritMap Segment Performance;
  - numeric GritMap Target Power;
  - numeric GritMap Power Delta;
  - numeric GritMap Predicted Finish.
- Shared live state now carries actual power, power delta, next-zone distance, elapsed-progress
  finish prediction, and plan adherence. Prediction waits for 30 m/5 seconds. Adherence uses only
  fresh power samples within max(15 W, 10% target); stale power is excluded.
- Ahead/behind and physiological headroom were deliberately not fabricated because no target-time
  contract or validated model output currently supplies them.
- Focused metric, numeric-state, combined-renderer, duration, and stale-power tests passed; APK
  assembly passed. Final 0.4.0 was installed successfully in place on Karoo device
  `00442GA241760203`; no data clearing or instrumentation occurred.
- Next device check: open Karoo's page editor under Extensions and confirm all six GritMap fields
  appear with preview data. Existing page configurations retain `live-pacing` as Pacing Profile.

## Parallel Karoo compact-label update — Codex, 2026-08-18 14:00 PDT

- `450ebc5 apps/karoo: shorten field labels to GM` changes all six Karoo field-library names
  from `GritMap …` to `GM …` without changing their stable data type IDs.
- APK version is now 0.4.1/versionCode 6. JVM tests and debug assembly passed, and the APK was
  installed successfully in place on Karoo `00442GA241760203` with application data retained.
- The full app/launcher title remains `GritMap Karoo`; only constrained field labels were
  shortened.
- Next device check: reopen Extensions in the page editor and confirm the compact names. The
  responsive small/medium/large field-layout work discussed from screenshots remains separate.

## Parallel Karoo responsive-field update — Codex, 2026-08-18 15:14 PDT

- `9a1d33d apps/karoo: adapt graphical fields to page size` makes Pacing Coach, Pacing Profile,
  and Segment Performance responsive to Karoo's 60-row page grid.
- Small slots show only the essential signal, medium slots add the next most useful metric, and
  large slots retain the complete content. Pacing Profile no longer squeezes its graph into a
  small slot.
- APK is now 0.5.0/versionCode 7. Full JVM tests and debug assembly passed after correcting one
  compile-time visibility error, and the verified APK was installed successfully in place on
  Karoo `00442GA241760203` with app data retained.
- Next device check: preview the three graphical fields at different page sizes and confirm the
  15/30-row breakpoints feel right on hardware.
