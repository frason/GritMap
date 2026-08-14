# Matcher confidence and result persistence

## What was built

`matchSegment` now emits the diagnostics needed by persistence for every accept,
borderline, and reject result: matcher version, confidence fraction, median deviation,
and GPS gap count. `MATCHER_VERSION` is `2` because the matcher output and scoring
semantics changed from the original implementation.

`persistMatchCandidate` writes accepted and borderline candidates to
`segment_attempts` and `match_diagnostics` in one `BEGIN IMMEDIATE` transaction. Rejects
return before any SQL is executed. Before inserting, it looks for any inclusive point-range
overlap with the same segment and ride. If one exists, the existing attempt is retained
unchanged and returned as a duplicate. This skip policy preserves a user's prior manual
review; future version-driven reevaluation can deliberately implement an update policy.

## Confidence formula

Confidence is a diagnostic fraction in the schema's `0..1` range. It does not replace the
matcher's decision rules. Five bounded components are added:

- 35% coverage relative to the segment's required coverage;
- 20% correct direction/order, removed for reverse or excessive-backward results;
- 20% corridor adherence, split evenly between median deviation relative to one corridor
  width and maximum deviation relative to two corridor widths;
- 10% backward-movement tolerance, declining to zero at 30 meters;
- 15% GPS continuity, full through a 30-second gap and declining to zero at 60 seconds.

Scores are clamped to `0..1` and rounded to six decimal places for stable storage and
tests. Median deviation is calculated from every ride-point projection in the candidate
range, using the average of the middle pair for an even sample count.

## Validation

The required real-SQLite tests use Node's built-in `node:sqlite` against an in-memory
database created through the existing migrations. They confirm accepted and borderline
inserts, reject omission, rescan deduplication, complete diagnostics, known median
deviation, and hand-calculated confidence values for accept, borderline, and reject
inputs.

Commands run successfully:

```sh
node --test src/matcher/matchSegment.test.ts src/db/persistMatchCandidate.test.ts
npx tsc --ignoreConfig --noEmit --target ES2022 --module ESNext \
  --moduleResolution Bundler --strict --skipLibCheck --types node \
  --allowImportingTsExtensions src/matcher/matchSegment.ts \
  src/matcher/matchSegment.test.ts src/db/migrations.ts \
  src/db/persistMatchCandidate.ts src/db/persistMatchCandidate.test.ts
```

Result: 11 tests passed, 0 failed; the focused strict TypeScript check passed.

A broader `node --test src/**/*.test.ts` run passed 27 of 28 tests. Its only failure was
the unrelated existing FIT parser test, which cannot load the currently uninstalled
`@garmin/fitsdk` package. No matcher or persistence test failed.
