# Handoff: Karoo screen proposal reviewed without implementation

- Updated: `2026-10-31 15:02 PDT`
- Agent: `Codex`
- Branch: `codex/karoo-receiver-capabilities`
- Head before documentation: `d70e8f2 docs: answer phone BLE record identity handshake and receipt questions`
- Worktree: clean before documentation; only new review, LATEST and this archive changed.

## Outcome

Read own LATEST and fetched origin/main6f7d3c7. Acted on the Karoo-specific2026-10-31 request only:
read-only feasibility review of proposal fd15e95 on origin/claude/gritmap-karoo-screens-b47518.
Full report: `docs/KAROO_SCREEN_FEASIBILITY_REVIEW.md`. Redesign NOT approved; nothing built.
Other Open Segments/web/account instructions in the shared coordinator handoff belong to the
separate web work and were not executed from this Karoo chat/branch.

## Changed

Documentation only. Runtime review basis remains eac155f; exact approved74 APK unchanged.
Kept both pacing IDs in the migration recommendation; no app, Figma or source/spec-branch edits.

## Verified

Read the Markdown proposal with git show (Figma itself not inspected); read current KarooFieldLayout,
LivePacingDataType, CombinedDataTypes, SDK ViewConfig, XML registrations/wrappers, LiveUiState,
renderer font helpers and cardiac validity/threshold paths. Static review only; no new tests,
compilation, screenshots, font measurement, ppi validation or physical readability claim.
Prior271/219 tests/lint are historical and not rerun for documentation-only work.

## Findings

- Exact view sizes cannot be derived offline: grid60 is logical spans, runtime viewSize is pixels;
  synthetic12px/row tests and mockup480/240 widths are not measurements. Only six threshold ranges
  are known. LARGE starts at250px, not620. Fixed strip/type sizes overflow shorter categories;
  Profile's8dp wrapper/chrome/graph fractions also reduce available content.
- Keep extension gritmap-live-pacing and both IDs pacing-coach/live-pacing registered, render one
  merged presentation through both, preserve page placements and apply1Hz throttling consistently.
  Existing double placements will duplicate the new field; no silent deletion or assumed hide API.
- Condensed font may differ; future fit must measure advances/font metrics, real content area,
  edge marker clearance, long signed values/units, and light-mode contrast. SMALL dropping both
  label and percent unit conflicts with its spec; white chart marks need light-mode contrast.
- Existing state covers the main metrics; no new registered Karoo data type/stream needed.
  Strict sensor last-valid retention may need a presentation cache/state freshness fields.
  Time-anchored pacing would need a future wire contract, not reinterpret current even-pace ring.
- Proposal changes cardiac signed thresholds/negative semantics and180/360s disclosure; these
  are not existing behaviors. ConstraintConflict is not all unreachable goals; proposed2s UI
  deadband differs from existing3s replanner. W' bands are still provisional decisions.

## External state

No device query, install, sender build, transfer, ride, publication, Figma edit or APK rebuild.
Remote phone sender branch is a5a0daa; its device-check doc still says native module was not built
or radio-validated at that recorded point. No new Jason sender-readiness confirmation in this chat.
Do not infer actual current phone/device state from these historical branch notes. Exact74 approval
persists, subject to coordinator's newer no-install/read-only instruction now and sender/readiness gates.
Public73 last owner-confirmed; no fresh device state claim. Room4/fallback75 hazard unchanged.

## Goal alignment

Owner-requested proposal feasibility only, preserving GOALS beta loop and Karoo responsibilities.
No redesign implementation, physiology rule change, public flag enablement or Needle work.

## Hazards and blockers

Unanswered palette/verdicts/density/ring decisions, unknown view dimensions and no ride legibility
validation. Spec alone does not approve a build. Saturday-or-later Bluetooth diagnostic74 ride
milestone still precedes redesign build; a viewSize logging build needs its own exact approval.
No Wi-Fi substitution, cross-chat message or new implementation authorized by this review.

## Next safe action

Coordinator/Jason reviews the feasibility report and resolves the pending spec decisions. Await
explicit readiness/go-ahead for the approved Bluetooth74 diagnostic sequence; do not install during
this read-only review. After the ride milestone and design approval, implement dual-ID merged rendering
with measured content-fit rules; approve any separate logging candidate first.
