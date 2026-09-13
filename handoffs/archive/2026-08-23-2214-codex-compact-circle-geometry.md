# Handoff: Compact circles and pacing tick hierarchy corrected

- Updated: `2026-08-23 22:14 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `7b6ea68 docs: hand off segment-definition increment completion (closes #6, #7)`
- Worktree: substantial pre-existing uncommitted Karoo work; this increment changes `ProfileBitmapRenderer.kt` and `karoo_live_pacing_field.xml`.

## Outcome

The installed pacing profile now differentiates scale ticks by length: 3 px minor ticks span one quarter of the usable center width, while 6 px major ticks span one half. The rounded REST/HOLD/PUSH badge is inset 2 dp above and below and its vertical padding is reduced by 4 dp total. The bitmap ImageView preserves aspect ratio so compact rider and pacer circles are no longer stretched into ovals.

## Changed

- Updated `ProfileBitmapRenderer.kt` to select tick length per major/minor interval.
- Updated `karoo_live_pacing_field.xml` with 2 dp vertical badge margins, 1 dp internal vertical padding, and `fitCenter` bitmap scaling.

## Verified

- `JAVA_HOME=/opt/homebrew/Cellar/openjdk@17/17.0.20/libexec/openjdk.jdk/Contents/Home ./gradlew --no-daemon :app:testDebugUnitTest --tests com.gritmap.karoo.ui.ProfileBitmapRendererTest :app:assembleDebug`
- Result: `BUILD SUCCESSFUL in 51s`.

## External state

- Installed `apps/karoo/app/build/outputs/apk/debug/app-debug.apk` on the connected Karoo; adb result `Success`.
- Version remains 0.8.1/versionCode 12.

## Hazards and blockers

- `fitCenter` guarantees circular geometry but may introduce small theme-colored letterbox space if Karoo allocates a materially different ImageView aspect ratio; verify in compact screenshots.
- Preserve all unrelated/pre-existing uncommitted Karoo work.

## Next safe action

Capture one compact and one large preview to verify circular markers, badge inset, and the new minor/major tick hierarchy.
