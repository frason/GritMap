# Handoff: Polar H10 cardiac-stability field installed on Karoo

- Updated: `2026-10-08 10:35 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `9b5f594 feat: import a portable segment JSON file on the phone`
- Worktree: `uncommitted; broad pre-existing phone/Karoo work plus the H10 field files below`

## Outcome

Karoo build 0.10.42/code65 adds a separate `GM H10 Cardiac` graphical field. It uses the
Polar H10 beat-to-beat RR stream to compute an experimental DFA alpha-1 signal from an
approximately two-minute clean window, shows RMSSD and RR validity as supporting context, and
renders large and compact preview layouts. The existing universal `GM Cardiac Drift` field is
unchanged as the fallback for ordinary Karoo heart-rate data.

## Changed

- `physiology/RrWindowMetrics.kt`: DFA alpha-1 calculation over scales 4-16; refuses short
  windows and never bridges an explicit invalid/dropout observation.
- `physiology/H10CaptureController.kt`: publishes current alpha-1 and a bounded 5-second,
  120-sample derived history.
- `ui/state/LiveUiState.kt` and `service/LiveSegmentService.kt`: framework-neutral H10 metric
  state is mapped into the live field state during an active attempt.
- `ui/H10CardiacBitmapRenderer.kt` and `karoo/H10CardiacDataType.kt`: large/compact field UI,
  collection and signal-quality fallbacks, reference bands, alpha-1 history, RMSSD and RR quality.
- `karoo/GritMapKarooExtension.kt`: registers type ID `h10-cardiac-stability`.
- `karoo/KarooPreviewState.kt`: animated representative H10 preview data.
- `app/build.gradle.kts`: 0.10.42/code65.
- Focused DFA and rendering tests were added; a stale preview assertion was made robust to the
  current 20-zone demo rather than fixed step numbers.

## Verified

- `JAVA_HOME=... ./gradlew testDebugUnitTest lintDebug assembleDebug`: passed; 175 JVM tests,
  Android lint, native/debug APK build.
- Installed with adb on Karoo `00442GA241760203`: success.
- `dumpsys package com.gritmap.karoo`: `versionCode=65`, `versionName=0.10.42`.
- No physical exercising H10/DFA field validation was run in this milestone.

## External state

- Connected Karoo now runs GritMap 0.10.42/code65.
- Add `GM H10 Cardiac` from Extensions in Karoo's data-page editor. Its preview loops through
  collection and changing DFA values without requiring the strap.

## Hazards and blockers

- DFA alpha-1 is explicitly experimental. The 0.75 and 0.50 bands are research references, not
  medical conclusions or universal personalized thresholds; recent cycling research reports weak
  agreement with laboratory thresholds.
- A live value intentionally remains unavailable until the latest clean suffix spans about 110
  seconds and contains at least 100 valid intervals. A dropout restarts that qualification.
- The current hard acquisition validator flags impossible intervals/dropouts but does not yet
  implement a versioned ectopic-beat correction algorithm. Do not promote alpha-1 into automatic
  pacing adaptation until physical comparison and artifact validation are complete.
- The repository contains extensive unrelated uncommitted work. Do not bulk reset or stage it.

## Next safe action

Open the Karoo data-page editor, add `GM H10 Cardiac`, and inspect its large and compact animated
previews. Then perform a recorded segment with the H10 connected for at least three minutes and
compare the live alpha-1/RR-quality behavior with the retained schema-2 RR artifact.
