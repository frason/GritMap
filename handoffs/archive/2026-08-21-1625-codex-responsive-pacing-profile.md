# Handoff: Responsive Pacing Profile and native Watts/HR verified

- Updated: `2026-08-21 16:25 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `7b6ea68 docs: hand off segment-definition increment completion (closes #6, #7)`
- Worktree: uncommitted Karoo work; this milestone overlaps the existing uncommitted cardiac-drift and authoritative-telemetry changes. Root Expo work is not touched by this milestone.

## Outcome

The Karoo Pacing Profile now uses a geometry-aware six-layout model instead of deciding only from row height. Compact cells show an immediate pacing target plus a colored zone/progress strip; medium-wide, narrow, and large cells retain the elevation profile with progressively richer guidance. Watts/HR is now a native numeric Karoo field even though GritMap calculates it.

## Changed

- Added `apps/karoo/app/src/main/java/com/gritmap/karoo/karoo/KarooFieldLayout.kt` with `SMALL`, `SMALL_WIDE`, `MEDIUM`, `MEDIUM_WIDE`, `LARGE`, and `NARROW` classifications using grid width plus actual pixel height.
- Updated `LivePacingDataType.kt` with an explicit semantic presentation for every layout. The new classifier is scoped to Pacing Profile; the other visual fields still use their existing three-size behavior.
- Updated `ProfileBitmapRenderer.kt` with a compact pacing-zone strip renderer. Compact fields intentionally omit the elevation curve rather than making it unreadable.
- Added `KarooFieldLayoutTest.kt` for geometry boundaries and compact/large profile semantics.
- Moved `WattsPerHeartRateDataType` into `AdditionalNumericDataTypes.kt`, changed its extension declaration to `graphical="false"`, and deleted `karoo_watts_per_hr_field.xml`. It streams the calculated ratio through Karoo's native numeric treatment using the intensity-factor formatter for decimal precision; the `GM W/HR` field name supplies the meaning because karoo-ext has no custom numeric-unit API.
- Added a native Watts/HR stream assertion to `CombinedDataTypesTest.kt`.
- Design decision recorded in conversation: add trend direction only where actual history supports change over time (Watts/HR, cardiac drift, predicted finish, and possibly adherence), not as a synonym for current target deviation.

## Verified

- Ran from `apps/karoo/` with Homebrew JDK 17:
  `JAVA_HOME=/opt/homebrew/Cellar/openjdk@17/17.0.20/libexec/openjdk.jdk/Contents/Home ./gradlew :app:testDebugUnitTest :app:assembleDebug`
- Final result: `BUILD SUCCESSFUL`; all JVM tests passed and the debug APK assembled.
- The Android SDK XML v3/v4 mismatch warning still appears and did not fail the build.
- No device install or on-Karoo layout inspection was performed in this milestone.

## External state

- Last confirmed device install remains Karoo 0.8.0/versionCode 11 from `handoffs/archive/2026-08-20-0920-codex-karoo-v05-test-captured-v08-installed.md`.
- This newly assembled APK has not been installed.
- Earlier root-app segment-definition work remains documented in commit `7b6ea68`; that work was not modified here.

## Hazards and blockers

- The working tree already contained uncommitted cardiac-drift and authoritative-telemetry work. Some shared files such as `CombinedDataTypes.kt`, `karoo_extension_info.xml`, and tests contain both that earlier work and this milestone; do not discard or wholesale-replace them.
- Native Watts/HR decimal precision and label appearance compile correctly but must be confirmed in the Karoo page editor and in-ride. If Karoo attaches an unwanted intensity-factor suffix, retain the native field but select another existing unitless decimal formatter after device inspection.
- Karoo can temporarily shrink fields for navigation toasts without sending a new `ViewConfig`; the layouts still need real-device shrink testing.
- Trend direction is not implemented yet because the relevant time-series contracts need to be chosen field by field.

## Next safe action

Install the assembled debug APK on the connected Karoo when available, then add GM Pacing Profile to representative small, small-wide, medium, medium-wide, narrow, and large page cells in preview mode. Capture one image of each geometry and confirm the native GM W/HR label/value formatting before applying this responsive system to Pacing Coach.
