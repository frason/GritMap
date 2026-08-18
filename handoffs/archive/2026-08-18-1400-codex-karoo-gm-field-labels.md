# Handoff: Karoo field labels shortened to GM

- Updated: `2026-08-18 14:00 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `450ebc5 apps/karoo: shorten field labels to GM`
- Worktree: `clean before this handoff update`

## Outcome

All six Karoo extension field-library names now use the compact `GM` prefix, reducing label
truncation in Karoo's page editor. Existing data type IDs were not changed, so configured ride
pages remain compatible. The launcher/application title remains `GritMap Karoo`.

## Changed

- `450ebc5 apps/karoo: shorten field labels to GM`
- `apps/karoo/app/src/main/res/values/karoo_ui_strings.xml`: renamed the six field display names.
- `apps/karoo/app/build.gradle.kts`: bumped the APK to versionName `0.4.1`, versionCode `6`.

## Verified

- Ran `env JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ./gradlew
  --no-daemon -Pkotlin.compiler.execution.strategy=in-process :app:testDebugUnitTest
  :app:assembleDebug` from `apps/karoo`: `BUILD SUCCESSFUL`; all JVM tests passed and the debug
  APK assembled.
- Installed the resulting APK in place using `adb install -r`: `Success`.

## External state

- Physical Karoo `00442GA241760203` has version `0.4.1`/versionCode `6` installed. The in-place
  install retained its application data.

## Hazards and blockers

- Only field-library display names were shortened. Descriptive text elsewhere still spells out
  GritMap intentionally.
- Responsive field layouts discussed after the page-editor screenshots are not implemented yet.

## Next safe action

Open Karoo's page editor and confirm the six fields display with `GM` labels, then implement
size-aware compact/medium/large render variants if desired.
