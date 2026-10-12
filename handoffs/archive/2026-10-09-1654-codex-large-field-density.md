# Handoff: Karoo large visual fields share the Pacing Profile hierarchy

- Updated: `2026-10-09 16:54 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `c1866fb docs: record first public Karoo beta release`
- Worktree: uncommitted renderer, BLE transfer, launcher icon, docs, and handoff changes

## Outcome

The five supplied large-field screenshots were audited against Pacing Profile. Cardiac Drift, Power
Balance, Segment Performance, and Pacing Coach now use its header scale and information hierarchy:
stable field identity plus progress/context, dominant guidance, large primary values, and legible
supporting labels. Pacing Profile itself changed only its top-left name to `GM PACING PROFILE`.

Exact before/after sizes and density decisions are recorded in
`docs/KAROO_LARGE_FIELD_TYPOGRAPHY_AUDIT.md`.

## Changed

- `apps/karoo/app/src/main/java/com/gritmap/karoo/karoo/LivePacingDataType.kt`: stable
  `GM PACING PROFILE` title; no other Profile presentation or renderer change.
- `apps/karoo/app/src/main/java/com/gritmap/karoo/ui/CardiacDriftBitmapRenderer.kt`: full
  `GM CARDIAC DRIFT` identity and balanced header sizing.
- `apps/karoo/app/src/main/java/com/gritmap/karoo/ui/WPrimeBalanceBitmapRenderer.kt`: larger title,
  progress, projected finish, state, and lower metric typography.
- `apps/karoo/app/src/main/java/com/gritmap/karoo/ui/SegmentPerformanceBitmapRenderer.kt`: readable
  `GM PERFORMANCE` header, larger progress/banner/split/card type, and a simplified non-duplicative
  goal comparison line.
- `apps/karoo/app/src/main/java/com/gritmap/karoo/ui/PacingCoachBitmapRenderer.kt`: stable title,
  unit-aware top-right progress, tighter/taller rows, and larger target/actual labels.
- `apps/karoo/app/src/test/java/com/gritmap/karoo/karoo/KarooFieldLayoutTest.kt`: asserts the stable
  Pacing Profile identity.
- `docs/KAROO_LARGE_FIELD_TYPOGRAPHY_AUDIT.md`: auditable scope, exact size changes, preserved
  behavior, and preview locations.

## Verified

- Visually inspected regenerated 480 px large-field PNGs for Cardiac Drift, Power Balance,
  Segment Performance, and Pacing Coach under `apps/karoo/app/build/reports/`; no clipping or
  collisions were observed.
- `env JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ./gradlew
  testDebugUnitTest lintDebug assembleDebug`
- Result: 189 JVM tests, 0 failures, 0 ignored; Android lint passed; debug APK assembled.
- `git diff --check` passed.

## External state

- No APK was installed on a physical Karoo in this milestone.
- The public beta asset and connected-device version were not changed.
- Supplied screenshots remain external reference files and were not copied into the repository.

## Goal alignment

- Improves legibility and cross-field consistency for the Karoo live-guidance experience.
- No shared phone/Karoo wire contract, segment JSON, pacing-plan data, matcher, physiology model,
  or calculation changed.

## Hazards and blockers

- RemoteViews and bitmap typography can differ slightly on the physical Karoo from Robolectric's
  native renderer. Device screenshots are still the final acceptance check.
- This work is mixed in an uncommitted worktree with the previously documented launcher-icon and
  BLE transfer milestones. Do not assume any of it is present in the public 0.10.43 APK.

## Next safe action

Install a new signed beta candidate in place on the Karoo, open the five large-field previews, and
capture one screenshot of each for a final physical density/clipping review before committing and
publishing.
