# Handoff: resilient iPhone segment JSON document reading

- Updated: `2026-10-06 10:10 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `e8be5b4 docs: next-ride test checklist and follow-up review of the H10 work`
- Worktree: shared uncommitted phone, Karoo, physiology, UI and documentation changes

## Outcome

The Coco Jumbo JSON itself was confirmed valid with `id: "coco-jumbo"`. The observed null-ID/read
message occurs at the iOS document-provider boundary before validation. Segment JSON selection now
forces a cache copy and falls back across three URI reading mechanisms.

## Changed

- `src/screens/ImportScreen.tsx` sets `copyToCacheDirectory: true` and tries modern Expo `File`,
  legacy Expo `readAsStringAsync`, then React Native URI fetch.
- Added `src/import/readTextWithFallback.ts` and its unit test.

## Verified

- `npm run typecheck`: passed for root and `packages/ride-segments`.
- `npm test`: 496 tests passed, 0 failed.
- Existing `importSegmentJsonText` tests confirm the exact Coco Jumbo sample imports with the same
  fingerprint as Karoo, detects duplicates, and validates optional or tampered fingerprints.

## External state

- No phone build or bundle was installed by Codex. The running dev client must load the newest JS
  bundle before the rider retries.
- No Karoo code or installed Karoo build changed.

## Hazards and blockers

- The fallback is covered in pure tests but still needs one real iPhone Files/AirDrop selection.
- If all three providers fail, the alert now includes each underlying read error rather than a
  misleading segment-ID interpretation.

## Next safe action

Reload the current phone development bundle, choose **Import Segment JSON**, and select
`Coco_Jumbo.segment.json` again. It should open Segment Detail; then add/import guidance and send it
to the unchanged Karoo 0.10.40 build.
