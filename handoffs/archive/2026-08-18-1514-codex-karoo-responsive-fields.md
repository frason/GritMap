# Handoff: Karoo graphical fields now respond to page size

- Updated: `2026-08-18 15:14 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `9a1d33d apps/karoo: adapt graphical fields to page size`
- Worktree: `clean before this handoff update`

## Outcome

The three graphical Karoo data fields now adapt their semantic content to the configured field
height instead of clipping a full-size layout into every page slot. Stable data type IDs are
unchanged. Standard numeric fields continue to use Karoo's own responsive numeric renderer.

## Changed

- `9a1d33d apps/karoo: adapt graphical fields to page size`
- Added `KarooFieldSize` classification using Karoo's 60-row grid: small <=15 rows, medium 16–29,
  and large >=30.
- Pacing Coach: small shows action/target; medium adds actual power/delta; large adds next zone.
- Pacing Profile: small shows segment/progress/guidance without a squeezed graph; medium gives
  most of the available height to the graph; large shows all text plus the full graph.
- Segment Performance: small shows predicted finish; medium adds adherence; large shows segment
  name, finish, adherence, and progress.
- Added boundary tests for all three size classes.
- Bumped APK to versionName `0.5.0`, versionCode `7`.

## Verified

- First compile caught and reported a Kotlin visibility error in the new enum; it was corrected.
- Reran `env JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ./gradlew
  --no-daemon -Pkotlin.compiler.execution.strategy=in-process :app:testDebugUnitTest
  :app:assembleDebug` from `apps/karoo`: `BUILD SUCCESSFUL in 1m 24s`.
- Installed the resulting APK in place using `adb install -r`: `Success`.

## External state

- Physical Karoo `00442GA241760203` has version `0.5.0`/versionCode `7` installed. Application
  data was retained.

## Hazards and blockers

- Exact thresholds are based on Karoo's documented 60-row grid and need visual confirmation on
  the physical page combinations the user prefers.
- Predicted Finish remains a standard numeric field; its editor preview is controlled by Karoo.

## Next safe action

Open the Karoo page editor and place each graphical field in small, medium, and large slots to
visually confirm the content hierarchy and tune the 15/30-row boundaries if necessary.
