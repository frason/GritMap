# Karoo data-field redesign: specs for Codex

Status: **design proposal, not approved for build.** Owner of decisions: Jason. Written by the
GritMap Karoo Screens design session. Nothing under `apps/karoo` was changed. All numbers in the
designs are made-up sample values.

Figma: file `cyaMDDfLBKFc4NNK1SUUnb`, page **Karoo** (phone pages untouched).

| Section | Node |
|---|---|
| Design system | `306:204` |
| Pacing Coach | `305:204` |
| Pacing Profile | `305:634` |
| Performance | `304:204` |
| Cardiac Drift | `305:1101` |
| Power Balance | `305:1517` |

Each screen section holds 6 field sizes x 4 states in dark mode, a light-mode (bright sun) row,
and true-physical-scale copies. Colours are variables in the `Karoo/Color` collection (Dark and
Light modes); text styles are `Karoo/*`.

## 1. Decisions needed from Jason before anything is built

1. **Colour meaning changes for existing riders.** Today REST is green, HOLD is blue, PUSH is red.
   The phone's intensity palette is rest teal, hold green, push orange, max red. The proposal
   follows the phone: HOLD green, PUSH orange, REST/EASE blue, red only for warnings. Beta riders
   will have to relearn HOLD and PUSH.
2. **Pacing Coach and Pacing Profile overlap.** Both answer "what effort now". I split the jobs
   (Coach: target now; Profile: what changes ahead), but it may be better to merge them into one
   field. Your call.
3. **New verdict thresholds** I had to invent because the code has none (all marked PROPOSED
   below): Performance ON GOAL deadband, Power Balance OK/LOW/EMPTY bands.
4. **Pixel sizes are representative, not measured.** The code has only height breakpoints and a
   test value of 12 px per grid row. Before final pixel values, Codex should log
   `config.viewSize` on a real Karoo 3 for each field size.
5. **Minimum sizes are derived from pixel density, not tested on a bike.** 291 ppi is my recollection
   of the Karoo 3 spec (3.2 in, 480x800). Please confirm, and validate the 40 px rule on a ride.

No design needs a new data field, and nothing changes the phone/Karoo split.

## 2. Design system

### Colour = direction of the action
| State | Fill (black text) | Ink on dark page | Ink on light page | Icon | Meaning |
|---|---|---|---|---|---|
| EASE | #4CC3FF | #4CC3FF | #0A5F94 | down triangle | Ease off, you have slack: REST, AHEAD of goal, power over target |
| ON | #2FD27A | #2FD27A | #13703C | equals | On plan: HOLD, STABLE, ON PLAN |
| MORE | #FF9A1F | #FF9A1F | #A24F00 | up triangle | Put more in: PUSH, BEHIND, power under target |
| CAUTION | #FFD60A | #FFD60A | #7A5C00 | triangle with ! | Heads-up: DRIFTING, W' LOW, REPLAN LIMITED |
| WARN | #FF5A4F | #FF6F65 | #B3261E | octagon with x | Act now or data broken: HIGH, NO POWER, NO GPS, near-empty W' |
| NEUTRAL | #2A2F38 dark / #E1E4EA light | | | none | No data, waiting |

Surfaces (dark/light): bg #0B0D10 / #F4F5F7, surface #1B1F25 / #FFFFFF, surface-2 #2A2F38 /
#E1E4EA, text #FFFFFF / #0B0D10, text-2 #C9CED6 / #3A414D, divider #6B7380 / #7A828E.

Rules: colour is never the only cue (word + icon always); text on a state fill is always black;
red is only for WARN; only the verdict strip, the hero and chart bands carry state colour.

Contrast (computed, WCAG): black on fills 6.3 to 13.8:1; ink on dark 7.1 to 13.8:1; ink on light
5.3 to 6.3:1; text-2 12.3:1 dark and 9.4:1 light; divider 4.1:1.

### Type scale (Roboto Condensed Bold, all caps except units)
| Style | px | cap height | Use |
|---|---|---|---|
| Hero XL | 168 | 10.4 mm | the one number, LARGE |
| Hero L | 120 | 7.5 mm | hero in MEDIUM_WIDE, NARROW, MEDIUM |
| Hero M | 96 | 6.0 mm | hero in SMALL_WIDE, or when digits are wide |
| Hero S | 80 | 5.0 mm | hero in SMALL (minimum hero) |
| Key L | 64 | 4.0 mm | verdict word, LARGE |
| Key M | 48 | 3.0 mm | support line, verdict word, card values |
| Key S | 40 | 2.5 mm | **minimum for anything read mid-effort** |
| Reference | 28 | 1.7 mm | **absolute minimum**, labels read at rest only |

Today's renderers use 17 to 24 px for axis labels, split labels, captions and card labels (cap
1.1 to 1.5 mm). The new floor is 28 px, and nothing the rider must act on is below 40 px.

### Spacing (8 px grid)
Margin 16, block gap 8, card padding 12, card radius 12, strip radius 16, strip height 88 (84 in
MEDIUM_WIDE, 72 in MEDIUM), card height 68. Slot order on every screen: title row, verdict
strip, label, hero (+ unit), support line, chart, two cards.

### Field layouts (from `KarooFieldLayout.kt`) and what each keeps
| Layout | Rule in code | Drawn at | Keeps | Drops |
|---|---|---|---|---|
| LARGE | full width, height >= 250 | 480x620 | everything | nothing |
| MEDIUM_WIDE | full width, 160 to 249 | 480x200 | label, hero + unit, strip, short support | title row, chart, cards, long support |
| SMALL_WIDE | full width, < 160 | 480x120 | hero, strip | label, unit, support |
| NARROW | half width, height >= 600 | 240x620 | strip, label, hero, short support, chart, 1 card | title row, context, 2nd card, row distances |
| MEDIUM | half width, 200 to 599 | 240x320 | strip, label, hero, short support | title row, chart, cards |
| SMALL | half width, < 200 | 240x120 | hero in a state-coloured block + icon | everything else |

Narrow/wide split is `gridSize.first >= 50` of 60 columns; I assumed 480 and 240 px widths.

### Shared behaviour
- Verdict strip: same slot, same height rules, state fill, black icon + word, word shrinks
  Key L, Key M, Key S to fit. If the icon does not fit it is dropped only as a last resort
  (not needed in the final designs).
- Hero: state ink colour; unit in text-2 beside it, dropped first when it does not fit.
- Short words for tight layouts: NO POWER becomes NO PWR, DRIFTING becomes DRIFT, ON PLAN becomes
  OK, EASE NOW becomes EASE, REPLAN LIMITED becomes LIMITED.
- Units follow the rider's existing unit setting (`distanceUnitSystem`, `elevationUnitSystem`).
  Labels: FT/MI or M/KM, never mixed case.
- Sensor-loss rule (all screens): lost power shows NO POWER, lost heart rate NO HR, lost GPS NO GPS,
  as a WARN strip; the hero keeps its last valid value in neutral ink (see Coach warning frame).
- Light mode: same layout, tokens switch mode. Fixes today's fixed dark card fills.

## 3. Per-screen specs

Data sources are `LiveUiState` fields (`ui/state/LiveUiState.kt`). Power, heart rate, cadence,
speed and elevation come from Karoo streams (`OnStreamState`) in `LiveSegmentService`; the 3 s
rolling power is computed there from recent samples. The data-field views re-render on every
`LiveUiState` publish; the Pacing Profile view is throttled to at most one update per second
(`MIN_UPDATE_INTERVAL_MS`). The exact stream sample rate is set by Karoo, and I did not verify it
in code, so treat "about 1 Hz" as an assumption.

### 3.1 Pacing Coach
**Purpose:** tell me what effort to ride right now.

Hero: target watts for the current section (`recommendation.targetPowerWatts`, unit W).
Supporting: `YOU 276 W  ·  -4 W` (`rollingPowerWatts3s`, `powerDeltaWatts`). Secondary (LARGE):
the next two sections as outline rows with a state-coloured left bar (`pacingZones`, distance from
`nextPacingZone`), plus cards LEFT (`totalDistanceMeters - progressMeters`) and SECT (current
index / count from `currentZoneIndex`). Strip: HOLD (ON), PUSH (MORE), REST (EASE) from the
current zone's `effort`.

| State | Strip | Label | Hero | Support (LARGE / short) |
|---|---|---|---|---|
| Normal | ON, HOLD | TARGET | 280 W | YOU 276 W · -4 W / YOU 276 W |
| Hard effort | MORE, PUSH | TARGET | 300 W | YOU 255 W · -45 W / YOU 255 W |
| No data | NEUTRAL, NO PLAN | TARGET | -- | WAITING FOR PLAN / WAITING |
| Warning | WARN, NO POWER (NO PWR) | TARGET | 280, neutral ink | POWER METER NOT FOUND / NO METER |

Dropped at small sizes: next-sections list and cards below LARGE; support line in SMALL_WIDE; all
but hero + icon in SMALL. Colours: strip and hero by state as above, rows' bars by each section's
effort, NEUTRAL when unknown. Warning trigger: `sensorStatus.power == false`.

**Before:** five stacked rows with fading 9 to 11 px text, an actual-watts number competing with
the target, and "COLLECTING WORK", work-fill and white target-work line that need explaining.
Hero was ambiguous. **After:** one target number, one verdict. **Why:** the rider reads one
number and one word, then the gap. The work-fill idea is cut from the glance view (see wins).

### 3.2 Pacing Profile
**Purpose:** show me what changes ahead on the climb.

Hero: distance to the next effort change (`distanceToNextZoneMeters`, FT or M), ink colour is the
NEXT effort's state. Strip shows the CURRENT effort. Supporting: `THEN PUSH 300 W` (`nextPacingZone`).
Secondary (LARGE): terrain chart (`elevationProfile`, section bands from `pacingZones`, white dot
at `progressFraction`), cards YOU (`rollingPowerWatts3s`) and TARGET (`recommendation`).
**Pacing dot (added on Jason's request):** the terrain chart shows two markers. A solid white dot
is you (`progressFraction`). An open white ring, 36 px with a 6 px stroke and no fill, is the
pacing dot: where the plan says you should be right now (`targetProgressMeters`). Ring ahead of
the dot means behind plan; ring behind it means ahead. It is drawn in LARGE and NARROW only, and
it is hidden when `targetProgressMeters` is null (needs `plannedFinishSeconds` and
`elapsedAttemptSeconds`). Until the phone sends time anchors, that position is the
distance-proportional fallback schedule documented on `targetProgressMeters`, so it is an
even-pace estimate, not a per-section plan. Sample frames: normal has the ring just behind the
dot (slightly ahead of plan), hard effort has the ring ahead (behind plan), matching the
Performance frames. Open question: when the plan has real section times, should the ring follow
them? That needs the phone/Karoo plan contract, so it is not assumed here.

Note: at LARGE the TARGET card label is `GOAL`; keep one word across screens, `TARGET`, if the
card is widened.

| State | Strip | Label | Hero | Support |
|---|---|---|---|---|
| Normal | ON, HOLD | TO PUSH | 56 FT (MORE ink) | THEN PUSH 300 W |
| Hard effort | MORE, PUSH | TO HOLD | 120 FT (ON ink) | THEN HOLD 280 W |
| No data | NEUTRAL, NO PLAN | NEXT CHANGE | -- | WAITING FOR PLAN |
| Warning | WARN, NO GPS | NEXT CHANGE | -- | POSITION LOST |

Dropped: chart and cards below LARGE (NARROW keeps chart and one card). Warning trigger:
`sensorStatus.gps == false`. Also needs `hasCompleteElevationProfile`; without terrain, show the
hero and strip only.

**Before:** perspective funnel, TARGET and ACTUAL as equal giant cards, tiny elevation axis
(a 3D view that is hard to read in under a second). **After:** the next change as one number over
a flat, colour-banded terrain chart. **Why:** distance to the change is the glanceable fact; the
funnel did not carry extra decision value.

### 3.2b Merge option: one "Pacing" field (not decided)
Figma node `322:204`, for comparison with 3.1 and 3.2. Same grid and states. LARGE: verdict strip
(current effort), TARGET hero, `YOU xxx W · gap` support line, terrain chart with the solid "you"
dot and open pacing ring, and one full-width "next change" row (state bar, `HOLD 280 W`,
`IN 120 FT`). NARROW keeps the chart and a shortened next row. MEDIUM_WIDE and below are identical
to Pacing Coach. Cost versus keeping both fields: the distance to the next change is no longer a
hero (it becomes a row), and the narrow chart is only 208 px wide, so the you dot and the pacing
ring overlap when the gap is small. Warning frame shows NO POWER; a lost GPS would show NO GPS
with neutral chart bands.

### 3.3 Performance
**Purpose:** am I ahead of or behind my goal time?

Hero: signed gap `plannedFinishSeconds - (replanEstimate.estimatedFinishSeconds or
predictedFinishSeconds)` in seconds. Supporting: `FINISH 2:48 · GOAL 2:40`. Secondary (LARGE):
time-bank bar (-60 to +60 s, one marker, text BEHIND/AHEAD), cards DONE (`progressFraction`) and
LAST ¼ (last of `segmentSplitDeltasSeconds`).

| State | Strip | Label | Hero | Support |
|---|---|---|---|---|
| Normal | EASE, AHEAD | VS GOAL | +6 SEC | FINISH 2:34 · GOAL 2:40 |
| Hard effort | MORE, BEHIND | VS GOAL | -8 SEC | FINISH 2:48 · GOAL 2:40 |
| No data | NEUTRAL, NO GOAL | VS GOAL | -- | WAITING FOR GOAL |
| Warning | CAUTION, REPLAN LIMITED (LIMITED) | BEST FINISH | 2:52 | GOAL 2:40 OUT OF REACH |

PROPOSED: add an ON GOAL verdict (ON, "ON GOAL") when |gap| <= 2 s so the strip does not flicker
between AHEAD and BEHIND. The code today treats gap >= 0 as improving. The warning state follows
`replanEstimate.constraintConflict`. Dropped: bar and cards below LARGE; adherence % is removed
entirely (not actionable); the 5-row split chart is cut (last quarter only, as a card).

**Before:** the gap "-8s" appeared four times (banner, goal line, bar, knob), predicted time was
the hero, split chart text was 17 to 18 px, red meant behind and push at once. **After:** the gap
once as hero, one marker. **Why:** the decision is the gap; the finish time is support.

### 3.4 Cardiac Drift
**Purpose:** is my heart-rate cost creeping up at steady power?

Hero: `cardiacDriftPct` (signed, 1 decimal, %). Verdict by the renderer's existing bands:
below 3% STABLE (ON), 3 to 5% DRIFTING (CAUTION), above 5% HIGH (WARN). Supporting: POWER STEADY
(`cardiacDriftPowerSteady`) or `HR UP, POWER STEADY` when HIGH. Secondary (LARGE): drift sparkline
(`cardiacDriftHistory` over three bands, white line and dot), cards HR COST
(`100 / cardiacEfficiencyWattsPerBpm`, bpm per 100 W) and PAIRED (`cardiacDriftPairedPct`).
Context top-right: valid time (`cardiacDriftValidSeconds`).

| State | Strip | Label | Hero | Support |
|---|---|---|---|---|
| Normal | ON, STABLE | HR DRIFT | +1.8% | POWER STEADY |
| Hard effort | CAUTION, DRIFTING (DRIFT) | HR DRIFT | +4.2% | POWER STEADY |
| No data | NEUTRAL, BASELINE | HR DRIFT | -- | COLLECTING BASELINE |
| Warning | WARN, HIGH | HR DRIFT | +6.8% | HR UP, POWER STEADY / EASE OFF |

Baseline is frozen after 180 s of paired power and HR (`CardiacDriftTracker`), so No data copy is
shown until then. Negative drift stays ON green (efficiency improved). Dropped: sparkline and
cards below LARGE. In SMALL the % sign is dropped (label carries the unit).

**Before:** a blue "HOLD • DRIFT HIGH" banner mixed a pacing action with a cardiac warning and
used calm blue for a bad state; a dense efficiency-index chart had 20 to 24 px axis labels.
**After:** drift % is the hero, its colour and word agree. **Why:** one job, one verdict. The
pacing action belongs to the pacing screens.

### 3.5 Power Balance (W')
**Purpose:** how much hard-effort energy do I have left?

Hero: `wPrime.actualRemainingPct` (%), always labelled `W' LEFT · EST` because W' is estimated
from FTP (`WPrimeParameters.estimatedFromFtp`, estimated flag true). Supporting:
`PLAN 91% · FINISH 12%` (`plannedRemainingPct`, `projectedFinishPct`). Secondary (LARGE):
battery bar with plan tick (`LINE = PLAN`), cards PLAN and FINISH.

| State | Strip | Label | Hero | Support |
|---|---|---|---|---|
| Normal | ON, ON PLAN (OK) | W' LEFT · EST | 85% | PLAN 91% · FINISH 12% |
| Hard effort | CAUTION, LOW | W' LEFT · EST | 38% | PLAN 52% · FINISH 4% |
| No data | NEUTRAL, NO DATA | W' LEFT · EST | -- | WAITING FOR POWER |
| Warning | WARN, EASE NOW (EASE) | W' LEFT · EST | 9% | PLAN 40% · FINISH 0% |

PROPOSED verdict bands from `projectedFinishPct`: >= 10 ON PLAN; 3 to under 10 LOW; under 3 or
now under 10% EASE NOW. Not in code today, needs Jason's approval. Dropped: battery and cards
below LARGE; PLAN/RIDE nodes, pipes and recovery cards are removed.

**Before:** PLAN and RIDE circles with pipes, a battery, "PROJECTED FINISH 12%", two recovery cards
with 20 px text, and a "5% BELOW" banner whose meaning was unclear. **After:** battery fill is
the hero, the plan tick is the only comparison. **Why:** the recovery watts are not actionable
mid-effort; the diagram metaphor was decoration.

## 4. Prioritised readability wins (ship in this order)

1. **Raise all mid-effort text to at least 40 px and delete anything under 28 px** (axis labels,
   split labels, captions, card labels). Cheapest, every screen. 17 px is 1.1 mm tall today.
2. **One hero per screen at 96 to 168 px** (Coach target W, Performance gap, Drift %, W' %,
   Profile distance), instead of several competing numbers.
3. **One meaning per colour** (section 2): red only for warnings, PUSH orange, HOLD green,
   black text on every state fill, and a word + icon on every verdict. Fixes a colour-blindness
   gap and removes the red-means-push-and-behind clash.
4. **Remove duplicates and decoration**: "-8s" shown four times, W' PLAN/RIDE nodes, Profile
   funnel, "COLLECTING WORK" caption, adherence %.
5. **Real small layouts**: SMALL and SMALL_WIDE show a hero and a verdict only, never a shrunken
   dashboard.
6. **Fix light mode** (fixed dark card fills with palette text colour); use surface tokens.
7. **Cut the Coach 5-row stack to verdict + hero + next two rows**, and drop the work-fill/target-
   work line from the glance view.
8. **Honest estimates**: always show EST on W'.

## 5. Open questions and not verified

- Real `viewSize` per layout on a Karoo 3 (see section 1).
- Karoo 3 ppi (291 assumed) and the 40 px rule on an actual ride.
- Roboto Condensed Bold is what the Figma frames use because the renderers ask for
  `sans-serif-condensed` bold; on-device the actual typeface may differ slightly in width. Text
  widths were checked in Figma only; Codex must re-check clipping on device.
- Stream sample rate of power/HR/elevation (assumed about 1 Hz).
- Whether the existing H10 Cardiac field needs the same treatment (not drawn; no screenshot was
  provided).
