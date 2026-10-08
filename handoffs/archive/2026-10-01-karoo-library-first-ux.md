# Handoff: Karoo library-first extension UX

- Updated: `2026-10-01 21:12 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `d2befcb Merge remote-tracking branch 'origin/main'`
- Worktree: this uncommitted milestone changes `MainActivity.kt`, `KarooHomeScreen.kt`, `KarooDatabase.kt`, and `app/build.gradle.kts` among substantial concurrent Karoo/phone work.

## Outcome

The Karoo launcher is now a library-first three-destination experience: **Segments**, **Inbox**,
and **Settings**. Segments is the default and immediately summarizes installed/planned counts,
separates `NO PLAN` items into **Needs Attention**, and exposes goal time, generator source, FTP,
zone count, and plan date for `PLANNED` segments. Transfer/import work lives in Inbox; permissions,
demo mode, diagnostics, and version live in Settings.

## Changed

- `apps/karoo/app/src/main/java/com/gritmap/karoo/ui/KarooHomeScreen.kt`: new responsive Compose shell and destination screens.
- `apps/karoo/app/src/main/java/com/gritmap/karoo/MainActivity.kt`: preserves existing callbacks while routing them through the new UI; restores overlay permission management; applies an explicit high-contrast dark color scheme.
- `apps/karoo/app/src/main/java/com/gritmap/karoo/data/KarooDatabase.kt`: library rows now include baseline plan ID/source/FTP/goal/created time and zone count.
- `apps/karoo/app/build.gradle.kts`: version `0.10.25` / code 48.

## Verified

- `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ./gradlew testDebugUnitTest assembleDebug` — passed after the final UI changes.
- Installed using `adb install -r`; physical Karoo reports and displays `v0.10.25`.
- Physical-device screenshots were inspected at 480×800. A first pass reduced the readiness card and corrected dim navigation/action colors before the final install.

## External state

- Karoo `00442GA241760203` has `0.10.25`/code 48 installed with existing segments and plans preserved.
- Device library showed three installed segments, two planned, and Coco Jumbo correctly grouped under `NO PLAN`.

## Hazards and blockers

- The segment cards are informational plus delete confirmation; a dedicated full segment-detail screen is not yet implemented.
- Distance currently displays miles in the launcher rather than reading Karoo's unit preference; live data-field unit behavior is unchanged.
- The worktree contains concurrent uncommitted changes; do not discard or mass-format it.

## Next safe action

Review Segments, Inbox, and Settings directly on the Karoo, then prioritize either a segment-detail screen or unit-preference integration based on the device feedback.
