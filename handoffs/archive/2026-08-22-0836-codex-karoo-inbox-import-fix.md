# Handoff: Karoo JSON import button repaired with inbox-first routing

- Updated: `2026-08-22 08:36 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `7b6ea68 docs: hand off segment-definition increment completion (closes #6, #7)`
- Worktree: uncommitted Karoo work from multiple prior milestones plus Relize converter/sample/guidance package and MainActivity import routing fixes.

## Outcome

The connected Karoo reproduced the reported failure: tapping **Import segment JSON** launched no Android activity and logged no crash or exception. Karoo resolves an `ACTION_OPEN_DOCUMENT` handler even though no usable picker UI opens. GritMap now processes its reliable app-specific staged inbox first and only attempts the picker when the inbox is empty.

## Changed

- Updated `apps/karoo/app/src/main/java/com/gritmap/karoo/MainActivity.kt`:
  - Import button immediately shows `Checking GritMap import inbox…`.
  - Processes both `imports/packages` and `imports/segments` before consulting the picker.
  - Refreshes the segment library and reports imported, duplicate, and failed counts.
  - Uses the document picker only when both inboxes contain no work.
  - Selected transfer packages are still routed through `TransferPackageRepository`; plain segments use `SegmentImportRepository`.
- The existing `apps/karoo/samples/Relize.6m54.guidance-package.json` remains the staged package: FTP 285 W, 92.53 kg, target 414 seconds, and contiguous 270/280/300 W zones.

## Verified

- Before the fix, captured device activity state and logcat during a controlled tap. MainActivity remained resumed; no picker activity started; no fatal exception occurred.
- Ran from `apps/karoo/`:
  `JAVA_HOME=/opt/homebrew/Cellar/openjdk@17/17.0.20/libexec/openjdk.jdk/Contents/Home ./gradlew --no-daemon :app:testDebugUnitTest :app:assembleDebug`
- Result: `BUILD SUCCESSFUL in 1m 20s`; JVM tests passed and debug APK assembled. The known SDK XML warning remained non-fatal.
- Confirmed installed package remains versionName `0.8.1`, versionCode `12`.
- Confirmed the Relize package exists at `/sdcard/Android/data/com.gritmap.karoo/files/imports/packages/Relize.6m54.guidance-package.json`.
- Did not trigger the final import automatically because the package's full rider-history snapshot contains empty history arrays and import would clear any currently stored history.

## External state

- Connected Karoo `00442GA241760203` has the verified repaired APK installed with app data preserved.
- GritMap MainActivity was force-stopped and relaunched.
- Relize guidance is in the app-specific pending inbox, not merely Downloads.
- Existing processed inbox contains `Coco_Jumbo.segment.json`.

## Hazards and blockers

- Importing the Relize guidance package replaces the installed rider profile and clears stored training-load/historical-attempt samples before inserting empty arrays. The user was warned previously; automatic import was intentionally not performed.
- Version name/code were not bumped, so this behavioral fix still reports 0.8.1 (12).
- The working tree contains substantial pre-existing uncommitted Karoo UI, cardiac-drift, telemetry, tests, and handoff work. Do not discard or wholesale-replace those files.
- The 6:54 value is plan target guidance, not yet a formal historical personal-record entity.

## Next safe action

On the already-open Karoo app, tap **Import segment JSON** once. It should now process the staged inbox and display an explicit imported/duplicate/failed result instead of silently attempting the unavailable picker.

