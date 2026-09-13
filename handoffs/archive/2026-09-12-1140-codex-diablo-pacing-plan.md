# Handoff: Diablo 40:30 pacing plan prepared for phone export binding

- Updated: `2026-09-12 11:40 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `1e3721c map: real OSM vector tiles instead of MapLibre's bare demo style (closes #57)`
- Worktree: substantial pre-existing uncommitted phone/Karoo work remains; this milestone adds only three untracked files under `apps/karoo/samples/` and `apps/karoo/tools/`.

## Outcome

A deterministic, trainer-authored baseline plan for “Diablo Northgate to Junction” is encoded and ready to bind to the exact segment selected in the phone app. It targets 40:30, uses current FTP 280 W, max HR 178 bpm, weight 92.53 kg, and preserves all 26 supplied quarter-mile/final pacing targets. A standalone builder converts those source-mile zones to contiguous segment-relative meter zones and emits the existing Karoo v1 transfer-package contract.

## Changed

- `apps/karoo/samples/Diablo.Northgate-to-Junction.40m30.plan.json`
  - 26 zones covering 6.48 source miles.
  - Targets progress from 265 W to 295 W.
  - Zones through mile 5 are `HOLD`; mile 5 onward is `PUSH`.
  - Target time is 2,430 seconds.
- `apps/karoo/tools/build_guidance_package.mjs`
  - Takes authoritative segment JSON plus the plan source and emits a complete `gritmap-transfer` package.
  - Computes the same immutable fingerprint used by Kotlin.
  - Scales source-mile boundaries to the segment’s exact stored length.
  - Includes rider profile and baseline plan without modifying segment coordinates.
- `apps/karoo/tools/build_guidance_package.test.mjs`
  - Checks Kotlin-compatible fingerprinting against the existing validated Relize package.
  - Checks contiguous scaling, final endpoint, target time, profile values, and final target.

## Verified

- `node --test apps/karoo/tools/build_guidance_package.test.mjs` — 2/2 passed.
- `git diff --check -- apps/karoo/samples/Diablo.Northgate-to-Junction.40m30.plan.json apps/karoo/tools/build_guidance_package.mjs apps/karoo/tools/build_guidance_package.test.mjs` — passed.
- Historical calibration FIT `/Users/frason/Downloads/Karoo-Morning_Ride-2026-07-18-0908.fit` parsed successfully: 11,698 GPS points with power, HR, and cadence. Rider states this was a controlled effort; historical FTP was about 270 W.
- No Android build or device installation was performed for this isolated milestone.

## External state

- The selected Diablo segment currently exists in the phone app under the exact name `Diablo Northgate to Junction`.
- The Karoo was connected during the preceding diagnostic work and had GritMap 0.8.2/versionCode 13. Its last inspected database did not yet contain Diablo.
- The user plans to ride this segment tomorrow.

## Hazards and blockers

- The phone app does not yet provide this workspace with the selected segment’s exact JSON, fingerprint, or length. Do not approximate the route or generate a final import package from the historical FIT.
- The generated plan must cover the phone-selected segment’s exact distance. The builder deliberately binds/scales only after receiving that authoritative export.
- Do not overwrite the substantial existing uncommitted Karoo/UI work.

## Next safe action

ChatGPT/phone-app worker: add or use a read-only export for the selected segment that produces the existing GritMap v1 segment JSON shape (`schemaVersion`, `id`, `name`, `direction: forward`, `matching`, ordered `referencePolyline`). Place the exported Diablo JSON in `apps/karoo/samples/` or otherwise return its exact contents. Then run:

`node apps/karoo/tools/build_guidance_package.mjs --segment <diablo.segment.json> --plan apps/karoo/samples/Diablo.Northgate-to-Junction.40m30.plan.json --output apps/karoo/samples/Diablo.Northgate-to-Junction.40m30.guidance-package.json`

Validate/import the resulting package on Karoo and confirm the baseline plan and 40:30 target are attached to the installed Diablo segment.

