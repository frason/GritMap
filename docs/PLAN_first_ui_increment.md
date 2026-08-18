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

### 3. DB plumbing: adapter + write-path modules

- `src/db/types.ts` — shared `SyncDatabase` interface (superset of the existing
  `MigrationDatabase`/`MatchPersistenceDatabase` shapes).
- `src/db/toSyncDatabase.ts` — adapts real `expo-sqlite` `SQLiteDatabase` → `SyncDatabase`
  (`exec` → `execSync`; `prepare().get/run/all` → `prepareSync().executeSync()` →
  `getFirstSync()`/`getAllSync()`/result fields, with `resetSync()` between calls). Not
  unit-testable (native-only) — kept deliberately thin so everything else stays testable
  against `node:sqlite`, matching the existing pattern in `migrations.test.ts`.
- `src/db/initializeDatabase.ts` + `src/db/DatabaseProvider.tsx` — connect → adapt → migrate →
  expose via `useDatabase()`; renders a minimal fatal-error screen on migration failure instead
  of crashing blank.
- `src/db/persistImportedRide.ts` — mirrors `persistMatchCandidate.ts`'s transaction pattern
  (`BEGIN IMMEDIATE`/`COMMIT`/`ROLLBACK`, `crypto.randomUUID()` for IDs — global in both Hermes
  and Node, no new dependency):
  - `insertImportedRide(db, params)` — one `imported_files` row + one `rides` row + all
    `ride_points` rows, one transaction.
  - `replaceImportedRide(db, existingRideId, params)` — updates `imported_files`/`rides` in
    place (preserves `rides.id`), deletes+reinserts `ride_points`. Because
    `segment_attempts` has a composite FK to `ride_points(ride_id, point_index)` with
    `ON DELETE CASCADE`, this mechanically satisfies MVP's "clear all match decisions on
    replace" requirement for free. **Explicitly stubbed, documented in a code comment, not
    silently skipped:** "rescan against every segment" is a no-op this phase — no
    segment-scanning orchestrator exists yet anywhere, and segments aren't part of this
    increment. Track as a follow-up issue once segment definition (next phase) lands.
  - Tests: `src/db/persistImportedRide.test.ts`, same `node:sqlite` pattern as
    `persistMatchCandidate.test.ts`.
- `src/db/getRideIdentity.ts` — add `listRideIdentities(db): RideIdentity[]` (same join as the
  existing single-ride version, needed because `findDuplicate` compares a candidate against the
  whole existing collection). Add `src/db/getRideIdentity.test.ts` (doesn't exist yet).
- `src/db/listRides.ts`, `src/db/getRideDetail.ts` — read-only query modules for §5.

### 4. FIT Import screen

**Pure orchestration (testable):**
- `src/import/importFitFile.ts` — platform-agnostic core:
  `buildCandidateIdentity(parsedRide, contentHash)` (pure extraction — verify against the real
  fixtures in `fixtures/fit/*.fit` and `docs/FIT_PARSER_SPIKE.md` for which fields Karoo
  reliably populates for `activityId`/`deviceId`) and
  `importFitFile(db, input, resolution?: 'keep' | 'replace')`: parses via `parseFitFile`, calls
  `listRideIdentities`, runs the existing `findDuplicate` logic (reuse, don't reimplement), and
  returns one of `imported` / `duplicate` (no write) / `duplicate-kept` / `replaced` / `failed`.
  Detection and writing are cleanly separated — nothing is transactional until a resolution is
  known.
  - Tests: `src/import/importFitFile.test.ts` against the real `fixtures/fit/*.fit` files via
    Node's `fs` + `node:sqlite` — strong coverage of the whole pipeline with zero native deps.

**Platform glue (native-dependent, no automated coverage):**
- `src/import/computeFileHash.ts` — `expo-crypto` SHA-256 of raw FIT bytes.
- `src/import/retainFitFile.ts` — `expo-file-system`, copies the picked file into
  `${FileSystem.documentDirectory}fit-imports/<uuid>.fit`.
- Add `expo-document-picker`, `expo-file-system`, `expo-crypto`.

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
`persistImportedRide`, `getRideIdentity`/`listRideIdentities`, `listRides`, `getRideDetail`,
`importFitFile` (against real fixtures).

Not covered, and why that's an accepted gap: screens/components/navigators — no React Testing
Library or similar is installed, and every existing test targets pure/DB logic only. Not
recommending RTL for this increment. `toSyncDatabase.ts`, `computeFileHash.ts`,
`retainFitFile.ts` are native-dependent and can only be verified manually on-device.

## Commit/PR breakdown (small, single-purpose, this repo's established convention)

1. `nav/app-shell` — nav + icon deps, `src/theme/*`, `src/navigation/*`, stub screens,
   rewritten `App.tsx`. Verify: `typecheck`, `web:smoke`.
2. `scaffold/dev-client-prebuild` — `expo-dev-client`, `app.json` IDs/scheme, scripts,
   committed prebuild output, `docs/DEV_SETUP.md`. Verify: `web:smoke`, manual `npm run ios`.
3. `db/expo-sqlite-adapter` — `types.ts`, `toSyncDatabase.ts`, `initializeDatabase.ts`,
   `DatabaseProvider.tsx`, wired into `App.tsx`. Verify: manual (migrations run on-device).
4. `db/persist-imported-ride` — `persistImportedRide.ts` + tests, `listRideIdentities` + tests.
5. `import/import-fit-file` — `importFitFile.ts` + tests against real fixtures.
6. `import/fit-import-screen` — picker/file-system/crypto deps, `computeFileHash.ts`,
   `retainFitFile.ts`, `ImportScreen.tsx`, `ImportFileRow.tsx`, `DuplicateDecisionModal.tsx`.
   Verify: `web:smoke`, manual device import including a forced duplicate.
7. `db/ride-queries` — `listRides.ts`, `getRideDetail.ts` + tests.
8. `ui/ride-list-and-detail` — real `RideListScreen`/`RideDetailScreen`, replacing PR 1's stubs.

Each PR gets reviewed the way this repo has reviewed everything else: read the actual diff, run
the actual tests, don't trust a summary.

## Verification

- `npm run typecheck && npm test && npm run web:smoke` after every PR (matches existing CI).
- New `node:test` suites (§3, §4) run via the existing `npm test` command, no new tooling.
- Native-dependent code (§2, §3's adapter, §4's platform glue) verified manually via
  `npm run ios` / `npm run android` against the dev client — call out exactly what was
  manually exercised in each PR description.
