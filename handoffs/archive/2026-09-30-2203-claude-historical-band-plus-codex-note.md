# Handoff: Historical trend/band comparison view built (#68)

- Updated: `2026-09-29 16:34 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `0788207 feat: historical trend/band comparison view (#68)`
- Worktree: `apps/karoo/` and `ios/GritMap.xcodeproj/project.pbxproj` remain under
  concurrent Codex work — untouched by this increment, as throughout this whole session.

## Karoo Power/HR Drift update after this handoff

Codex completed GritMap Karoo 0.10.15/code38 with the redesigned large Power/HR Drift
field. The live tracker now publishes efficiency (W/bpm), drift rate (% per 10 minutes),
valid paired duration, paired-sample coverage, power steadiness, and normalized power/HR
indices in addition to drift. The 480x624 dashboard includes recommendation + drift, three
metric cards, a real time-based normalized Power/HR divergence chart, three-minute baseline,
amber 5% threshold, divergence shading, and confidence footer. Small fields retain their
compact presentation. Focused tracker/renderer tests and the full JVM suite plus APK
assembly passed. Installation was attempted but no ADB device was connected. Detailed
archive: `handoffs/archive/2026-09-30-power-hr-drift-dashboard.md`.

## Outcome

Continued down the roadmap (client: "get started on 68" after confirming push
readiness). Built #68, the one-to-history "band" comparison the spec itself prefers over a
spaghetti plot: every confirmed attempt's min/max range shaded behind the current attempt's
own line.

## Changed

Commit `0788207`:

- Extracted the shared distance-alignment/interpolation toolkit out of `compareAttempts.ts`
  into a new `src/comparison/resampleChannel.ts`, so the new N-attempt band computation
  reuses the exact same gap-aware logic as the existing 2-attempt diff, rather than a second
  implementation. `compareAttempts.ts`'s own pre-existing tests pass unchanged, confirming
  the refactor is behavior-preserving.
- New `src/comparison/computeHistoricalBand.ts` — takes every confirmed attempt on a
  segment plus which one is "current," returns a per-distance min/max/current-value sample.
- `ChannelChart` gained an optional third "current" line (reusing its existing generic
  polyline-drawing helper — no new SVG logic), so one component now renders both the
  existing diff overlay and this new band view.
- New `HistoricalBandScreen.tsx` + a "Compare to history" entry point on
  `SegmentDetailScreen`, gated at **3 confirmed attempts minimum** (chosen and documented,
  per the issue's own ask for an explicit decision on that threshold).
- Closed with evidence: https://github.com/frason/GritMap/issues/68#issuecomment-5901088256

## Verified

- `npm run typecheck`: clean.
- `npm test`: 292/292 passing (was 274 after the prior handoff; +18 — `resampleChannel` and
  `computeHistoricalBand`, plus confirmed `compareAttempts`'s own suite is unaffected by the
  refactor).
- `npm run web:smoke`: a real Metro bundle succeeds with the new screen/navigation.
- **Not live-verified on a real device**, and said so plainly in the issue: the client's
  real segments don't yet have 3 confirmed attempts on any single one (2 on Diablo, 1 on
  Relize), so the new entry point has nothing real to exercise yet. This is exactly the
  "premature given real data volume" caveat #68 was filed with — the code is correct and
  tested against synthetic fixtures; a genuine on-device check is the natural next step
  once enough real attempts accumulate.

## External state

No device/simulator state changed by this increment.

## Hazards and blockers

- Commit `0788207` (and everything back through `dd22d92` from earlier in this session) is
  on local `main` — the client confirmed readiness to push but push itself wasn't
  re-attempted from this session (still blocked by this session's own tool permissions).
- `apps/karoo/` and the iOS project file remain under active, live editing by the
  concurrent Codex session — untouched throughout.
- The historical-band feature is genuinely untestable on real data right now (see above) —
  worth a deliberate on-device check once the client has 3+ real attempts on one segment,
  rather than assuming the synthetic-fixture tests are sufficient forever.

## Next safe action

Push. #69-#72 remain the ready-to-go, deliberately-not-started backlog (Peloton/HealthKit,
biometric layer, Android spike, AI coach scoping) — client indicated most of this is
post-Oct-3 work, so confirm before continuing further down the list versus pausing here.
