# Handoff: Relize 6:54 baseline guidance staged on Karoo

- Updated: `2026-08-22 08:18 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `7b6ea68 docs: hand off segment-definition increment completion (closes #6, #7)`
- Worktree: uncommitted Karoo work from multiple prior milestones plus Relize converter/sample/package and a narrow MainActivity transfer-routing change.

## Outcome

A rider-specific Relize guidance package is ready for import with FTP 285 W, weight 204 lb converted to 92.53 kg, and target finish time 6:54 (414 seconds). The package contains the immutable Relize segment, rider profile, and a safe manually generated terrain-aware baseline plan. The connected Karoo has the verified APK that can route transfer packages selected through the document picker.

## Changed

- Added `apps/karoo/samples/Relize.6m54.guidance-package.json`.
- Baseline zones are contiguous over the complete 1,906.726 m segment: 270 W Hold for 0–600 m, 280 W Hold for 600–1,400 m, and 300 W Push for the steep final 506.726 m.
- Added target finish time `414` seconds to the baseline plan. This is guidance and a comparison target, not a claim that the baseline wattages mathematically guarantee 6:54 without historical power/speed response data.
- Added rider profile FTP 285 W and weight 92.53 kg to the atomic transfer package; training-load/history arrays are empty.
- Updated `apps/karoo/app/src/main/java/com/gritmap/karoo/MainActivity.kt` so document-picker JSON dispatches `packageType: gritmap-transfer` through `TransferPackageRepository`; plain segment JSON still uses `SegmentImportRepository`.

## Verified

- Generated canonical segment fingerprint `22e204bc652cd9ae30e4d1db10ce4789b516fc67d7ea0d900448029416bea78b`.
- Parsed the package with `python3 -m json.tool` and asserted FTP, target time, profile conversion, full contiguous plan coverage, 150%-FTP safety bound, and maximum 100 W transitions.
- Ran from `apps/karoo/` with Homebrew JDK 17:
  `JAVA_HOME=/opt/homebrew/Cellar/openjdk@17/17.0.20/libexec/openjdk.jdk/Contents/Home ./gradlew --no-daemon :app:testDebugUnitTest :app:assembleDebug`
- Result: `BUILD SUCCESSFUL`; JVM tests passed and debug APK assembled. The known SDK XML v3/v4 warning remained non-fatal.

## External state

- Installed the verified debug APK onto connected Karoo `00442GA241760203` with `adb install -r`, preserving app data.
- Copied `Relize.6m54.guidance-package.json` to `/sdcard/Download/`.
- Force-stopped and relaunched `com.gritmap.karoo/.MainActivity`.
- The package is staged but not yet imported; the user must select it through **Import segment JSON**.

## Hazards and blockers

- Importing the included rider-history object replaces the current rider profile and clears previously stored training-load summaries and historical attempt samples before inserting the package's empty arrays. This is consistent with the current full-snapshot rider-history contract, but would discard meaningful imported history if any exists.
- The working tree contains substantial pre-existing uncommitted Karoo UI, cardiac-drift, telemetry, tests, and handoff work. Do not discard or wholesale-replace those files.
- The 6:54 value is currently represented as plan target guidance, not a formal historical personal-record record; the history schema has no attempt duration field.
- The baseline is FTP/terrain based. Full personalization still needs historical distance-keyed sensor curves or live Needle adaptation.

## Next safe action

If replacing the currently installed rider profile/history snapshot is acceptable, tap **Import segment JSON** on the Karoo and choose **Downloads → Relize.6m54.guidance-package.json**. Confirm the Relize library row says **baseline plan**.

