# Handoff: Matcher extracted as standalone AGPL-3.0 package (#61)

- Updated: `2026-09-28 17:00 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `d6e200b matcher: extract ride-segments as a standalone AGPL-3.0 package (#61)`
- Worktree: `apps/karoo/` and `ios/GritMap.xcodeproj/project.pbxproj` have substantial
  uncommitted work from a concurrent Codex session (Karoo 0.8.3–0.8.7) — untouched by this
  increment. Codex's own prior handoff (perspective pacing route, updated 15:50 PDT) is
  preserved (with condensed wording, same facts) at
  `handoffs/archive/2026-09-28-1550-codex-perspective-pacing-route.md`.

## Outcome

Per the client's direction ("do 61 now"), extracted the matcher core into a standalone,
publishable package per issue #61 and docs/Grip-Map-app-spec.md's "Optional Workstream:
Open-Sourcing the Segment Library". All three of the issue's "Done when" criteria are met;
closed the issue.

## Changed

- Commit `0017957` (prior increment, #60) and `d6e200b` (this one) on `main` — pushed by
  the client after the prior increment; this commit not yet confirmed pushed.
- New `packages/ride-segments/` — pure-TypeScript package (`matchSegment.ts`,
  `traversalOverlap.ts`, `toMatcherRidePoints.ts`, moved via `git mv` to preserve history),
  own `package.json`/`tsconfig.json`/`README.md`, and the verbatim AGPL-3.0 text fetched
  directly from gnu.org (not reconstructed from memory, to avoid transcription errors in a
  legal document).
- Root `package.json`: added `"workspaces": ["packages/*"]` and a
  `"ride-segments": "^0.1.0"` dependency; `test`/`typecheck` scripts extended to also cover
  the package.
- Root `tsconfig.json`: excluded `packages/` (it has its own standalone tsconfig) while
  preserving every exclude Expo's base config already set — replacing the array outright
  would have silently dropped `babel.config.js`/`metro.config.js`/`android`/`ios` excludes.
- Updated every app-side consumer to import from `"ride-segments"` instead of relative
  paths: `src/db/persistMatchCandidate.ts` (+ its test), `src/db/getMatcherRidePoints.ts`,
  `src/matcher/runMatcher.ts`, `src/matcher/realSegments.test.ts`,
  `src/segments/segmentSelfMatch.test.ts`, and the pre-existing dev script
  `scripts/validate-real-matcher.ts` (an old #10-era CLI tool I hadn't touched before —
  found by running the full-repo grep for stale import paths, not by memory).
- License: **AGPL-3.0-only** — the client's explicit choice when asked, over MIT/Apache-2.0.

## Verified

- `npm run typecheck`: clean for both the app and the package.
- `npm test`: 206/206 passing — same count as before the move, confirming the relocated
  `matchSegment.test.ts` runs correctly from its new location via the widened test glob.
- `npm run web:smoke` (`expo export --platform web`): a real Metro bundle succeeded with
  the app pulling `ride-segments` in through the npm workspace symlink
  (`node_modules/ride-segments -> ../packages/ride-segments`) — this is the load-bearing
  check, since typecheck/`node --test` alone wouldn't have caught a Metro-resolution
  problem that only a real bundler run would surface.
- `git status` confirmed the 4 moved files show as renames (100% similarity), not
  delete+add, so file history is intact.
- Posted the full "Done when" checklist as a comment on issue #61 and closed it:
  https://github.com/frason/GritMap/issues/61#issuecomment-5881011904

## External state

- No device/simulator state changed by this increment.

## Hazards and blockers

- This commit (`d6e200b`) has not yet been confirmed pushed to `origin/main` — the prior
  increment's commit was pushed by the client manually after I reported it blocked by
  local permissions; the same is likely true here.
- The package is consumed as a local npm workspace only, not published to npm. Publishing
  (and picking a real npm package name, since `ride-segments` is unscoped and its
  availability on the registry hasn't been checked) is a separate future decision, not
  required by #61's "Done when" and not started here.
- The public API surface was deliberately kept to what #61 asked for (`matchSegment`,
  `toMatcherRidePoints`, `traversalOverlap`/`isSamePhysicalTraversal`, `MATCHER_VERSION`,
  `calculateConfidenceScore`) — not the broader `defineSegment()`/resampling API the spec's
  "Optional Workstream" section sketches. That stays app-owned; extracting it wasn't asked
  for and would have been scope creep.
- `apps/karoo/` and the iOS project file remain under active, live editing by the
  concurrent Codex session (confirmed again this increment — more Karoo files were
  modified mid-session than at its start). Do not touch either from this thread.

## Next safe action

#60 and #61 are both done for now. Remaining post-MVP backlog: #62 (optional cloud
registry for sharing segment definitions) and #63 (evaluate direct Hammerhead/Karoo API
integration vs. current FIT-file import) — both larger, more architectural decisions than
#60/#61, worth discussing scope with the client before starting either. Not something to
pick up unilaterally.
