# Real Karoo Matcher Validation

## Scope

This spike exercised the merged FIT parser and directed segment matcher together without modifying either implementation. The runnable harness is `scripts/validate-real-matcher.ts`; it accepts optional reference and comparison FIT paths and defaults to the two committed Karoo fixtures.

The script filters parsed records to points containing latitude, longitude, and ride distance. It selects the August 2 ride range from 58,200 m through 60,800 m, subtracts the first selected point's full-ride distance so the segment starts at zero, and linearly resamples the directed reference polyline at 10-meter intervals.

No specified thresholds were changed:

- Corridor: 30 meters
- Automatic-accept coverage: 90%
- Matcher GPS-gap threshold: 30 seconds

## Results

The August 2 fixture produced 11,004 parsed records and 10,964 GPS+distance points. The August 9 fixture produced 8,592 parsed records and 8,563 GPS+distance points.

The resulting reference segment contains 261 points and is 2,591.25 meters long.

### Self-match: August 2 reference segment against August 2 ride

| Signal | Result |
|---|---:|
| Decision | `accept` |
| Coverage | 100% |
| Maximum deviation | 0.4008 m |
| Maximum backward progress | 0 m |
| Maximum GPS gap | 1,000 ms |
| Matched filtered-point range | 8,440–8,875 |
| Reasons | none |

This satisfies the required real-fixture sanity check. The small nonzero deviation is expected because the reference was resampled between source records rather than retaining every original ride point.

### Cross-ride: August 2 reference segment against August 9 ride

| Signal | Result |
|---|---:|
| Decision | `accept` |
| Coverage | 100% |
| Maximum deviation | 2.4074 m |
| Maximum backward progress | 0 m |
| Maximum GPS gap | 1,000 ms |
| Matched filtered-point range | 1,756–2,165 |
| Reasons | none |

The rides are not identical overall, but they contain a clean same-direction traversal of this shared 2.59 km stretch. The earlier estimate that only about 14% of whole-ride GPS points overlap does not prevent a strong segment-level match; it demonstrates why GritMap should locate segments inside rides instead of comparing complete routes.

## Observations for future tuning

- Real Karoo records with missing GPS were safely removed before matching; neither module crashed.
- Both matching traversals had one-second maximum sample gaps, far below the fixed 30-second borderline threshold.
- Cross-ride GPS noise remained well inside the 30-meter corridor, with only 2.41 meters maximum deviation for this segment.
- This sample provides no evidence that the 30-meter corridor, 90% coverage threshold, or 30-second gap threshold should change.
- The validation is positive but limited to one shared segment across two rides from the same device. More varied devices, urban multipath, tree cover, and recorded GPS gaps may still reveal threshold edge cases later.
- On the validation machine, parsing both rides, building the segment, and running both matches completed in roughly 0.45 seconds. This is a baseline observation, not a formal performance guarantee.

## Running the validation

After installing `@garmin/fitsdk@21.213.0`:

```sh
node scripts/validate-real-matcher.ts
```

Or supply two FIT paths explicitly:

```sh
node scripts/validate-real-matcher.ts reference.fit comparison.fit
```
