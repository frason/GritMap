# Handoff: Segment-definition plan reviewed with required revisions

- Updated: `2026-08-18 23:02 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `dccdcf9 docs: review segment definition plan`
- Worktree: `clean before this handoff update`

## Outcome

Claude's plan for issues #6/#7 is directionally approved, but implementation should not begin
until the review section at the top of `docs/PLAN_segment_definition_increment.md` is folded into
the main body. The review resolves all four open questions and identifies cross-platform and data
integrity issues that the original recommendations missed.

## Changed

- `dccdcf9 docs: review segment definition plan`
- Approved scrubber-driven selection with visual, non-draggable map pins and no new gesture module.
- Rejected source-derived fingerprints because they break shared identity across rides/users.
  Required removal of fingerprint uniqueness plus a normal index instead.
- Kept Segment List in scope and required native/web map module separation.
- Added requirements for timestamp-based GPS gap splitting, distance-based scrubber positioning,
  elevation interpolation, portable JSON/Kotlin fingerprint conformance, typed cross-stack
  navigation, input/rollback validation, and a persisted self-match test.

## Verified

- Review was grounded against the current SQLite schema, navigation tree, MapLibre scaffold,
  MVP/app specification, and Karoo Kotlin JSON/fingerprint importer.
- No product code or tests were changed or run; this milestone is documentation review only.

## External state

- None.

## Hazards and blockers

- Root SQLite and Karoo Room currently both make fingerprint unique. The root migration is part
  of this increment; Karoo needs a compatible follow-up before claiming identical definitions can
  coexist on-device.
- Kotlin `Double.toString()` and JavaScript number string conversion are not byte-identical for
  all values; a shared expected-hash fixture is required before phone→Karoo sharing is trusted.

## Next safe action

Have Claude incorporate the review into the plan's main sections, then implement commit 1 only
(`getRideTrack` with timestamps and tests) before proceeding to native map work.
