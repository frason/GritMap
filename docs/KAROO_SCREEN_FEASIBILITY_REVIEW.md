# Karoo screen proposal: read-only feasibility review

2026-10-31. Review of `docs/KAROO_SCREEN_SPECS.md` at
`origin/claude/gritmap-karoo-screens-b47518` / fd15e95, against receiver source eac155f.
**Proposal only, not approved to build.** No app code, device, logging build or Figma changed.
This review uses the repository Markdown spec, not a new inspection of the Figma frames.

The merged Pacing field is feasible with current telemetry. Keep both existing pacing IDs;
no new registered Karoo data type is necessary. Fixed mockup dimensions/type sizes are not
ready for implementation, and some claimed existing behaviors need correction below.

## Sizes: what is actually known without a device

Vendored SDK `apps/karoo/vendor/karoo-ext/src/main/kotlin/io/hammerhead/karooext/models/ViewConfig.kt`
defines `viewSize` as actual configured view pixels, `gridSize` as spans in a60-unit grid,
and `textSize` separately in SP. It supplies no pixels-per-row formula, usable screen dimensions,
physical density or complete lookup table. Tests using480x(rows*12) or600-wide views are synthetic,
not device measurements. Screen resolution would not establish field size after system chrome/borders.
The spec's480/240 widths,620/320/200/120 heights and291ppi remain unverified assumptions.
In particular, less than50 columns is not necessarily half-width;50 or more is not necessarily480px.

`KarooFieldLayout.kt` currently guarantees only this classification:

| Layout | Column span | Runtime view height in pixels |
|---|---|---|
| LARGE | >=50 | >=250 |
| MEDIUM_WIDE | >=50 | 160–249 |
| SMALL_WIDE | >=50 | <160 |
| NARROW | <50 | >=600 |
| MEDIUM | <50 | 200–599 |
| SMALL | <50 | <200 |

The spec's representative sizes select the named branches, but a LARGE field can be250px tall,
not620; MEDIUM can be200px, not320; SMALL_WIDE can be shorter than120. Full large composition
cannot follow classification alone: future implementation needs measured-content fit/fallback
within each branch, respecting the approved minimum readable type size rather than shrinking everything.

Existing Profile RemoteViews adds8dp padding, optional SP header/badge/footer, an ImageView with
fitCenter, and bitmap graph fractions (NARROW0.68, LARGE1.0). Therefore configured viewSize is
not always the image's drawable content area. Coach uses a full-size ImageView with fitCenter.
Bitmap PX, layout DP and text SP are not interchangeable. Before future final layout, measure
actual image allocation/borders/font metrics; do not multiply every row by12 or use panel PPI as
Android density. No exact field pixel sizes or physical cap heights can be certified here.

## Compatible migration plan (after approval only)

- Preserve extension ID `gritmap-live-pacing`, type IDs `pacing-coach` and `live-pacing`, both
  registrations in `res/xml/karoo_extension_info.xml`, and both service DataType instances.
  `LivePacingDataType.kt` actually declares PacingProfileDataType; its retained ID is `live-pacing`.
- Route both adapters through one shared merged-Pacing presentation/bitmap renderer and the same
  LiveUiState. Keep a consistent at-most1Hz emission policy; Profile already has1000ms throttling,
  whereas StateGraphicDataType (Coach) currently emits on each state publish.
- Avoid putting the new layout inside the old Profile header/badge/footer and then scaling it.
  After approval, give both adapters the same full-field image wrapper/content-sizing contract;
  remove duplicate chrome through presentation only, leaving existing rider page placements intact.
- Label the preferred picker entry GM Pacing and clearly identify the retained alias (final wording
  needs owner/design agreement). If both were placed, both slots will now show the same layout;
  do not silently delete/rearrange the rider's page. Do not assume the SDK offers a safe hide-from-picker
  flag; keep both discoverable until that is verified. No third pacing ID or saved-page migration required.
- When authorized later, test both IDs, preview/live, light/dark and boundary heights159/160/249/250,
  199/200/599/600 plus narrow widths and text extremes. No implementation/test runs in this review.

## Clipping and visual risks

1. The spec's shared88px strip plus16px top/bottom margins already consumes all120px of a
   SMALL_WIDE sample, before its hero. MEDIUM_WIDE200 minus margins32, strip84 and even two8px
   gaps leaves68px for label, HeroL and support combined. Figma font size120 is not cap height,
   but this budget still demands a separate tight composition; arbitrary shrinking below40px
   is not the stated readability goal. LARGE250 and MEDIUM200 need similar fallbacks.
2. Typeface.create(sans-serif-condensed,BOLD) does not prove the exact Figma Roboto Condensed
   face/advance widths. Existing Canvas helpers often draw fixed-size strings without clipping
   guards, although Profile has some measured-fit badges. Future rendering needs Paint.measureText
   and fontMetrics for actual strings, sign, decimal, unit, icon and spacing. Shorten words/drop
   optional units/context first; preserve the action word/icon and do not solve by horizontal distortion.
3. Stress cases include999W, long durations, signed gaps, negative/large drift,100.0%, metric/imperial
   distances and REPLAN LIMITED. Use font ascent/descent for top/bottom clipping, not just width.
   In SMALL the dropped % must remain identifiable elsewhere; its description says the label carries
   units while the size table drops every label—resolve that contradiction before build.
4. At208px chart width, the36px open ring and rider dot can overlap. Keep both discernible with
   layering/stroke/outline and edge inset of at least the marker radius, rather than altering the
   data positions. Do not clip a ring at0/100% or suggest a precise gap from overlapping markers.
5. Light-mode terrain line/white dots are not reliably visible on a white/light surface. Specify
   contrast-aware strokes/outlines and tint values, including low-opacity section bands. The fixed
   white Figma line should not be copied literally into a light background without checking contrast.

## Data availability and semantic corrections

No new registered data field or sensor stream is needed for the four proposed views. Current
LiveUiState already supplies recommendation target, rolling3s power/delta, zones/next zone/distance,
progress/elevation/completeness, finish goal/prediction/replan estimate, split deltas, drift/history/
efficiency/paired/steady/valid-time, W' actual/planned/projected/estimated and sensor status.
Presentation can derive labels/verdicts once their rules are approved. Keep null/invalid/zero
cases explicit (especially100/efficiency, missing prediction and projected W' null).

- **Pacing ring:** targetProgressMeters is elapsed/goal*distance clamped to the route, not a
  per-section timing schedule and not the work-fill target line. The dot can be implemented now
  as an explicitly even-pace estimate if Jason approves that pending choice. True section timing
  requires a future phone/Karoo contract with time anchors; do not imply new fields exist today.
- **Last valid value on sensor loss:** LiveUiState does not provide a general last-valid timestamp
  and value for every sensor. A renderer can retain a value locally, but a recreated view cannot
  recover that cache. Define per-attempt freshness/expiry/reset and field-specific warning priority;
  a future presentation cache or state property may be needed for strict semantics. Never make an
  old neutral number look like current telemetry. This is not a need for a new registered DataType.
- **Cardiac Drift proposal is not just a reskin:** current renderer uses abs(drift)<3 STABLE,
  abs(drift)<5 WATCH, else HIGH, so exactly5 is HIGH and a large negative value is not always green.
  Current state distinguishes HR_RESPONSE below180 valid seconds/no drift, EMERGING_DRIFT180–359,
  and CARDIAC_DRIFT from360, with missing HR/power gates. The proposal's signed bands, negative=ON,
  changed WATCH wording, and baseline-only display until180 alter behavior. Retain the current
  validity/steadiness disclosure unless Jason explicitly approves a physiology presentation change.
  A sample HIGH value does not establish HR UP, POWER STEADY when the actual steady flag is false.
- **Performance:** constraintConflict means safe target adjustment could not be produced; it is
  not synonymous with every unreachable goal. goalReachable and gapSeconds already exist, and
  a goal can be unreachable with constraintConflict=false. Distinguish adjustment limited from
  estimated goal out of reach; label estimates honestly. Do not add a second2s deadband silently:
  replanner already uses3s; proposed UI2s threshold must stay a separate named decision if approved.
- **Power Balance:** current WPrimeState has actual/planned/projected percentages and estimated,
  so no extra physiology source is required. New10%/3% verdicts are decisions, not current receiver
  guarantees or safety thresholds. Unknown projected finish is not zero or an automatic OK state.
- Colour semantics change existing learned meanings. HOLD/PUSH/EASE palette, thresholds, real
  sizing and the even-pace ring choice remain open. The merge direction is decided; the rest of
  the proposal is not blanket implementation approval. H10 Cardiac remains outside these four specs.

## Safe next step

Return these findings to coordinator/Jason. Keep apps/karoo and the exact approved diagnostic74
untouched; no device access, build, logging APK or installation. Await the unresolved design
answers and Saturday-or-later Bluetooth diagnostic ride milestone before any redesign build.
Any separate viewSize logging build needs approval of its own exact APK. Existing approval is
for diagnostic74 only, not a redesign or logging substitute. Public73 stays unchanged.
