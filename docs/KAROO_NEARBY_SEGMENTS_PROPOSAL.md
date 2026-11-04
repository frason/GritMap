# Recent segment results during a ride; nearby discovery is separate

2026-11-03. Revised after the owner clarified: **review the result of a segment just completed during
the ride**, not find its start to ride again. This supersedes the earlier nearest-start-only v1.
Source reviewed at `47e92e2`; original coordinator request on main `01ff851`. Proposal, no app build
or device access. Earlier proposal is preserved in Git and its immutable dated handoff.

## Confirmed use case and proposed first field

Primary field: **GM Recent Segments**. Newest COMPLETED GritMap attempt first, regardless of
current distance to its start. Once a completion is saved, the result appears automatically and
remains available after the next segment starts. Visiting this riding data page shows the results
without leaving the ride. Do not erase them with LiveUiStore.clear() or replace them with proximity
ranking. Repeated completions of the same segment remain separate results, keyed by attempt ID.

```text
RECENT SEGMENTS
Climb A                      2 MIN AGO
TIME 14:20                  GOAL 14:00
BEHIND 0:20        AVG 230 W · HR 148

Climb B                      9 MIN AGO
TIME  9:10                  GOAL  9:30
AHEAD 0:20         AVG 215 W · HR 142
```

These names/numbers are synthetic examples, not ride data. Most recent at top; tie-break by attempt
ID. Keep chronological order; no radius, plan priority or fastest-time sort. This is a list of attempts,
not a deduplicated list of segment definitions. No automatic page switching or rotating results.

Rows show name, completed-ago context, elapsed time, the goal USED FOR THAT ATTEMPT and explicit
AHEAD/BEHIND/ON GOAL. Use elapsed time including pauses, not moving time. Define gap as actual
minus goal; display words rather than unexplained sign. ON GOAL means equal at displayed-second
precision, not the provisional2s live-forecast deadband. Missing goal → NO GOAL with no gap;
missing average sensor data → —, never0 or a borrowed live value. Average power/HR are secondary
and omitted in compact cells. Full accessible description retains qualifiers and completion time.
PR/BEST is separate and is not a substitute for this result. Goal is not today's changed plan,
current predicted finish, or latest live-replanner estimate.

## What “would populate” means

Yes for an attempt the **Karoo GritMap matcher actually detected and finalized as COMPLETED**.
It does not mean every geographical segment crossed is recorded. Current public/default behavior
tracks one headline attempt; concurrency is OFF and overlapping starts may not produce attempts.
This field must not silently change those engine policies. Abandoned/partial/in-progress attempts
are not completed results. It cannot reconstruct a missed result simply because GPS passed nearby.

A ride imported into the phone does not automatically return its results to Karoo. Phone imported
recent history would need a new approved, versioned transfer summary; existing strict segmentRecord
v1 is BEST only. No phone/wire change is needed to populate newly completed local Karoo results.
Native HR/FIT presence also does not establish an H10 RR result; do not add implied RR analysis.

## Persistence and timing prerequisites

Current code already has segment_attempts with startedAtMs/endedAtMs, outcome, segmentId,
pacingPlanId and average power/HR/cadence/speed (`data/Entities.kt:78`). RoomAttemptEventSink
finalizes COMPLETED and persists those averages (`service/RoomAttemptEventSink.kt:36`). Missing:
latest-completed batched observable query, stable result display state and completion-goal snapshot.

The sink currently sets endedAtMs from System.currentTimeMillis() inside the asynchronous event
callback, not from the final matched telemetry timestamp. Pacing plan ID alone is not a reliable
historical goal snapshot: replacing/deleting plans can make lookup missing or change its meaning.

For new completions, capture an immutable result snapshot AT completion before clearing live UI:
attempt ID, fingerprint/name context, matched start/end telemetry timestamps or exact sampled
elapsed duration, goalFinishSecondsAtCompletion, completion timestamp and average sensor values.
Persist completion/result metadata atomically, then refresh a separate RecentResultsStateFlow.
Recommend additive nullable columns on the attempt row for sampled end/elapsed time and goal
snapshot, with explicit timing/source version (a new Room migration, likely4→5, to be reviewed
with implementation). Do not rewrite old attempts or manufacture goal snapshots from current plans.

Older rows can show approximate elapsed duration with **~**, and goal/gap unknown unless exact
historical goal provenance is available. Existing row deletion/name-update policy must be deliberate:
snapshot the displayed segment name/fingerprint to avoid a renamed segment rewriting an old result.
Current cascade deletes attempts with a deleted segment; preserve that existing behavior in v1 and
remove deleted rows from the field immediately, rather than invent independent history retention.

Use current session's completed-attempt IDs while session context is known, but do not promise
THIS RIDE after losing that context. Vendored RideState exposes Idle/Recording/Paused, not a ride
UUID (`KarooEvent.kt:44`). Persistent local records still allow **RECENT SEGMENTS** after service
restart; show completed time/age and label them RECENT, rather than silently assigning old results
to today's ride. A precise persisted ride identity/filter is separate future work unless required.

## Field sizes and interaction

Recommend up to **3 recent attempts** in a large480×620 field, up to2 in a tall240×620 field, and
1 in medium/compact fields. Each large row needs name/age, labelled TIME/GOAL, gap and optional
averages. These are targets, not measured device legibility. ViewConfig.viewSize is authoritative;
LARGE may be as short as250px and cannot blindly use a three-row layout. Small cells keep name,
TIME/GOAL and AHEAD/BEHIND; omit age/averages first, or show ENLARGE FIELD if labels won't fit.
Keep minimum legible font bounds and do not squeeze more rows indefinitely. Light/dark, long names,
H:MM:SS and missing goals must be rendered with synthetic fixtures before device validation.

Default experience is inline result review: no unverified tap/scroll affordances. Vendor ViewEmitter
accepts RemoteViews but its API/ViewEvent has no documented field-selection callback. Standard
Android PendingIntent possibilities do not prove the riding host dispatches row taps. The current
field uses one bitmap ImageView, not individual row buttons. Do not promise tap-to-open an extension
screen during recording (the owner already reported that extension-screen access is unavailable then).
A selectable detailed result screen is a distinct interaction/host validation task, if later requested.

## Separate Nearby option, not the result-retention rule

A later **GM Nearby Segments** companion can list installed starts within2km, direct-to-start order,
with current stored GOAL and last local time. That does NOT replace recent results and does not
remove a completed result when its start is farther away. If both views are wanted, use explicit
separate fields/pages, not automatic mode switches that hide the result the rider came to inspect.

Current starts/goals exist in SegmentDao and PacingDao; latest LOCAL completed query still needs
adding. Phone latest history is absent; default-off imported PR must never be relabelled LAST.
Route-aware UPCOMING mode is possible using vendor OnNavigationState.NavigatingRoute's
routePolyline/reversed/rejoin information, but GritMap does not currently build that index. Direct
distance must not be labelled distance ahead on the road. The new map-line request can share a
future upcoming cache, without modifying matcher/pacer state or enabling concurrency/PR flags.

## Cost, lifecycle and failure states

Read/observe persisted completion summaries on macro events/Room invalidation, not by scanning
full polylines or querying once per rendered row. Keep display updates<=1Hz; age label can update
on a coarse timer. No extra GPS, network lookup or BLE scan for recent results. Recent results
remain available when GPS is lost or the rider pauses; they are historical, not live positioning.
Service restart reloads local summaries; do not clear history on field detach or new live attempt.
Retention/query bound (suggest latest20 locally cached, display up to3) does not delete older DB
history. No new matcher runs per row. Battery/performance need measurements, not assumptions.

No completed attempts → NO COMPLETED SEGMENTS YET. No goal → NO GOAL. Failed query →
RESULTS UNAVAILABLE with retry at next relevant event; no unrelated live numbers substituted.
Deleted segments remove their rows consistently with current cascade. Local results and missing
phone history are distinguished; do not say never ridden. Add a new type ID such as recent-segment-results
and preserve every existing field ID/page placement. No automatic edits to rider pages.

## Proposed acceptance and next step

Tests should cover completion persistence → observable row, survives live-state clear and next
attempt, no dependency on current GPS/radius, repeated segment attempts kept distinct, newest-first
and tie behavior, abandoned excluded, elapsed including pauses, captured goal unchanged after plan
replacement/deletion, missing goal/averages, legacy timing qualifier, service restart/recent-session
label, deletion invalidation, compact layouts/theme and unchanged matcher/flags. Synthetic data only.
No tests/build/runtime work performed for this proposal revision.

the owner's clarification confirms result review as the use case. This document is the revised concrete
v1 scope for approval under main's proposal-first instruction; no implementation/install/push is
claimed. Figma can use this note; no message to another chat or Figma write was authorized/sent.
The already-built Cardiac Drift countdown remains separate, local and uninstalled. Existing Room4
rollback constraints still apply; any migration/install candidate needs its own review and approval.


## Implementation approved and verified (2026-11-03)

the owner said **okay lets build it** after reviewing the recent-results use case. Runtime7ca657d
implements **GM Recent Segments**, typeId recent-segment-results, alongside all ten retained
fields. No nearest-start field was added: proximity discovery remains separate optional work.

Room5 adds five nullable result-snapshot columns to segment_attempts (elapsed sample duration,
goal at completion, name/fingerprint snapshot, timing version). Existing rows stay intact and are
shown with approximate timing/unknown goal. Old plans are never used to invent a historical goal.
New completions freeze metadata before clearing live UI and persist a full final row with Upsert;
entry writes IGNORE if already saved, so delayed entry cannot overwrite a completed result.
Both normal and optional concurrent paths capture completion metadata; experimental flags stay off.

A separate Room-observed repository reads latest20 valid COMPLETED local attempts, newest first
with id tie-break; repeats are distinct. The field is not cleared by current live state, new attempts,
GPS loss or page detach. Restart reloads stored summaries. Deleting a segment cascades its attempts
as before. DB failures display unavailable and retry5s while observed. Rows display TIME/captured
GOAL, explicit AHEAD/BEHIND/ON GOAL at displayed-second precision, age and average power/HR
where size permits. Three large/two tall/one compact rows; tiny sizes say ENLARGE FIELD. Theme
and accessibility descriptions follow the native field design; labels remain present. Age ticks30s,
render throttle1Hz; no new GPS, BLE or networking. Add GM Recent Segments manually to a riding
profile after a future approved install. No row tap/detail navigation is promised.

Frozen verification:296 tests, zero failures/errors, debug lint and local debug build pass. Five new
persistence tests cover migration/reopen, repeated/unfinished/invalid results, a live subscribed
repository receiving completion, frozen goals/names despite plan replacement, delete invalidation,
late entry race and concurrent metadata; three new presentation/render tests cover comparisons,
legacy qualifiers/accessibility/layouts and84 native images plus2 sheets. Existing migration tests
now validate2/3→5 paths, field registration test preserves original ten and adds the eleventh.
Initial migration fixture failed on an optional missing index array; loader corrected and targeted
plus full validation rerun successfully. Schema5 exported, no destructive fallback. Representative
light/dark/tiny/hour-duration previews inspected; no physical legibility/performance claim.

Artifacts at `LOCAL_ARTIFACT_PATH`. Local debug build uses78 /
0.10.48-recent-results-preview overrides and is NOT a persistent-beta install candidate. No source
push, device query/install, tag/release or main/phone edit. Device last-known76/Room4 unchanged.
A future installed candidate opens Room5: direct return to76/Room4 would then be unsupported.
Exact newer persistent-beta candidate approval is still required before installing. This build
also includes the earlier approved countdown source, still uninstalled. No phone-import history,
full-ride matching/concurrency enablement or precise interpolated crossing times are claimed.


## Recent-result highlight visual, 2026-11-04

the owner confirmed the bar represents temporary result-highlight time. Runtime 6c5d472 adds a 30-second default from completion, a horizontal shrinking bar on the newest row in all supported sizes, 1 Hz updates while fresh, and normal persistent-list display after expiry. No result deletion or view-open timer reset. See handoffs/archive/2026-11-04-karoo-recent-highlight-verified.md for actual verification and device state.
