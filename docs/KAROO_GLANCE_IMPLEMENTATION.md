# Karoo glance redesign implementation preview

2026-10-31. Jason's "okay lets start working on it" authorizes source implementation after the
read-only review. Separate branch codex/karoo-screen-redesign; no device install/public rollout.
Reference: Figma Karoo322:204/304:204/305:1101/305:1517 and the reviewed Markdown proposal at
origin/claude/gritmap-karoo-screens-b47518 fd15e95.

## Scope

Merged Pacing, Performance, Cardiac Drift and Power Balance now share a native Canvas renderer,
a framework-neutral presentation model and a full-image RemoteViews adapter. All four use
consistent1Hz throttling; both pacing registrations remain, including extension ID and type IDs.
Preferred picker entry is GM Pacing (live-pacing); the original Coach slot is GM Pacing (legacy)
(pacing-coach). Existing page placements stay. Two existing placements show the same merged field.
Old renderer/helper classes remain for compatibility/tests but the four live registrations use
the new adapter. H10, map/numeric fields, matching, telemetry, plans, BLE and database code are
not changed. Their existing palettes are outside this implementation scope.

Large/tall views show the relevant chart and footer; medium/small views drop secondary detail.
Short wide views put hero and verdict side by side, as the Figma context shows. Tight heights
fall back to a simpler composition instead of blindly treating every LARGE as480x620.
Both metric/imperial and light/dark are supported. Full-view image allocation avoids old Profile
DP/SP chrome scaling the new bitmap. Figma icons are local37px exports; no asset service is used
by the app. Chart marks are generated from actual state; no sample GPS/plot imagery embedded.

## Provisional choices and preserved behavior

The asynchronous question about recommended defaults had no recorded answer when implementation
started; after a reasonable wait the announced recommended defaults are used PROVISIONALLY:
HOLD green / PUSH orange / EASE blue, red warnings; Performance2s display deadband and W' finish
10%/3% plus actual<10% warning. They are named GlanceThresholds constants and change presentation
only. They are not physical/medical validation, and must be confirmed before installation/rollout.
The replanner's3s deadband and physiology calculations are untouched.

Cardiac baseline HR-response BPM remains useful before180 valid seconds, early drift180–359,
mature drift360+, with existing absolute3/5 bands (exactly5 and large negative values HIGH).
No false claim that power is steady when the actual steady flag is false. The plot bands match
the preserved absolute thresholds. This intentionally retains the validity findings in the review
instead of blindly applying the spec's proposed signed-only bands. Sensor loss has a word/icon;
held values are neutral, explicitly LAST, expire after5s, retain their ORIGINAL units, and clear
on attempt/elapsed reset. Known pacing targets can remain visible while only measured power is
lost; GPS loss hides route markers. A new view with no retained sensor value shows --.

The pacing ring remains the existing distance-proportional even-pace estimate. True section-time
anchors remain future wire-contract work. Constraint conflict is labelled limited/estimated;
it does not assert every limited adjustment proves a goal unreachable. Missing W' finish
projection is NO ESTIMATE, not OK or0%. No new registered data type/sensor stream/wire key.
Small layouts retain a unit alongside the hero because dropping both label and unit is ambiguous.
Light plots use contrast-aware dark lines/marks rather than invisible white-on-white.

## Verification and device gates

GlanceFieldsTest renders192 combinations (4 fields ×6 layouts ×4 states ×2 themes), plus tiny
and exact layout boundaries,0/finish marker positions, null/idle states. It checks deadband and
reserve boundary meanings, preserved cardiac disclosure, retained type IDs/shared adapter,
last-value expiry/reset and BPM-vs-drift unit safety. Previews are generated under
apps/karoo/app/build/reports/karoo-glance; exact commands/results in the dated handoff.

Mockup pixels, device density, physical legibility and actual on-device viewSize remain unmeasured.
No device query/logging build or install was performed. The earlier approved diagnostic74 source
is eac155f and its APK remains separately preserved; this redesign must not silently replace it.
Its Bluetooth-only test still needs native sender/readiness confirmation. Installation of this
redesign, a logging build, public tag/publish or new experimental flags requires its own approval.
