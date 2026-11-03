# Handoff: Nearby Segments proposal ready for scope approval

- Updated: `2026-11-03 America/Los_Angeles`
- Agent: `Codex`
- Branch: `codex/karoo-screen-redesign`
- Head before proposal documentation: `1869f6e docs(karoo): record verified cardiac countdown implementation`
- Worktree: only proposal, LATEST and this archive added/changed. Documentation commit local, no push authorization.

## Outcome

Read fetched main01ff851 and Nearby Segments request. Wrote the requested proposal before build. Recommend new GM Nearby Segments field: installed starts within2km, labelled direct-to-start distance, stable proximity order, up to4 rows by actual pixel size, LAST KAROO and stored GOAL. No runtime changes. the owner's latest keep-going instruction follows this chat's explicit proposal-first plan; do not treat it as implementation/install approval of unspecified design choices.

## Changed

Added `docs/KAROO_NEARBY_SEGMENTS_PROPOSAL.md`: ordering/radius defaults, row content/missing values, local-vs-phone history, timing qualification, future versioned history summary, six example sizes, independent service/state/cache lifecycle, GPS/empty states, concurrency/PR relationship, acceptance test plan. This LATEST and archive record proposal evidence, not aspirations about code already built.

## Verified

Read GOALS context and KAROO_MULTI_SEGMENT_AND_PR, receiver capabilities/strict segmentRecord v1; inspected Entities.kt, KarooDatabase.kt DAOs, RoomAttemptEventSink, KarooFieldLayout, ViewConfig, PacerMapLayer and vendored OnNavigationState.NavigatingRoute. Data exists for stored starts/goals and completed local attempts. No batched latest-attempt query or global nearby state exists. Imported segmentRecord is BEST, not LAST, and remains default-off. HistoricalAttemptSampleEntity is not a latest-effort summary. Room sink currently assigns endedAtMs from wall clock in asynchronous macro-event callback, so legacy elapsed durations need ~ qualification; no exact phone parity claimed. Vendor routePolyline/reversed/rejoin API exists but is not wired for upcoming order. No unit test, build, benchmark, Figma render or device command run for documentation-only proposal; row capacities are design targets. git diff --check before commit.

## External state

Fetched origin/main to01ff851; no checkout/main/phone changes, device read/install, cross-chat message, Figma edit, new data extraction, push, tag, release or deploy. No private rides/GPS in proposal or fixtures. Last known installed76/Room4 is historical; countdown source 6e183d0 verified with288 tests remains local/uninstalled (debug77 only). Main's old version70/diagnostic74 assumptions do not authorize downgrade or deployment. No physical field-size measurement beyond previous screen480x800/density300.

## Goal alignment

Karoo live-execution discovery/readability; phone retains catalog/authoring/history responsibility. Field is display-only, does not enable concurrent tracking/PR or change matcher/pacer/headline. Future map-upcoming ask can share a cache, but this proposal does not implement it. Two queued review tracks remain: map-line feasibility and reverse-BLE ride-sync feasibility.

## Hazards and blockers

LAST KAROO is most recent completed locally, not PR and not full phone ride history. Unavailable last/goal is —; no invented0:00/never ridden. Older local duration is approximate due timestamp persistence; show ~. Phone recent-time summary requires a separately versioned owner/fingerprint-bound contract, fixtures and transport/capability work. Do not silently expand strict record v1 or512-byte BLE manifest. Direct distance can point across valleys or behind; label it clearly and do not call it road distance/upcoming. Route-aware phase must handle loops/reverse/off-route/ambiguous projections. Layout capacity/unmeasured battery remain proposals requiring synthetic render/performance/device checks. Main explicitly requires proposal approval before build and the owner's yes before push; no new field code approved or installed.

## Next safe action

the owner reviews v1 scope:2km direct-to-start, up to4 rows, local LAST KAROO (~ for legacy timing) + GOAL, phone recent history later. If approved, implement isolated nearby-state/data field with synthetic tests/rendering before any install candidate. This note can be handed to the design session by the owner; no message to another chat authorized/sent. Keep current source/local commits intact; push only after explicit yes in this chat.
