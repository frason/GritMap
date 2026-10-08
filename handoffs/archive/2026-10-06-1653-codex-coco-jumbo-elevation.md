# Handoff: Coco Jumbo now carries real barometric elevation and non-zero section grades

- Updated: `2026-10-06 16:53 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `9b5f594 feat: import a portable segment JSON file on the phone`
- Worktree: uncommitted shared worktree; this milestone changes `apps/karoo/samples/Coco_Jumbo.segment.json`, `scripts/enrich-segment-elevation-from-fit.ts`, and `src/db/importSegmentJsonText.test.ts`

## Outcome

The portable Coco Jumbo definition no longer treats the climb as flat. Its 55 reference points now contain barometric elevation interpolated from the real forward traversal in `Karoo-Evening_Ride-2026-08-17-1706.fit`. The profile rises from 110.8 m to 188.2 m: 77.4 m/254 ft net gain over 533.553 m, or 14.5% average grade. Adaptive 100 m section grades are 12.1%, 16.3%, 14.2%, 16.1%, 15.9%, and 8.35% for the final 33.553 m.

## Changed

- `apps/karoo/samples/Coco_Jumbo.segment.json`: added `elevationMeters` to all 55 points.
- `scripts/enrich-segment-elevation-from-fit.ts`: repeatable CLI that locates a segment's forward traversal in a FIT file and interpolates its barometric elevation by distance.
- `src/db/importSegmentJsonText.test.ts`: updated Coco's expected immutable fingerprint to `cfc9be45fea61eebdd9dbcacd6e5798fd6386afecacb575012657c045e995efc` and asserts the stored elevation range.

## Verified

- `npm run typecheck` passed for root and `ride-segments`.
- `npm test` passed: 497/497.
- Direct grade calculation reported 77.4 m gain, 14.5065% average grade, and the six non-zero grades listed above.

## External state

- The already-imported Coco Jumbo on the phone and Karoo is still the old no-elevation immutable definition/fingerprint. No device database was changed in this milestone.
- The updated JSON is only in the repository and must be transferred to the phone again.

## Hazards and blockers

- Elevation is part of the immutable segment fingerprint. Do not silently mutate the installed old segment. Delete the old Coco Jumbo definition before importing/sending this enriched replacement.
- Any plan made for the old fingerprint cannot attach to the enriched definition and must be regenerated or re-imported for the new fingerprint.

## Next safe action

Delete old Coco Jumbo from the phone, transfer and import the updated `apps/karoo/samples/Coco_Jumbo.segment.json`, create its plan, then delete old Coco Jumbo from the Karoo before sending the enriched segment + plan.
