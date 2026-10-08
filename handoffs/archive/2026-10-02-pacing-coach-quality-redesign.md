# Handoff: KGhost-informed Pacing Coach installed

- Updated: `2026-10-02 09:01 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `d2befcb Merge remote-tracking branch 'origin/main'`
- Worktree: existing broad uncommitted phone/Karoo work remains; this increment touched only the four files listed below.

## Outcome

Karoo `0.10.28`/code 51 redesigns the text-led GM Pacing Coach around a stable glance hierarchy:
segment/progress, Rest/Hold/Push plus signed pace relation, target watts, 3-second actual power and
delta, next zone, and an explicit guidance-quality line. Large/narrow fields show the complete
hierarchy. Compact fields suppress header/quality/next-zone details rather than shrinking all text.
The visual GM Pacing Profile was not changed.

KGhost's operational lesson is now represented in this field by explicitly distinguishing `LIVE ·
ADAPTIVE`, `LIVE · BASELINE PLAN`, `ESTIMATED · ROUTE UNCERTAIN`, `STALE · … MISSING`, and
`GUIDANCE UNAVAILABLE`. The authoritative deterministic recommendation remains independent of
this presentation label.

## Changed

- `apps/karoo/app/src/main/java/com/gritmap/karoo/karoo/CombinedDataTypes.kt`
  - Added segment/progress header, signed pace relationship, unit-aware next-zone distance, and
    guidance-quality labels to Pacing Coach.
  - Added layout-specific type scaling and responsive visibility.
- `apps/karoo/app/src/main/res/layout/karoo_pacing_coach_field.xml`
  - Added header and quality rows and increased action/next-zone emphasis.
- `apps/karoo/app/src/test/java/com/gritmap/karoo/karoo/CombinedDataTypesTest.kt`
  - Covers complete coach text, pace relation, estimated uncertainty, and stale sensor state.
- `apps/karoo/app/build.gradle.kts`
  - Version `0.10.28`, code 51.

## Verified

- `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ./gradlew :app:testDebugUnitTest --tests com.gritmap.karoo.karoo.CombinedDataTypesTest :app:assembleDebug`
  - Passed: 11 focused tests and APK assembly.
- `git diff --check` on all four touched files passed.
- APK installed with `adb install -r` on physical Karoo `00442GA241760203`.
- Device reports `versionName=0.10.28`, `versionCode=51`; MainActivity reopened.
- The install was in-place, preserving the restored segment database.

## External state

The physical Karoo now runs `0.10.28`. Its restored Diablo, Relize, and Coco Jumbo data should
remain present. Karoo FTP was changed by the client to 280 W before this increment so the restored
280 W plans should no longer be marked outdated.

## Hazards and blockers

- The new field has compiled and been installed but has not yet been visually reviewed in each
  Karoo field size.
- `STALE` currently reflects missing GPS/power in the framework-neutral state; the state model
  does not yet carry per-signal age timestamps, so it cannot distinguish an old-but-present sample
  from a current sample. Add timestamps before claiming full KGhost-style staleness semantics.
- Existing broad uncommitted changes predate and overlap this increment; do not bulk revert or
  commit unrelated files.

## Next safe action

Open Karoo page editing, add GM Pacing Coach in the desired sizes, and capture large plus compact
screenshots. Review hierarchy and truncation before making another visual pass.
