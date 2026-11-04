# Karoo segment lines and pace marker: source review and proposal

2026-11-04. Documentation only; instruction source origin/main ea4290b, top CODEX CURRENT TO-DO, ONE LIST. Reviewed local source f828191 (runtime-equivalent to pushed0ae52da). No device access, runtime change or new behavior tests.

## Finding

Several segment lines and one distinct pace marker are feasible in the vendored map API. Today's implementation shows only the active headline segment, and only if a planned target position can be computed. Upcoming route-aware discovery is new work; no existing UI list can simply be switched on.

## Evidence and current limitations

- apps/karoo/app/src/main/java/com/gritmap/karoo/karoo/PacerMapLayer.kt: effects requires ACTIVE and a non-null target point. Fixed polyline ID gritmap-active-segment, width5, blue#3386E6; route geometry is encoded at precision5 and cached by geometry hash. One stable gritmap-virtual-pacer symbol updates at target distance. An unplanned active segment without plannedFinishSeconds therefore has neither line nor marker through this path.
- ui/state/LiveUiState.kt targetProgressMeters is elapsedAttemptSeconds / plannedFinishSeconds * totalDistanceMeters, clamped to the segment. It is a distance-proportional goal schedule, not a terrain/power simulation. ui/GlanceFieldRenderer.kt uses this same property for the Pacing field marker.
- karoo/GritMapKarooExtension.kt startMap collects LiveUiStore.state with no independent rate limit or freshness timer. It emits marker effects on state updates, not a guaranteed clock rate. Non-ACTIVE or missing-target state hides previously shown line/symbol. Cancellation cancels the collector; cleanup on host detachment is not established by the reviewed code.
- PacerMapLayer does not inspect sensorStatus.gps or telemetry age itself. GPS loss that causes no new state may leave a stale marker visible. Do not claim existing uncertainty teardown handles silent missing callbacks.
- service/LiveSegmentCoordinator.kt has internal candidate discovery for matching; its private candidates are not a display discovery API. LiveUiState carries a single routeProfile, not a bounded installed/upcoming/completed route collection. Room recent-result rows contain summaries, not map geometry and route-order state.
- Vendor models/MapEffect.kt supports independently identified ShowPolyline/HidePolyline and lists of symbols with stable IDs. Only color and width are exposed for a line: no dash, opacity property, casing, layer order or label field. ARGB is representable but host blending/ordering is not verified. Symbol.Icon exposes drawable and orientation; Symbol.POI has a name, but arbitrary moving gap labels are not part of Icon. Drawable gm_map_pacer is a32dp concentric white/blue/dark icon.
- Vendor models/KarooEvent.kt OnNavigationState.NavigatingRoute exposes routePolyline, routeDistance and related navigation state. It enables a future route-relative index; this extension currently has no navigation subscription for display discovery. Encoding direction, repeated route crossings and current progress need explicit treatment, not nearest Euclidean distance alone.
- No numeric polyline/symbol limit, update-rate budget, IPC size limit or battery/memory guarantee was found in these vendored models. That is an evidence limit, not permission for unlimited overlays. A casing made from two lines is only an experiment until host stacking order is verified.

## Proposed v1 behavior, pending owner decisions

Display-only controller, separate from candidate selection and live matching: retain the active line independently of whether a goal marker exists; add at most the next planned installed segment whose start is within2km ahead along an actual navigation route. Maximum2 segment lines plus1 marker; deduplicate the active segment. Hide completed overlays in v1 to limit clutter. Without navigation, show only the active segment; do not call straight-line proximity upcoming. Nearby Segments radius/ordering/row-content decisions remain separate and unapproved.

Cache simplified, finite, range-checked geometry once per segment fingerprint. Proposed budget512 points per segment and at most1024 displayed points, preserving endpoints. Recompute upcoming membership no more often than every5s or on route/library change; marker at most1Hz, latest update wins. Diff IDs and resend lines only for geometry/style changes. Explicitly remove replaced/deselected lines. These are proposed app budgets, not vendor limits or measured performance.

Proposed visual states: upcoming amber#FF9A1F at width3 plus a start flag, active blue#3386E6 at width5 plus start/end symbols. Keep a distinct white/dark outlined pacer icon; no new rider-position icon. Pending physical contrast checks on light/dark map and the native navigation route. Color alone is insufficient: width and start marker distinguish upcoming/active. Leave optional gap text out until a usable label API/host layout is validated. Casing and faded completed lines deferred because order/alpha behavior is unverified.

Use a timestamped display input and an independent freshness watchdog; proposed GPS age3s follows current telemetry freshness. On stale GPS, UNCERTAIN, abandonment, completion or route departure: remove the moving marker, never advance it from a stale state; keep only the last confirmed active static geometry during a brief uncertainty grace (proposed10s), then hide it. Hide upcoming lines when route position becomes uncertain. Reacquisition rebuilds membership from the latest confirmed state. These proposed rules need a clock-injected display contract; no matcher state should be changed to make the map work.

## Replanning consistency

service/AttemptReplanner.kt adjusts zone targets and replanEstimate but preserves plannedFinishSeconds. Keep the map and Pacing field on the existing shared targetProgressMeters schedule. Do not derive a second map position from the updated finish forecast: that would move the goalpost and disagree with the field. If terrain-aware or replanned time anchors are wanted, introduce one shared schedule contract consumed by both views and test continuity at the replan boundary; that is separate engine/contract work and needs approval. Replanner/concurrency flags remain OFF; no flag change proposed for this display work.

## Future verification, not performed

Existing PacerMapLayerTest covers projection, route-once/stable-symbol updates, uncertain teardown and canonical encoding. After implementation approval, extend with synthetic-only cases: next/active deduplication, two-line cap, navigation reversal/loops, geometry/library replacement, no-plan active line, stale-GPS watchdog with no callback, uncertain grace, completion/detach teardown, malformed geometry and same target after replan. Test effect count/throttling and ensure display never changes matcher/pacer state. Do not add new-state tests pretending the unimplemented behavior exists.

Physical validation needs a newly approved candidate: map styles, rider/pacer separation, route legibility, overlay churn, GPS recovery and service detach. No latency/battery claim until measured. Current issue is architecture and review, not a blocker to finishing this document. Blockers to implementation are the owner’s display-policy decisions and approval; device validation is separately authorized.
