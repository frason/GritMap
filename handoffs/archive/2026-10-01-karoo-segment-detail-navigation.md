# Handoff: Karoo segment detail navigation

- Updated: `2026-10-01 21:25 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `d2befcb Merge remote-tracking branch 'origin/main'`
- Worktree: uncommitted changes in `KarooHomeScreen.kt` and `app/build.gradle.kts`, alongside prior concurrent work.

## Outcome

Segment cards are now navigable. Tapping a library row opens a dedicated segment page with pacing
plan status and metadata, matching configuration, plan-replacement routing to Inbox, and protected
deletion. Delete controls were removed from the library list. Detail and library scroll states are
isolated so detail pages always open at their header.

## Changed

- `apps/karoo/app/src/main/java/com/gritmap/karoo/ui/KarooHomeScreen.kt`: clickable cards, dedicated detail page, back navigation, plan/matcher sections, replace-plan action, delete confirmation, isolated scroll-state composition keys.
- `apps/karoo/app/build.gradle.kts`: version `0.10.26` / code 49.

## Verified

- `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ./gradlew testDebugUnitTest assembleDebug` — passed.
- Explicit `adb install -r` succeeded; device reported `0.10.26`/code 49.
- Tapped a real segment on the physical Karoo and confirmed the detail screen opened. That test exposed scroll-state reuse; it was fixed, rebuilt, tested, and reinstalled.

## External state

- Karoo `00442GA241760203` has the corrected `0.10.26` build installed with data preserved.

## Hazards and blockers

- Attempts/history are not yet displayed because the current DAO has no segment attempt-summary query.
- Distance still displays miles rather than reading Karoo's unit preference.
- The worktree contains extensive concurrent uncommitted changes; do not discard or mass-format it.

## Next safe action

Tap planned and unplanned segment cards on-device and review the detail-page hierarchy; then add attempt history only after defining the required query and presentation.
