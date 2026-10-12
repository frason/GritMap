# Karoo large-field typography and density audit

Updated: 2026-10-09

## Scope and reference

This pass used the supplied `Pacing_profile.png` large-field screenshot as the reference hierarchy
for four other large visual fields:

- `Cardiac_drift.png`
- `Power_balance.png`
- `Segment_performance.png`
- `Pacing_coach.png`

The intended hierarchy is: stable field identity and progress in the top row, one dominant action
banner, large primary values, readable supporting labels, and no low-value duplicate sentence.
Small and medium compositions were not changed. Matching algorithms, pacing calculations, cardiac
metrics, W′ calculations, and segment-performance calculations were not changed.

## Changes by field

### GM Pacing Profile

- Changed only the top-left title from the current segment name (which truncated unpredictably) to
  the stable field identity `GM PACING PROFILE`.
- Did not change its route, elevation chart, banner, metrics, colors, spacing, or calculations.

### GM Cardiac Drift

- Expanded the ambiguous `GM CARDIAC` title to `GM CARDIAC DRIFT`.
- Balanced the header pair at 5.2% and 5.0% of field width so the field name and valid-time context
  read like the Pacing Profile header without colliding.
- Retained its already-matching hierarchy: large action banner, two primary metric cards, trust
  banner, efficiency chart, optional H10 strip, and confidence footer.

### GM Power Balance

- Increased the field title from 5.2% width (22–27 px clamp) to 6.1% (27–32 px).
- Increased progress from 4.7% width (20–25 px) to 5.2% (24–29 px).
- Increased projected-finish text from 5.0% width (24–29 px) to 5.8% (27–32 px).
- Increased energy-status text from 3.7% width (20–26 px) to 5.0% (23–29 px).
- Increased lower metric labels from 21 px to 23 px and values from 35 px to 40 px.
- Preserved the battery, plan/ride nodes, flow paths, arrows, action logic, and metric order.

### GM Segment Performance

- Shortened the header from `GM SEGMENT PERFORMANCE` to `GM PERFORMANCE`, allowing the field name
  to grow from 4.8% to 6.1% of width without colliding with progress.
- Increased progress from 4.3% to 5.0% of width.
- Increased the action/result banner from 6.1% to 6.8% of width.
- Removed the redundant words `EXPECTED FINISH` beneath the already-prominent expected-finish
  value. The line now carries only `GOAL … • result`, and grows from 3.5% to 4.4% of width.
- Increased the split-chart heading from 4.3% to 5.2% of width.
- Increased bottom-card values from 35 px to 40 px and labels from 17 px to 20 px.
- Preserved predicted finish, goal comparison, time bank, split chart, completion, and adherence.

### GM Pacing Coach

- Replaced the changing segment-name header with stable `GM PACING COACH` at 6.1% of width.
- Added progress/distance in the top-right at 5.0% of width, matching the Pacing Profile header
  structure and using the Karoo unit preference.
- Tightened row spacing by changing the stack divisor from `visible slots + 0.35` to `+ 0.15`.
- Increased row height from 82% to 90% of its slot (capped at 20.5% of field height).
- Increased current/context label scale from 27%/23% of row height to 30%/25%.
- Increased target text from 82% to 90% of the label size and actual power from 105% to 115%.
- Preserved the 20-section demo, future/current/past ordering, opacity depth, vertical time fill,
  target marker, actual-power behavior, and section transition animation.

## Verification artifacts

Renderer tests write locally inspectable 480 px previews under:

- `apps/karoo/app/build/reports/cardiac-drift-preview/large.png`
- `apps/karoo/app/build/reports/power-balance-preview/large.png`
- `apps/karoo/app/build/reports/segment-performance-preview/large-pre-split.png`
- `apps/karoo/app/build/reports/pacing-coach-preview.png`

These build artifacts are intentionally not source-controlled. The Pacing Profile title is covered
by `KarooFieldLayoutTest` because its header is a `RemoteViews` text element rather than part of the
profile bitmap.
