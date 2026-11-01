# Handoff: native Karoo glance source preview implemented and verified

- Updated: `2026-10-31 19:08 PDT`
- Agent: `Codex`
- Branch: `codex/karoo-screen-redesign`
- Head before handoff documentation: `e7a7c45872076009913de341084a83819e719adc`
- Worktree: source committed; only implementation decision notes, LATEST and new archive will change for this documentation commit. Primary phone checkout/main/receiver branch untouched.

## Outcome

Jason explicitly said "okay lets start working on it" after the proposal review. Implemented source preview of merged Pacing, Performance, Cardiac Drift and Power Balance. That new instruction authorizes this source work beyond the earlier read-only scope; it does NOT authorize installing a redesign/logging APK, publishing, or replacing approved diagnostic74. H10/map/numeric fields unchanged. Feature work is reviewable on its own branch, not merged into main.

## Changed

- `0625c2a`: shared GlancePresentation, GlanceFieldRenderer, GlanceGraphicDataType; rewired both retained pacing IDs and three other graphical types; new full-image XML avoids Profile chrome scaling; preferred GM Pacing + GM Pacing (legacy) picker labels; complete-elevation preview flag; GlanceFieldsTest; exact Figma icon sources/resources; implementation note.
- `89e28b8`: keep EST visible in smallest reserve layout and accessibility label; hide unknown zero-distance context; named 1 Hz constant.
- `86b2250`: explicit terrain rendering guard blocks for lint clarity.
- `e7a7c45`: explicit composition selection and regression tests keep 199/200px half-width fields compact and 250px full-width fields horizontal.
- Important files: apps/karoo/app/src/main/java/com/gritmap/karoo/ui/GlancePresentation.kt, GlanceFieldRenderer.kt; karoo/GlanceGraphicDataType.kt, LivePacingDataType.kt, CombinedDataTypes.kt, CardiacDriftDataType.kt, KarooPreviewState.kt; res/layout/karoo_glance_field.xml, res/values/karoo_ui_strings.xml, res/drawable-nodpi/gm_glance_*.png; src/test/java/com/gritmap/karoo/ui/GlanceFieldsTest.kt; apps/karoo/design-assets/glance/; docs/KAROO_GLANCE_IMPLEMENTATION.md.
- Both type IDs pacing-coach/live-pacing and extension ID gritmap-live-pacing remain registered; existing page placements stay, with both aliases showing the merged layout. No new data type, sensor, wire key, importer, DB migration or matching/replanner algorithm change.

## Verified

Frozen source e7a7c45872076009913de341084a83819e719adc: `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ANDROID_HOME=/Users/frason/Library/Android/sdk apps/karoo/gradlew -p apps/karoo :app:testDebugUnitTest :app:lintDebug :app:assembleDebug -PgritmapVersionCode=76 -PgritmapVersionName=0.10.46-screen-preview --max-workers=2 --no-daemon` passed. **280 tests, 0 failures; lint and debug packaging pass.** Preview count 200 includes 192 field/layout/state/theme PNGs and 8 overview sheets. Additional tiny/boundary/start/finish geometry renders exercised without writing PNGs. Tests cover retained IDs, 2s UI deadband without changing 3s replanner, unknown reserve estimate,180/360s cardiac gates and absolute3/5 bands, no fabricated plan, stale-value expiry/reset and retained BPM units.

Initial targeted matrix caught an empty marker clamp range on 20px narrow width; fixed by chart size guards. An intermediate lint run overlapped a small source edit and failed SuspiciousIndentation with stale line references; guards made explicit and ALL checks rerun against this frozen commit. Do not count the failed run as passing evidence. No Needle code changed. No phone tests or native iOS build needed/run for this Kotlin/UI-only milestone.

Figma design-to-code skill read and used, session cfa58783-4a85-4cb7-afeb-97a9261649ab; high-fidelity context/screenshots of 322:204,304:204,305:1101,305:1517 inspected. Downloaded original SVG verdict icons and rasterized at exact 37x37 with bundled sharp; verified nonempty alpha/geometry and native slots. Standalone icon screenshot exports were blank, discarded/replaced by original SVG-derived PNGs. Dynamic charts/markers use actual state, not sample terrain assets. No Figma changes or runtime temporary asset URLs. Native previews compared visually; this is not real-device readability/density validation.

## External state

Local review artifacts: `/tmp/gritmap-karoo-screen-preview-e7a7c45`. Debug APK `/tmp/gritmap-karoo-screen-preview-e7a7c45/gritmap-screen-preview-debug.apk`, SHA256 `32dbd9026c6b35061e2c5701d9fc6f024788ff2c599c58bc61994f9202cdc30a`, package: name='com.gritmap.karoo' versionCode='76' versionName='0.10.46-screen-preview' platformBuildVersionName='15' platformBuildVersionCode='35' compileSdkVersion='35' compileSdkVersionCodename='15'. **DEBUG certificate, not the beta install candidate. Do not install this APK or ask Jason to substitute it for74.** Package/signature/config verified; experimental flags all false, BLE fault injection 0. No signed beta redesign candidate, install, ADB/device query, transfer, ride, tag, release or publication performed. Public73 last owner-confirmed; no fresh device state claim.

Approved74 artifact recheck: `Local artifact not present; do not silently substitute a rebuild.`. Source eac155f and exact prior approval remain separate. Sender readiness and Bluetooth-only test remain unconfirmed in this chat; do not infer that this UI work completed them. Room4/fallback75 constraints unchanged. New code76 is only a LOCAL DEBUG preview, not an installed/public version; future persistent-beta candidate needs explicit version/hash/signature review.

## Goal alignment

Owner-requested Karoo readability/layout work after the10/31 proposal, with phone authoring/Karoo execution split unchanged. Four target fields only; no H10 physiology change, backend reserve change, Needle work, inventory implementation or public flag enablement.

## Hazards and blockers

Jason answered **Use the recommended defaults** to the asynchronous design question on 2026-10-31. Defaults are approved for implementation; threshold values remain provisional pending ride validation: HOLD green / PUSH orange / EASE blue; Performance2s UI deadband; W' finish10/3 bands and current<10 warning; even-pace ring. No repeat default-choice confirmation is needed. Installation/rollout still needs separate exact approval. These are display thresholds, not validated safety/medical boundaries. Existing cardiac absolute3/5 bands and180/360 validity disclosure retained; baseline BPM remains useful, rather than adopting unapproved signed-only physiology. W' EST remains visible even at smallest size. Strict last-known sensor values are neutral/LAST, expire 5s and keep original units; current plan target may remain with valid GPS despite lost measured power.

ViewSize/density/physical legibility still unmeasured. Responsive clipping guards handle mockup/boundary/tiny sizes but do not prove 40px readability on a bike. Small units/EST retained for honesty; light-mode plots use dark contrast-aware marks. Existing map/numeric/optional H10 palettes are outside this scope. No calibrated section-time anchors were invented: ring is the existing distance-proportional estimate. See implementation doc for intentional spec adaptations and limitations.

## Next safe action

Jason reviews local native previews; recommended defaults already confirmed, so do not ask that choice again. Continue the separately approved Bluetooth74 sender/readiness → in-place74 → verify retained ceilings → ONE supervised ride sequence when explicitly ready; this redesign does not replace that test. Before any redesign device update, complete the required ride/design review, build a NEW persistent-beta candidate from committed source and present its exact hash/signature/flags for separate install approval. No logging build or public rollout implied. Coordinator reads this NEW branch for UI status; receiver branch origin/codex/karoo-receiver-capabilities remains ebbaa16 and its contract/fixtures remain the phone sender reference.
