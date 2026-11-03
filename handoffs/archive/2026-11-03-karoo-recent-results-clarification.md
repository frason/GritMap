# Handoff: clarified goal is reviewing recently completed results during the ride

- Updated: `2026-11-03 America/Los_Angeles`
- Agent: `Codex`
- Branch: `codex/karoo-screen-redesign`
- Head before clarification docs: `47e92e2 docs(karoo): propose nearby starts and recent-time field`
- Worktree: only revised proposal, LATEST and this archive. Local documentation commit, no push.

## Outcome

the owner clarified **yes review its result** after explaining that a just-completed segment should be revisitable during the ride. Primary proposal is now GM Recent Segments, newest completed local attempts first, independent of distance. Earlier nearby-starts-only v1 does not satisfy this intent and is superseded as the primary view. Nearby discovery becomes a separate optional companion.

## Changed

Rewrote `docs/KAROO_NEARBY_SEGMENTS_PROPOSAL.md` around result review: time, goal captured for that attempt, explicit ahead/behind and secondary averages; durable completion snapshot and separate state; repeated attempts, legacy approximate times, session/restart limits, layouts and interaction evidence. Earlier proposal remains in Git/archive. No runtime implementation, test or device change.

## Verified

Read Entities/RoomAttemptEventSink, vendor ViewEmitter (RemoteViews updates), DataTypeImpl, ViewEvent and RideState. Completion outcome/averages exist. Async wall-clock endedAt and no persisted goal snapshot make a plain most-recent query insufficient for precise historical goal comparison. Need matched end/elapsed and immutable goal snapshot captured at completion; additive metadata migration proposed, not written. RideState has no ride UUID, so recovered state must say RECENT rather than assume THIS RIDE. No documented field-selection callback in reviewed ViewEvent/Emitter; do not promise taps open a result screen while riding. Inline field review avoids relying on unvalidated interaction. Main/GOALS source context from prior proposal remains applicable. No tests/build run for documentation; git diff --check before commit.

## External state

No device read/install, personal ride access, Figma/cross-chat action, push, main/phone change, release or deployment. All example rows synthetic. Countdown source 6e183d0 remains local, verified288 tests historically, not installed. Last-known device76/Room4 unchanged.

## Goal alignment

Karoo live execution includes useful result review; this is local recorded results, not phone post-ride analysis, imported PR or discovery. No matcher/concurrency flag change. Only attempts actually detected/completed locally can populate immediately; phone-imported results do not automatically arrive. New feature must survive LiveUiStore.clear()/next attempt and not disappear due distance/GPS loss.

## Hazards and blockers

Latest completed is not best/PR. Compare with captured attempt goal, not today's plan. Existing legacy macro timestamps approximate; do not fabricate exact crossing times. Proposed metadata migration would change storage version and needs implementation/candidate review; no migration applied here. Persisted ride identity and tap-to-detail host behavior unresolved; don't claim them. User confirmed intent, not an install/push or unspecified metadata schema. Main says proposal approval before building; revised scope still proposal.

## Next safe action

Present revised GM Recent Segments scope for review: up to3 full-field results, time/attempt-goal/ahead-behind, optional average power/HR, local completion automatically appears regardless of current distance. Nearby list is separate optional work. Then implement only approved source scope with synthetic persistence/render tests; exact device candidate later. No repeat request for original FIT. Local commits remain unpushed per main's push gate.
