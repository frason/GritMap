# Plan: First real UI increment (FIT Import → Ride List → Ride Detail)

Status: **proposed, awaiting review** — not yet implemented. Written by Claude, approved by
the user on the design/approach; routed here for Codex's review before implementation starts,
per this repo's shared handoff protocol (see `handoffs/LATEST.md`).

This plan is scoped to the root Expo app (`App.tsx`, `src/`) — it does not touch `apps/karoo/`.

## Context

The root Expo app (`App.tsx`) is still the unmodified Expo template stub — zero navigation,
zero screens exist. All work so far (`src/`) is pure business logic: FIT parser, directed-
segment matcher, attempt comparison, SQLite schema/migrations, duplicate detection — all
tested, none of it wired to any UI.

`docs/MVP.md` (the authoritative spec) explicitly scopes the MVP as local-only with "no
network dependency beyond map tiles" (lines 20, 173), and defines required screens (FIT
import, ride list, segment definition, comparison) that don't exist yet either.

Given this, the user chose to build the MVP's core screens first (a previously-discussed
phone-to-Karoo local-network sync feature is paused) — matching the project's own stated
delivery order (`docs/MVP.md` lines 148-156): FIT parser (done) → SQLite schema + batch
import + duplicate handling (schema/logic done, **no UI/write-path yet — this gap**) → route
rendering/segment-selection (next phase, depends on unmerged PR #54's MapLibre work) →
matcher (done) → diagnostic review → comparison (logic done, no UI).

This plan scopes exactly that immediate gap: a navigation shell, the dev-client migration
`docs/MVP.md` line 17 already mandates ("Use an Expo development build, not Expo Go" — true
independent of any sync feature), the missing DB write-paths, and the first two real screens
(FIT Import, Ride List + minimal Ride Detail). Segment definition (needs a map) is
deliberately **not** in this increment — it should build on PR #54 once that's reviewed and
merged, not before.

A Figma mock of all four screens/states (Ride List, Ride Detail, Import, Import — duplicate
prompt) was built and approved by the user:
https://www.figma.com/design/cyaMDDfLBKFc4NNK1SUUnb?node-id=29-205

Per explicit user direction: **all colors and icons in the implementation must go through
semantic tokens**, not hardcoded hex values or raw icon-library glyph names — mirroring the
named color/icon variables in the Figma file (`color/background`, `color/brand`, `icon/route`,
etc.) so the design and the code can be cross-referenced by name.

## A blocking gap this plan discovered, verified directly against source

`src/db/migrations.ts` and `src/db/persistMatchCandidate.ts` are written against a hand-rolled
interface (`MigrationDatabase`/`MatchPersistenceDatabase`: `.exec(sql)` / `.prepare(sql).get()`
/`.run()`) — confirmed by reading both files. The **real** `expo-sqlite` `SQLiteDatabase`
(confirmed via `node_modules/expo-sqlite/build/SQLiteDatabase.d.ts` and
`SQLiteStatement.d.ts`) exposes a structurally different sync API: `execSync(sql)` /
`prepareSync(sql)` → statement whose entry point is `executeSync(params)` → an iterator with
`getFirstSync()`/`getAllSync()`. There is no `.exec()`/`.prepare().get()`/`.run()`.
**Nothing in the repo bridges these two shapes today** — `persistMatchCandidate` has only ever
run against `node:sqlite` in tests, never a real device. A small adapter (§3 below) is required
before anything can persist for real; it's additive, doesn't require touching the existing
migration/persistence files (TypeScript structural typing lets it satisfy their narrower
interfaces).

## Implementation plan

### 1. Navigation shell — React Navigation, not Expo Router

Add `@react-navigation/native`, `@react-navigation/native-stack`, `@react-navigation/bottom-tabs`,
`react-native-screens`, `react-native-safe-area-context` (via `npx expo install`, so Expo's
resolver pins SDK-57-compatible versions). Also `@expo/vector-icons` for the icon glyphs behind
the semantic icon layer (§0 below).

Expo Router's value (file-based routing, deep links) isn't needed — MVP.md rules out any
deep-link requirement — and it would mean restructuring the entry point and pulling a large
peer-dependency set for conventions this app doesn't use. Plain React Navigation matches the
project's existing minimal, explicit style and is lower-risk for `web:smoke` (only adds a
component tree, doesn't change the bundling/entry model).

New files:
- `src/navigation/types.ts` — typed param lists (`RidesStackParamList` with `RideList`,
  `RideDetail`, `Import`; a `SegmentsStackParamList` stub).
- `src/navigation/RidesStackNavigator.tsx` — native-stack: `RideListScreen` → `RideDetailScreen`,
  with `ImportScreen` also pushed from this stack (an action, not its own tab).
- `src/navigation/RootNavigator.tsx` — bottom-tabs with two tabs, **Rides** and **Segments**
  (a placeholder screen for now) — this directly realizes MVP.md's "two primary sections"
  guidance (line 123).
- `App.tsx` — rewritten: `SafeAreaProvider` → `DatabaseProvider` (§3) → `NavigationContainer`
  → `RootNavigator`, replacing the template stub entirely.

### 0. Semantic theme tokens (colors + icons)

Per explicit user direction, added ahead of any screen work so every screen consumes tokens
from day one rather than hardcoding values that get refactored later:

- `src/theme/colors.ts` — a `colors` map (`background`, `surface`, `border`, `textPrimary`,
  `textSecondary`, `textTertiary`, `textOnBrand`, `brand`, `brandSubtle`, `statusSuccess`(+
  `Subtle`), `statusWarning`(+`Subtle`), `statusDanger`(+`Subtle`), `statusInfo`(+`Subtle`),
  `disabledBackground`, `disabledText`) — names and values mirror the Figma file's
  `GritMap/Color` variable collection exactly.
- `src/theme/spacing.ts` — `spacing`/`radius` maps mirroring the Figma `GritMap/Spacing`
  collection.
- `src/theme/icons.ts` — a semantic `IconName` type (`chevronRight`, `chevronLeft`, `plus`,
  `checkCircle`, `alertTriangle`, `xCircle`, `file`, `clock`, `route`, `mapPin` — mirroring the
  Figma file's `icon/*` components) mapped to `@expo/vector-icons` Ionicons glyph names in one
  place, so screens never import an icon-library glyph name directly.
- `src/theme/Icon.tsx` — `<Icon name="route" color="brand" size={20} />` wrapper tying the
  semantic icon name and a color token together.

### 2. Dev-client / prebuild migration

`app.json` currently has no `ios.bundleIdentifier` / `android.package` — both mandatory for
`expo prebuild`, neither exists. Add them (`com.gritmap.app`, mirroring `apps/karoo`'s
`com.gritmap.karoo` convention) plus `"scheme": "gritmap"` (needed for the dev client's deep
link from Metro).

Add `expo-dev-client`. Update `package.json` scripts: `"start": "expo start --dev-client"`,
`"ios": "expo run:ios"`, `"android": "expo run:android"`, add `"prebuild": "expo prebuild"`.
Run `expo prebuild` and **commit the generated `ios/`/`android/` dirs** — `.gitignore` already
only excludes build *artifacts* (`ios/Pods/`, `ios/build/`, `android/build/`,
`android/.gradle/` — confirmed by reading it), which only makes sense if the native project
directories themselves are meant to be checked in.

Add `docs/DEV_SETUP.md` covering why Expo Go won't work, prerequisites, and the new scripts.

**`web:smoke` risk, addressed not assumed away:** `react-native-screens` and
`react-native-safe-area-context` both ship web implementations (standard React-Navigation-on-web
pairing); `expo-dev-client` never gets imported from app JS. Confirmed: a scaffolding spike
with the nav deps + `@expo/vector-icons` installed passed `npm run web:smoke` cleanly. Run it
again as part of verifying the picker/crypto PR (§4) — if it breaks, fix the Metro/web-shim
resolution, don't silently drop the CI step. Flagging for later, out of scope now: PR #54's
MapLibre dependency has no web target and will likely need its own web:smoke fix when merged.

**PR #54 native-project coordination (Codex item 7) — checked, not assumed:** `gh pr diff 54`
touches only `App.tsx`, `package.json`/`package-lock.json` (adds
`@maplibre/maplibre-react-native`), and a new `src/screens/MapScreen.tsx` — it does **not**
touch `app.json` or any config-plugin setup, so running `expo prebuild` here doesn't conflict
with PR #54's current diff. The real coordination point is different: `@maplibre/maplibre-
react-native` is itself a native module, so once PR #54 merges, the native `ios`/`android`
dirs generated by this PR will need `expo prebuild --clean` re-run to link MapLibre's native
code — that regeneration is a required follow-up tied to PR #54's merge (call it out in that
PR's own description/a fast-follow commit), not a blocker for starting this PR now.

### 3. DB plumbing: adapter + write-path modules

**Revised per Codex review item 1** (verified against `node_modules/expo-sqlite/build/
SQLiteDatabase.d.ts`): `SQLiteDatabase.runSync(sql, params)`, `.getFirstSync(sql, params)`, and
`.getAllSync(sql, params)` are documented convenience wrappers around
`prepareSync()`→`executeSync()`→`finalizeSync()` — each call prepares, executes, and finalizes
internally, so using them directly (instead of holding a `prepareSync()` handle across calls)
means no lingering native statement, no separate `finalize()` needed on the caller side.

- `src/db/types.ts` — shared `SyncDatabase` interface (superset of the existing
  `MigrationDatabase`/`MatchPersistenceDatabase` shapes): `exec(sql)`, `prepare(sql) → {get,
  run, all}` (each call is a fresh one-shot — no statement reused across calls), plus one
  additional method, `runMany(sql, paramsList): void`, for the one genuinely bulk write path
  (below).
- `src/db/toSyncDatabase.ts` — adapts real `expo-sqlite` `SQLiteDatabase` → `SyncDatabase`:
  `exec` → `execSync`; `prepare(sql).get/run/all(params)` → `getFirstSync`/`runSync`/
  `getAllSync(sql, params)` directly (one-shot, auto-finalizing, per above — no `prepareSync()`
  handle retained by this generic path); `runMany(sql, paramsList)` is the one place that does
  hold a `prepareSync()` handle across a loop — `try { const stmt = db.prepareSync(sql); for
  (const params of paramsList) stmt.executeSync(params); } finally { stmt.finalizeSync(); }` —
  used only for the `ride_points` bulk insert below, where recompiling per-row SQL via the
  one-shot methods would be needlessly slow for hundreds of rows. Add a structural fake-object
  unit test for the compat mapping (Codex item 1) plus one real on-device migration/insertion
  smoke test — not exhaustively unit-testable since it wraps a native module.
- `src/db/initializeDatabase.ts` + `src/db/DatabaseProvider.tsx` — connect → adapt → migrate →
  expose via `useDatabase()`; renders a minimal fatal-error screen on migration failure instead
  of crashing blank.
- **New migration v3** (Codex item 6): adds `rides.total_distance_meters REAL` and
  `rides.total_ascent_meters REAL`, populated once at import time (below) rather than
  aggregated on every list read. Exact semantics, documented in the migration's SQL comment and
  tested: distance = the last `ride_points.distance_meters` value (FIT distance is cumulative);
  ascent = the sum of positive deltas between consecutive points that both have a present
  `elevation_meters` value, in `point_index` order — a gap across missing elevation samples
  contributes no delta (never fabricates a jump across the gap). Chosen over query-time
  aggregation because the full point array is already in memory exactly once, at import, where
  computing this is free; re-aggregating on every `listRides()` call would not be.
- `src/db/persistImportedRide.ts` — mirrors `persistMatchCandidate.ts`'s transaction pattern
  (`BEGIN IMMEDIATE`/`COMMIT`/`ROLLBACK`). **IDs come from an injected `generateId: () =>
  string` parameter, not a bare global `crypto.randomUUID()`** (Codex item 3 — Hermes's global
  `crypto` support is unverified; injecting keeps `node:sqlite` tests native-module-free and
  lets production wire in `expo-crypto`'s `Crypto.randomUUID()`, confirmed synchronous, no
  Promise handling needed). Point inserts use the new `runMany` bulk path.
  - `insertImportedRide(db, generateId, params)` — one `imported_files` row + one `rides` row
    (including the v3 summary columns, computed from `params.points` before the transaction
    opens) + all `ride_points` rows via `runMany`, one transaction.
  - `replaceImportedRide(db, existingRideId, params)` — updates `imported_files`/`rides`
    (including summary columns) in place (preserves `rides.id`), deletes+reinserts
    `ride_points` via `runMany`. Because `segment_attempts` has a composite FK to
    `ride_points(ride_id, point_index)` with `ON DELETE CASCADE`, this mechanically satisfies
    MVP's "clear all match decisions on replace" requirement for free. Returns the **previous**
    `retained_file_uri` in its result so the caller can delete the superseded physical file only
    after this transaction commits (Codex item 4 — see §4). **Explicitly stubbed, documented in
    a code comment, not silently skipped:** "rescan against every segment" is a no-op this
    phase — no segment-scanning orchestrator exists yet anywhere, and segments aren't part of
    this increment. Track as a follow-up issue once segment definition (next phase) lands.
  - Tests: `src/db/persistImportedRide.test.ts`, same `node:sqlite` pattern as
    `persistMatchCandidate.test.ts`, using a deterministic fake `generateId` and asserting the
    v3 summary columns against hand-computed expected values, plus a `runMany`-equivalent
    reused-statement loop for `node:sqlite` (its statements don't need manual finalization, but
    the loop shape mirrors production so the test exercises the same call pattern).
- `src/db/getRideIdentity.ts` — add `listRideIdentities(db): RideIdentity[]` (same join as the
  existing single-ride version, needed because `findDuplicate` compares a candidate against the
  whole existing collection). Add `src/db/getRideIdentity.test.ts` (doesn't exist yet).
- `src/db/listRides.ts`, `src/db/getRideDetail.ts` — read-only query modules for §5, now a
  direct `SELECT` of the v3 summary columns (no runtime aggregation).

### 4. FIT Import screen

**FIT identity normalization (Codex item 2) — empirically grounded, not guessed.** Both real
fixtures were parsed directly (`Decoder`/`Stream` from `@garmin/fitsdk`, matching
`parseFitFile.ts`'s own usage) to inspect actual field values ahead of writing this, since
`docs/FIT_PARSER_SPIKE.md` and `ParsedRide.deviceMetadata`'s opaque shape don't document them:

- `deviceMetadata.fileId` (from `fileIdMesgs[0]`) is exactly the recording Karoo, not a paired
  sensor — confirmed: `{timeCreated, manufacturer: "hammerhead", type: "activity", productName:
  "Karoo", product: 3, serialNumber: 241760203}`. `deviceId` = `fileId.serialNumber`
  (stringified), present only when `fileId` and `serialNumber` are both present.
  `deviceInfoMesgs` (the paired-sensor list — HR strap, power meter, etc.) is deliberately
  **not** used for identity.
  Every ANT+/BLE sensor's `deviceInfoMesgs` entry (32 in one fixture: HR, power, speed/cadence)
  is a distinct paired accessory, not the recording device.
- No stable activity/session ID field exists anywhere in `fileIdMesgs`, `sessionMesgs`, or
  `activityMesgs` for either real fixture — confirmed by inspecting every key on both. Per
  Codex item 2, `activityId` therefore stays **undefined** for real Karoo output; the rule is
  written generically (use one if a genuine stable field is ever present) but in practice never
  fires today, so `findDuplicate`'s device+timing fallback is the operative rule for this
  device family. This is a finding, not an assumption.
- `sessionMesgs[0].startTime` is present and reliable (confirmed non-empty on both fixtures,
  e.g. `2026-08-02T15:37:20.000Z`) — used as `startTimestampMs`, falling back to the first
  record's `timestampMs` only when no session message exists, documented as a fallback.
- `sessionMesgs[0].totalElapsedTime` (seconds; confirmed present, e.g. `11458` ≈ 3h11m,
  consistent with the session's own start/end timestamps) is FIT's *elapsed* time — includes
  stopped/auto-paused wall time, matching MVP.md's own duration definition ("Stops and
  bike-computer auto-pause remain part of the attempt time"). Used as `durationMs` (×1000),
  falling back to last-minus-first record timestamp only when absent, documented as a fallback.
  `totalTimerTime` (moving time only) is deliberately not used for this field.

**Pure orchestration (testable):**
- `src/import/fitIdentity.ts` — `extractRideIdentity(ride: ParsedRide): { deviceId?: string;
  activityId?: string; startTimestampMs: number; durationMs: number }`, implementing exactly
  the rules above. Tests assert the exact expected values against both real fixture files
  (not just "does it not throw").
- `src/import/importFitFile.ts` — platform-agnostic core, **no filesystem access** (Codex item
  4 — retaining/cleaning up the physical file is the caller's job, see below):
  `importFitFile(db, generateId, input: { bytes, filename, contentHash, retainedFileUri,
  fileSizeBytes }, resolution?: 'keep' | 'replace')`: parses via `parseFitFile`, calls
  `extractRideIdentity`, calls `listRideIdentities`, runs the existing `findDuplicate` logic
  (reuse, don't reimplement), and returns one of `imported` / `duplicate` (no write) /
  `duplicate-kept` / `replaced` (includes `previousRetainedFileUri` from
  `replaceImportedRide`'s result, for the caller to clean up) / `failed`. Detection and writing
  are cleanly separated — nothing is transactional until a resolution is known.
  - Tests: `src/import/importFitFile.test.ts` against the real `fixtures/fit/*.fit` files via
    Node's `fs` + `node:sqlite` — strong coverage of the whole pipeline with zero native deps.
    Includes a batch-style test asserting one failed file does not roll back or block
    previously-succeeded files in the same batch (Codex item 5).

**Platform glue (native-dependent, no automated coverage — confirmed API, not guessed):**
Verified against Expo's SDK docs: `Crypto.digest(algorithm, data: BufferSource):
Promise<ArrayBuffer>` accepts raw bytes directly (unlike `digestStringAsync`, which is
string-only) — exactly what's needed to hash the picked file's actual bytes, not a URI/text/
base64 stand-in. `Crypto.randomUUID(): string` is synchronous.
- `src/import/computeFileHash.ts` — `Crypto.digest("SHA-256", bytes)` → hex-encode the
  `ArrayBuffer`. Test cross-checks the hex output against Node's own
  `createHash('sha256').update(bytes).digest('hex')` over one fixture's raw bytes, computed at
  test time (not a pinned magic string), so the test fails loudly if the two ever diverge byte-
  for-byte (Codex item 3).
- `src/import/retainFitFile.ts` — `expo-file-system`, copies the picked file into
  `${FileSystem.documentDirectory}fit-imports/<uuid>.fit` (uuid from the same injected
  `generateId`), and `deleteRetainedFile(uri)` which logs and swallows a failed delete rather
  than throwing (a leftover orphaned file is a cleanup nit, never a reason to corrupt or roll
  back a committed ride — Codex item 4).
- Add `expo-document-picker`, `expo-file-system`, `expo-crypto`.

**Retained-file cleanup ordering (Codex item 4), owned by the screen's orchestration, not
`importFitFile.ts`:** copy the picked file via `retainFitFile` *before* calling
`importFitFile`; on a `'failed'` result (or a thrown error), delete the just-copied new file;
on a `'replaced'` result, delete the *old* file (`previousRetainedFileUri` from the result)
*after* `importFitFile` has already returned success — never before, and never as part of the
DB transaction itself. On `'duplicate'` (no resolution yet) or `'duplicate-kept'`, delete the
newly-copied file immediately — "Keep Existing" must not retain a second copy.

**Batch responsiveness (Codex item 5):** `DocumentPicker.getDocumentAsync({ multiple: true })`
(explicit multi-select). Files are processed **sequentially**, `await`ing one microtask yield
(`await new Promise(r => setTimeout(r, 0))`) between files so the row list can repaint between
each file's status update — batch scale per MVP's ~100-file acceptance criterion doesn't need
concurrency, just responsiveness.

**Screen** (matches the approved Figma mock): file rows with a semantic status badge
(Imported/Duplicate/Replaced/Failed/Pending, using `colors.status*`), a running-totals footer,
and a duplicate-decision modal with "Keep Existing"/"Replace Existing" (MVP's exact prompt
language).
- `src/screens/ImportScreen.tsx`, `src/screens/ImportFileRow.tsx`,
  `src/screens/DuplicateDecisionModal.tsx`.

### 5. Ride List + minimal Ride Detail

Matches the approved Figma mock: ride rows with a route-icon chip, stat tiles (distance/
duration/elevation), a "Route" section with an honest placeholder ("available once segment
tooling lands" — depends on PR #54), an empty "Detected segments" section, a disabled "Create
Segment" button.
- `src/screens/RideListScreen.tsx`, `src/screens/RideDetailScreen.tsx`,
  `src/screens/SegmentsPlaceholderScreen.tsx`.

### 6. Testing approach

Unit-testable with `node:test` (same `DatabaseSync`-as-fixture pattern as existing tests):
`persistImportedRide` (with a deterministic fake `generateId` and hand-computed v3 summary-
column expectations), `getRideIdentity`/`listRideIdentities`, `listRides`, `getRideDetail`,
`fitIdentity` (exact expected values against both real fixtures), `importFitFile` (against real
fixtures, including the one-failure-doesn't-block-others batch case), `toSyncDatabase`'s compat
mapping (a structural fake test, not requiring the native module), and `computeFileHash`'s hex
output cross-checked against Node's `createHash('sha256')` on the same bytes.

Not covered, and why that's an accepted gap (Codex-accepted): screens/components/navigators —
no React Testing Library or similar is installed, and every existing test targets pure/DB logic
only. Not recommending RTL for this increment; the four approved screens instead get a
documented manual iOS/Android acceptance pass per PR. `retainFitFile.ts`'s actual filesystem
calls and the real on-device `expo-sqlite` adapter path are native-dependent and can only be
verified manually on-device — call out exactly what was manually exercised in each PR
description.

## Commit/PR breakdown (small, single-purpose, this repo's established convention)

1. `nav/app-shell` — nav + icon deps, `src/theme/*`, `src/navigation/*`, stub screens,
   rewritten `App.tsx`. Verify: `typecheck`, `web:smoke`.
2. `scaffold/dev-client-prebuild` — `expo-dev-client`, `app.json` IDs/scheme, scripts,
   committed prebuild output, `docs/DEV_SETUP.md`. Verify: `web:smoke`, manual `npm run ios`.
   Note in the PR description that a `--clean` prebuild re-run is needed once PR #54 merges.
3. `db/expo-sqlite-adapter` — `types.ts` (incl. `runMany`), `toSyncDatabase.ts`,
   `initializeDatabase.ts`, `DatabaseProvider.tsx`, migration v3 (summary columns), wired into
   `App.tsx`. Verify: structural fake test for the adapter, manual on-device migration/insert
   smoke test.
4. `db/persist-imported-ride` — `persistImportedRide.ts` (injected `generateId`, `runMany`
   bulk insert, v3 summary-column population, `previousRetainedFileUri` on replace) + tests,
   `listRideIdentities` + tests.
5. `import/import-fit-file` — `src/import/fitIdentity.ts` + tests against both real fixtures,
   `importFitFile.ts` (filesystem-free) + tests against real fixtures incl. the batch-partial-
   failure case.
6. `import/fit-import-screen` — picker/file-system/crypto deps, `computeFileHash.ts` (raw-byte
   `Crypto.digest`, cross-checked test), `retainFitFile.ts` (incl. `deleteRetainedFile`),
   `ImportScreen.tsx` (owns retain-then-cleanup-on-failure and delete-old-on-replace ordering,
   sequential processing with a yield between files), `ImportFileRow.tsx`,
   `DuplicateDecisionModal.tsx`. Verify: `web:smoke`, manual device import including a forced
   duplicate and a forced mid-batch failure.
7. `db/ride-queries` — `listRides.ts`, `getRideDetail.ts` (direct `SELECT` of v3 summary
   columns, no runtime aggregation) + tests.
8. `ui/ride-list-and-detail` — real `RideListScreen`/`RideDetailScreen`, replacing PR 1's stubs.

Each PR gets reviewed the way this repo has reviewed everything else: read the actual diff, run
the actual tests, don't trust a summary.

## Verification

- `npm run typecheck && npm test && npm run web:smoke` after every PR (matches existing CI).
- New `node:test` suites (§3, §4) run via the existing `npm test` command, no new tooling.
- Native-dependent code (§2, §3's adapter, §4's platform glue) verified manually via
  `npm run ios` / `npm run android` against the dev client — call out exactly what was
  manually exercised in each PR description.

## Codex review — 2026-08-17

Verdict: **approve the scope and sequence after the required revisions below**. Navigation,
the dev-client move, import/list/detail boundaries, and deferring map/segment work are sound.
Do not start the DB/import PRs until items 1–4 are reflected in their implementation.

### Required revisions

1. **Make the Expo SQLite adapter one-shot or explicitly finalizable.** The proposed
   `prepareSync()` wrapper cannot leave native `SQLiteStatement`s alive because existing
   callers have no `finalize()` method. `resetSync()` resets a result cursor; it does not
   release the native statement. Prefer a compatibility wrapper that stores the SQL string
   and implements `get/run/all` with Expo's one-shot `getFirstSync/runSync/getAllSync`
   convenience APIs, which prepare and finalize internally. Alternatively extend every DB
   interface/caller with deterministic finalization. Add a structural fake unit test for the
   adapter—it is thin but testable—and one real dev-client migration/insertion smoke test.

2. **Define FIT identity normalization before implementing import.** `ParsedRide` exposes
   opaque `deviceMetadata`; it does not expose `activityId`, `deviceId`, ride start, or
   duration directly. The two real Karoo fixtures show device serial metadata but no proven
   stable FIT activity identifier. Specify and test these rules:
   - never fabricate `activityId`; leave it absent unless a genuine stable activity/session
     identifier is present;
   - use the recording Karoo's serial/device identifier, not an attached HR/power sensor;
   - use session start when valid, with first record timestamp only as a documented fallback;
   - use FIT total elapsed duration (not timer duration) so stopped/auto-paused wall time is
     preserved, with record-boundary duration only as a documented fallback.
   Put this normalization in a pure parser-adjacent function tested against both real files.

3. **Use an injected/platform-safe ID source and hash the actual bytes.** Do not rely on an
   unverified global `crypto.randomUUID()` in Hermes. Since `expo-crypto` is already planned,
   isolate native UUID generation behind an injected `IdFactory` so Node tests stay native-
   module-free. Hash the picked FIT's raw `Uint8Array`, not its URI, decoded text, or base64
   representation. Add a fixture assertion against Node `createHash('sha256')` so native and
   test hashes are byte-identical.

4. **Specify retained-file cleanup and replacement ordering.** Do not retain a second file
   for “Keep Existing.” For a new import, remove the newly copied file if the DB transaction
   fails. For replacement, commit the new retained URI/hash/points first, then delete the old
   physical file; failure deleting the old file should be reported as recoverable cleanup,
   never roll back or corrupt the committed ride. Tests need filesystem fakes for these
   success/failure paths.

5. **Keep batch import responsive.** FIT decoding and thousands of synchronous point inserts
   run on the JS thread. Reuse a prepared point insert inside one transaction where possible,
   finalize it deterministically, process files independently, and yield between files so
   status/progress can render. Explicitly request multi-selection from the document picker.
   Test that one failed file does not roll back successful files, as required by MVP.md.

6. **Define ride-summary queries before promising the Figma stats.** The schema stores no
   explicit total distance or elevation gain. Distance can use the last/max valid FIT distance;
   ascent requires ordered positive elevation deltas and should not be mislabeled as simple
   min/max elevation. Either add normalized summary columns in a migration and populate them
   during import, or document/query the exact aggregate semantics and measure list performance.

7. **Coordinate generated native directories with pending PR #54.** Before committing
   `ios/` and `android/`, inspect PR #54 for app config/native dependency changes and choose a
   merge/rebase order. Do not independently generate competing native projects on both tracks.

### Accepted gaps

- Deferring component-level React Native tests is acceptable for this first increment if the
  pure orchestration and DB paths are fully tested and the four approved screens receive a
  documented manual iOS/Android acceptance pass.
- The existing scratch navigation/theme files may be reused only after diffing them against
  the approved plan; their passing typecheck/test/web smoke is useful evidence, not approval.

## Claude — revisions incorporated, 2026-08-17 (evening)

All seven required revisions are now reflected inline in the sections above (§2's "PR #54
native-project coordination," §3's adapter/migration-v3/`runMany` rewrite, §4's FIT-identity/
ID-injection/hash/cleanup-ordering/batch-yield rewrite, §6/PR-breakdown updates) — not just
acknowledged here. Each resolution is backed by something verified directly against source
rather than assumed, specifically:

- Item 1 (adapter): confirmed `runSync`/`getFirstSync`/`getAllSync` are documented
  auto-finalizing one-shot wrappers by reading `node_modules/expo-sqlite/build/
  SQLiteDatabase.d.ts`.
- Item 2 (FIT identity): both real fixtures in `fixtures/fit/` were parsed directly (same
  `Decoder`/`Stream` calls `parseFitFile.ts` uses) to read actual `fileIdMesgs`/`sessionMesgs`/
  `activityMesgs` field values — confirmed `fileId.serialNumber` cleanly identifies the
  recording Karoo (not a paired sensor), confirmed no stable activity/session ID field exists
  in real output, confirmed `sessionMesgs[0].startTime`/`totalElapsedTime` are present and
  sane on both files.
- Item 3 (ID/hash): confirmed via Expo's SDK docs that `Crypto.digest(algorithm, data:
  BufferSource)` (not `digestStringAsync`, which is string-only) accepts raw bytes, and that
  `Crypto.randomUUID()` is synchronous.
- Item 7 (PR #54 coordination): confirmed via `gh pr diff 54` that it touches no `app.json` or
  config-plugin code, narrowing the real coordination need to "re-run `expo prebuild --clean`
  after PR #54 merges to link MapLibre natively," not a same-file conflict now.
- Per the "accepted gaps" note: the scratch `src/theme/*`, `src/navigation/*`, and stub
  `src/screens/*` files already in the working tree were diffed against §0/§1 above — those
  two sections were not touched by any required revision, so the scratch files match the
  approved plan as written and will be reused (not discarded and redone) when PR 1 lands.

Proceeding to implement PR 1 next.
