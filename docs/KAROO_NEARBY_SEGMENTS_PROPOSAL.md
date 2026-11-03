# Nearby Segments field: proposal for approval

2026-11-03. Source reviewed at `1869f6e`; coordinator request on fetched main `01ff851`.
Proposal only: no app changes, build, device access or wire change. Main explicitly says
“Do NOT build until the owner approves.” This note is the handoff to the Karoo design session.

## Recommended first version

Add **GM Nearby Segments**, independent of the active pacing fields. Show segments already
installed on this Karoo within **2 km of their START**, nearest first. This is a direct geographic
distance, not a promise that the start lies ahead on the road. Header: **NEARBY · TO START**;
first-use/field description: **Installed segments · direct distance to start**. Miles/feet or km/m
follow Karoo preferences. No account/network/public-catalog lookup or automatic download.

Each row shows name, distance to start, **LAST KAROO** and **GOAL**:

```text
NEARBY · TO START
Climb A                         420 ft
LAST KAROO ~14:20          GOAL 14:00

Climb B                         0.8 mi
LAST KAROO —              GOAL  9:30
```

LAST is the most recent completed effort, **never the personal best**. Display — when unavailable;
never0:00 or “never ridden” merely because phone history is missing. Missing goal shows —;
provisional power targets or predicted finishes are not goals. No cycling through rows, scrolling
or changing existing data-page placements automatically. Rider adds the new field explicitly.

## Ordering and route-aware follow-up

For v1, direct-to-start ordering is well-defined without a selected route. Calculate exact geographic
distances from fresh GPS, filter2 km, order by20 m distance buckets to prevent jitter; retain prior
order within the same bucket, then stable fingerprint tie-break. Actual displayed distance remains
measured distance. No plan/goal priority hidden in the ranking. No heading-based exclusion while
stationary; nearby does not mean the segment's direction has been confirmed. Started attempts
leave this upcoming-start list and remain in existing pacing fields; no headline/matcher change.
After completion, keep them eligible again rather than hiding a nearby start needed for repeats.

**Along-route distance is more useful for “what is next while riding,” but is a different claim.**
Vendored `OnNavigationState.NavigatingRoute` exposes routePolyline, reversed and rejoin information
(`KarooEvent.kt:335`). GritMap currently does not observe/use it for an upcoming-segment index;
LiveUiState.routeProfile is the matched SEGMENT, not the selected navigation route. A later mode
can say **UPCOMING · ON ROUTE** only after projecting rider and segment entry/direction onto a
reliable selected route. Handle loops/repeated passes, reversed routes, off-route/rejoin and
ambiguous projection explicitly. Fall back to visibly labelled NEARBY direct distance, never silently
mix miles along route with direct miles. Share that future upcoming-start service with the separate
map-line proposal on main; neither the list nor map may alter matching or pacer calculations.

## Available data and the important limits

Source paths below under `apps/karoo/app/src/main/java/com/gritmap/karoo/`:

| Content | Exists now | Implementation needed |
|---|---|---|
| Identity/name/start | SegmentEntity fingerprint/name + reference pointIndex0; SegmentDao.segmentStartsInBounds | Batched cached start summaries for all installed segments; no per-tick loading of full polylines |
| Stored goal | PacingPlanEntity.targetFinishTimeSeconds; baseline DAO | Join the current baseline with matching segment fingerprint; null/nonpositive → —; retain explicit goal, not replan estimate |
| Latest LOCAL completion | segment_attempts has outcome/start/end/segmentId | Add a batched latest-completed query/Flow; choose by endedAtMs then deterministic id; exclude active/abandoned/invalid durations |
| Phone's latest completion | Not transferred | New versioned/capability-gated history summary; separate approved work |
| PR | segment_records.bestDurationSeconds, diagnostic/default-off | It is BEST, not LAST; do not relabel it or enable its flag for this field |

Local elapsed time is approximately `(endedAtMs-startedAtMs)/1000`, including pauses. The current
RoomAttemptEventSink writes end time using System.currentTimeMillis() inside the asynchronous
macro-event sink, so older rows are not precise crossing timestamps. Show **~** for these local
LAST values; do not assert equality with phone/FIT timing. For precise future local times, separately
capture the matched final telemetry timestamp at completion and persist that timing basis; old
rows still need provenance rather than being silently reinterpreted. Completed local matches can
also differ from phone acceptance/boundaries. HistoricalAttemptSampleEntity supplies physiology
samples, not a reliable phone latest-attempt summary.

**V1 therefore needs no phone change if labelled LAST KAROO.** It cannot populate an all-device
LAST from phone imports. The normal installed source keeps PR/record import flags OFF, and the
strict v1 segmentRecord carries only the best effort, not the latest. Do not add unrecognized fields
to it, enable flags, or make phone history a hidden requirement for using nearby discovery.

For a later unified LAST, propose a separately versioned, owner/fingerprint-bound optional history
summary: schemaVersion, riderId, segmentFingerprint, latestCompletedAttempt(durationSeconds,
completedAtMs, opaque attempt key, sampled-elapsed timing basis). These are DRAFT fields, not a
new wire contract. Phone selects its latest accepted/manually approved completed effort. Compare
valid same-owner/fingerprint local and imported attempts by completion time, retain source labels;
handle duplicates, older transfers, revoked attempts/explicit empty snapshots and clock conflicts.
Never substitute bestDurationSeconds when no latest exists. Strict fixtures, ownership/revision
rules and a shared contract are required before either side sends it. BLE v2's512-byte manifest
must not grow; coordinate this resource with the separately planned chunked-manifest/PR milestone.
No raw ride GPS/HR/power or account identity is needed for this optional summary.

## Field sizes and readability budget

Actual ViewConfig.viewSize is authoritative. Last observed device screen is480×800 at300dpi;
this does not measure each field. KarooFieldLayout uses width/grid and height breakpoints only.
Suggested capacities below are design targets, not device validation:

| Example view | Rows | Content |
|---|---:|---|
|480×620 full width |4| Spacious rows: name/distance, labelled LAST KAROO and GOAL |
|240×620 tall half width |3| Name then distance; times in two labelled columns |
|480×200 |1| Name + distance and both labelled times |
|240×320 |1| Larger nearest row; do not shrink text to force two |
|480×120 |1 compact| One-line name/distance, two labelled times |
|240×120 |1 compact if legible| Short ellipsized name, distance, small labels and two times; otherwise ENLARGE FIELD |

Allocate pixel budgets from measured condensed-font bounds, not enum LARGE alone: short250px
LARGE views must not receive the four-row composition. Full rows target roughly116px/full width,
150px/narrow after header/footer/padding. Small cases need their own three-line layout. Cap four
rows; show **+N more** where space permits. Keep times prominent, test H:MM:SS and long names,
and use ENLARGE FIELD below viable geometry rather than clipping or inventing omitted values.
Native preview and real-device riding review are required before claiming legibility. Icons/words,
not colour alone; named columns stay visible. Accessibility announces full name, distance basis,
local/phone provenance, latest time and goal even when names are visually ellipsized.

## Independent lifecycle, battery and failure states

Use a separate NearbySegmentsStateFlow/repository and new graphical typeId `nearby-segments`;
keep every existing field id. It must not depend on LiveUiStore's active attempt: that store clears
on finish and has no global nearby list. Share existing service/location feed while recording,
without extra GPS scans or BLE work. New cache reads start/goal/latest metadata at service entry
and on Room invalidation/import/delete/completion; no one-query-per-row or DB writes at1Hz.

Recompute in memory no faster than every2s when location changes materially (e.g.10m), and
refresh distances at least every5s with fresh data. Use a lightweight freshness check while visible
so losing callbacks results in WAITING FOR GPS rather than a falsely live list. Existing freshness
policy is3s; hide distances/ordering once stale. Paused ride with fresh GPS can keep the stable list;
before recording show START RECORDING; edit preview uses synthetic data. No new location
permissions or background networking. Expected hundreds of cached starts is O(N) distance work
plus bounded top candidates, not N full route matches; measured battery impact remains unknown.
Retain at most32 ranked candidates, display up to4; when over cap say32+ rather than claim an exact
full count. Event invalidation must remove deleted segments and update last time after completion.

States: no installed segments → SEND SEGMENTS FROM PHONE; installed but none in radius →
NO STARTS WITHIN2 KM (localized units); no valid GPS → WAITING FOR GPS; no last/goal → — in
that cell; query failure → SEGMENTS UNAVAILABLE (retain no falsely live distance); tiny field →
ENLARGE FIELD. Reconnect/import must not clear saved history. Catalogue and timing correctness
are independent of pairing status once data is installed.

## Relation to multi-segment/PR work and proposed acceptance

This is read-only discovery/display, not concurrent tracking or PR racing. Leave default-off
concurrency/records/replanner flags unchanged. Do not change CandidateSelector,50m lock,
direction gate, segment matcher or active headline. A nearby start is not a completed attempt,
and this field does not make the Karoo record all overlapping starts. Future all-device history
and route-aware/map work can reuse data services with explicit contracts.

Before implementation: the owner approves this v1 scope/defaults. This note supplies the requirements
for the separate Figma design session; no message or Figma write was sent here. Tests then cover start-vs-midpoint distance, radius boundary, jitter/ties, reversed/ambiguous
route fallback (if route mode later), no-goal/last, LAST≠BEST, incomplete/abandoned attempts,
legacy timing qualifier, deletion/completion invalidation, GPS staleness despite no callbacks,
large catalog bounded work, every layout/theme and long H:MM:SS names/times, plus retained old
field ids and unchanged matcher behavior. Synthetic geography only. No tests/build performed for
this proposal. No Figma edits/device access/install/push; source implementation is not approved.
