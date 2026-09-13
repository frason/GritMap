# Handoff: Diablo 40:30 pacing plan built, installed, and verified on the real Karoo

- Updated: `2026-09-12 21:11 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `2e5ad15 karoo: guidance-package builder tool + Diablo/Relize fixtures`
- Worktree: this milestone landed from a sandboxed worktree session, committed directly to
  `main` in the primary checkout at `/Users/frason/Developer/GritMap`.

## Outcome

Codex's 2026-09-12-1140 handoff's "next safe action" is done: the phone-selected "Diablo
Northgate to Junction" segment's exact JSON was exported, bound to the trainer-authored 40:30
plan, and the resulting guidance package was sent to and verified on the user's real,
USB-connected Karoo -- not just built, but confirmed present in the Karoo's own on-device
Room database. The user rides this segment tomorrow (2026-09-13).

## Changed

- Two commits on `main`, both pushed:
  - `e9e0a7c karoo: consume baseline pacing plans + W' balance and cardiac drift tracking` --
    committed a large batch of Codex's previously-uncommitted Kotlin work (with the user's
    explicit go-ahead): `LiveSegmentCoordinator.kt` now actually reads a segment's imported
    `PacingZoneEntity` rows and uses them for live `pacingZones`/`recommendation`, falling
    back to the flat provisional (95% FTP) plan only when no baseline zones exist -- this
    exact gap was flagged as unconsumed in
    `handoffs/archive/2026-08-22-1439-codex-relize-real-ride-verified.md`. Also includes
    `WPrimeEngine.kt`, `CardiacDriftTracker.kt`, and their bitmap-rendered live fields
    (`PowerBalanceBitmapRenderer`, `CardiacDriftBitmapRenderer`,
    `SegmentPerformanceBitmapRenderer`, `KarooFieldLayout`, `KarooVisualPalette`) plus all
    their matching test files. `./gradlew :app:testDebugUnitTest` -- 95/95 passing (required
    installing a JDK 17 via Homebrew first; only a JBR 21 was present, and Gradle's toolchain
    config demands exactly 17, no auto-provisioning configured).
  - `2e5ad15 karoo: guidance-package builder tool + Diablo/Relize fixtures` -- committed
    Codex's pre-existing `apps/karoo/tools/build_guidance_package.mjs` (+ its test +
    `gpx_to_segment.py`) and fixtures (`Relize.segment.json`,
    `Relize.6m54.guidance-package.json`, `Diablo.Northgate-to-Junction.40m30.plan.json`),
    plus two new files this session produced: `Diablo.Northgate-to-Junction.segment.json`
    (the real exported segment, 1046 points) and
    `Diablo.Northgate-to-Junction.40m30.guidance-package.json` (the built transfer package).
    Committed with the user's explicit permission (real personal GPS route data in a public
    repo, same precedent as `fixtures/fit/`/`fixtures/gpx/`).

## How the phone-side export was actually done

The phone app has no dedicated "export segment JSON to a file" feature, and building one
under time pressure wasn't necessary: the existing "Send to Karoo" UI on
`SegmentDetailScreen.tsx` already calls `toPortableSegmentJson()` (verified byte-for-byte
against Karoo's `SegmentJsonParser.parse()`) and POSTs it to `http://{host}:{port}/transfer`.
A throwaway Node HTTP server (`/tmp/capture_segment_server.mjs`, not committed -- it's a
one-off, not project infrastructure) was run on the dev Mac; the user pointed the existing
"Send to Karoo" field at the Mac's LAN address instead of the Karoo's, and the real POST body
was captured verbatim. This reused 100% already-tested phone-side code with zero new app
code. If a repeatable export feature is ever wanted, this is the natural seam to build it at.

## Verified

- Exported segment matches expectations: 1046 points, 10442.52m (6.49mi, matching the plan's
  "6.48 source miles" almost exactly), fingerprint
  `17779c8b14fbe84126712e79982a870d82433a37d7c7193f3af4bbb2b5dc530c`.
- `node apps/karoo/tools/build_guidance_package.mjs` ran clean: "26 zones, 2430s target".
- `node --test apps/karoo/tools/build_guidance_package.test.mjs` -- 2/2 passing.
- Guidance package structure inspected directly: `packageType: "gritmap-transfer"` (matches
  `TransferPackageParser.PACKAGE_TYPE` exactly), segment fingerprint matches the exported
  segment's own fingerprint, 26 zones with correct HOLD/PUSH classifications (both valid
  `Effort`/`GuidanceIcon` enum values).
- Built and installed a fresh debug APK on the real, USB-connected Karoo (`adb install -r`).
  Confirmed via dex string search (`baselineZones`, `getBaselineZones`,
  `LiveSegmentCoordinator$discover$2$baselineZones$1` all present in `classes9.dex`) that the
  installed build actually contains the baseline-plan-consumption fix, not a stale APK.
  `./gradlew :app:assembleDebug` reported `packageDebug UP-TO-DATE`, meaning this exact
  source has been sitting compiled-but-uncommitted since roughly 2026-08-25 -- now committed.
- Sent the guidance package to the Karoo's armed `HttpSegmentInbox` receiver via `curl POST
  http://192.168.7.67:8734/transfer` -- got `200 OK`.
- **Pulled the Karoo's real on-device Room database via `adb ... run-as com.gritmap.karoo cat
  databases/gritmap-karoo.db{,-wal,-shm}` and queried it directly** (not just trusting the
  app's status-text UI, which showed an ambiguous "Received Phone transfer" that didn't match
  any of the three expected status-string formats in `MainActivity.kt`):
  - `segments` table: `Diablo Northgate to Junction` present with the exact expected id.
  - `pacing_plans`: `targetFinishTimeSeconds=2430`, `ftpWatts=280`, correct segment fingerprint.
  - `pacing_zones`: exactly 26 rows; first zone `0.0-402.875m @ 265W HOLD`, last zone
    `10071.878-10442.52m @ 295W PUSH` -- both match the source plan exactly.
  - `rider_profiles`: FTP 280W, weight 92.53kg, max HR 178bpm.
  - `segment_reference_points`: exactly 1046 rows for this segment.
- User independently confirmed on the Karoo's own segment library screen: "i see diablo north
  gate now".
- **Zone-lookup logic verified against the real data across the whole route** (not a live
  ride, but the exact same comparison `uiState()` performs, replicated in a throwaway Python
  script against the real pulled DB rows): zones are fully contiguous (no gaps/overlaps, first
  starts at 0.0, last ends at 10442.523162762402 matching the segment's own total distance
  exactly), and every 500m checkpoint from 0 to 10000m resolves to exactly one zone with a
  sane, monotonically-sensible power progression (265W at the start through 279W around 8km,
  switching HOLD->PUSH right at the mile-5 mark as the plan specifies, up to 292W near the
  top).
- A true real-ride verification of this exact plan was NOT performed (no time before this
  handoff) -- see Hazards.

## External state

- The real, physical Karoo (USB-connected during this session, `adb` device id
  `00442GA241760203`, WiFi IP `192.168.7.67` on the same LAN as the dev Mac) now has:
  - A freshly built and installed debug APK containing today's `e9e0a7c` fix.
  - "Diablo Northgate to Junction" in its segment library, confirmed both via direct DB query
    and by the user looking at the screen themselves.
  - The full 40:30/26-zone baseline pacing plan and rider profile (280W FTP, 92.53kg, 178bpm
    max HR) attached to that segment.
- All 9 Karoo data field types (`GM Pacing Coach`, `GM Target Power`, `GM Power Delta`,
  `GM Predicted Finish`, `GM Pacing Profile`, `GM Segment Performance`, `GM Watts/HR`,
  `GM Power Balance`, `GM Cardiac Drift`) are registered in `GritMapKarooExtension.kt` and
  present in this same installed build. The user has not yet confirmed which of these are
  actually added to their real ride profile screen on the Karoo -- that's a manual
  Karoo-side step (Profiles -> edit ride profile -> add data field) not something this
  session could do remotely.
- `git push` succeeded for both commits; `origin/main` is up to date as of this handoff.

## Hazards and blockers

- **No real-ride verification of the baseline-plan-consumption fix.** The fix passed 95/95
  unit tests, and this session did an unusually thorough data-level check (real DB rows,
  zone-contiguity math replicated against the actual production lookup logic), but nothing
  has exercised the live `KarooSystemService`/`OnLocationChanged` GPS-streaming path against
  this exact segment+plan pairing end-to-end. The underlying GPS-matching mechanism itself
  (`DirectedLiveMatcher`/candidate discovery) was real-ride-verified before (on a different
  segment, "Relize", see `2026-08-22-1439-codex-relize-real-ride-verified.md`) -- only the
  *zone-selection* logic on top of it is new and untested live. Recommended before tomorrow:
  a short real-world ride/roll through the start of the actual route with the Karoo
  recording, confirming the on-screen power target changes as expected (not stuck on one
  flat number).
- Android mock-location tooling (`adb shell` GPS injection) does **not** work for testing this
  live pipeline -- confirmed by reading the code: `LiveSegmentService` sources location from
  `KarooSystemService`'s `OnLocationChanged` (Karoo's own proprietary extension SDK), not
  Android's standard `LocationManager`. The app's own "Start data-field demo" button also
  doesn't exercise this path -- it's a fully synthetic, hardcoded 600m "GM Demo Climb" that
  calls `LiveUiStore.publish()` directly, bypassing `LiveSegmentCoordinator` entirely.
- Writing a proper `LiveSegmentCoordinator` JVM/Robolectric test (Room is already a dependency,
  Robolectric is already a test dependency, but no existing test constructs a real in-memory
  Room `KarooDatabase` -- every existing test avoids it) was considered and deliberately
  deferred as too large/risky to attempt correctly under this session's time pressure. Worth
  doing properly as a real follow-up, independent of tomorrow's ride.
- The capture-server workaround (`/tmp/capture_segment_server.mjs`) was a one-off, not
  committed, not project infrastructure. If phone-side segment export becomes a recurring
  need (not just tonight's emergency), it deserves a real, in-app feature -- see the "How the
  phone-side export was actually done" section above for the natural seam.
- `WattsPerHeartRateDataType` is still registered in `GritMapKarooExtension.kt` and
  `karoo_extension_info.xml`, but its dedicated layout (`karoo_watts_per_hr_field.xml`) was
  deleted in the `e9e0a7c` commit as part of Codex's uncommitted batch. This did **not** break
  the build (confirmed: `graphical="false"` for this field in the extension manifest, meaning
  it never used a custom layout to begin with) -- flagged here only because it looked
  suspicious at first glance and is worth knowing if that field's rendering ever seems off.
- This session made an earlier, separate mistake unrelated to Diablo: a half-finished `git mv`
  (`importFitFile.ts` -> `importRideFile.ts`, for issue #59/GPX import) was left broken in this
  same primary checkout before the mistake was caught and fixed. Unrelated to tonight's Karoo
  work, but worth knowing this checkout had a brief broken window earlier today if anything
  seems inconsistent from before ~18:00 PDT.

## Next safe action

1. **Before tomorrow's ride**, if there's any window at all: a short real-world test (even
   just the first few hundred meters of the actual route) with the Karoo recording, to
   directly confirm live guidance shows the real 265W-start / 295W-finish progression rather
   than a flat fallback number. This is the one thing genuinely unverified end-to-end.
2. Confirm which of the 9 `GM *` data fields are actually added to the rider's real Karoo ride
   profile screen (a manual on-device step, not something remote tooling can do).
3. Independent of tomorrow: build a proper phone-side "export segment" feature (or at least a
   dev-only debug affordance) so future Karoo-transfer debugging doesn't need an ad hoc
   capture-server workaround.
4. Independent of tomorrow: a real `LiveSegmentCoordinator` test harness (Robolectric +
   in-memory Room `KarooDatabase`) would close the gap flagged in Hazards -- no existing test
   touches this class at all.
5. GritMap phone-app backlog (#58 segment-editing UX, #59 GPX import) both have open PRs
   (#65, #64) still awaiting the user's on-device review -- untouched by tonight's work.
