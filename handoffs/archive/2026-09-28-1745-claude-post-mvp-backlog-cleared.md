# Handoff: Post-MVP backlog cleared — #60, #61, #62, #63 all done

- Updated: `2026-09-28 17:45 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `dd4878b feat: optional git-repo-backed segment registry (#62)`
- Worktree: `apps/karoo/` and `ios/GritMap.xcodeproj/project.pbxproj` have substantial
  uncommitted work from a concurrent Codex session (Karoo now at a 0.9.0 Pacing Profile
  visual milestone) — untouched by this increment. Codex's own prior handoff is preserved
  at `handoffs/archive/2026-09-28-1632-codex-pacing-profile-090.md`.

## Outcome

Per the client's direction across this session ("focus on the app" → "do 60" → "do 61
now" → "lets move on to the next two, work on both of them and then we can push all 3 when
done"), cleared the entire post-MVP backlog filed back on 2026-08-26 (#60-#63). All four
issues are closed. Four commits sit locally on `main`, not yet pushed — the client asked to
push everything together once this batch was done.

## Changed

Commits on `main` (oldest first), none yet pushed:

- `0017957` + `d81240d` — **#60**: validated the matcher against the client's 3 real
  segments and real rides; zero discrepancies, no tuning needed. New:
  `src/matcher/realSegments.test.ts`, 4 new real FIT fixtures.
- `d6e200b` + `3591253` — **#61**: extracted the matcher core into
  `packages/ride-segments`, a standalone AGPL-3.0-licensed npm workspace package (pure
  TypeScript, no SQLite/RN/Expo dependency). App consumes it as an ordinary dependency.
- `447dc31` — **#63**: research/decision only. `docs/HAMMERHEAD_API_EVALUATION.md` — found
  Hammerhead now has a real, free, documented API (`GET /activities/{id}/file` returns the
  actual FIT file) that didn't exist when the original spec was written. Recommendation:
  worth building post-Oct-3 via OAuth + client-side polling (no webhook/backend needed),
  not urgent now.
- `dd4878b` — **#62**: built the optional segment registry, backed by this same repo
  (`registry/segments/`) per the client's explicit choice over a hosted backend. Publish
  via GitHub's Contents API (needs a client-supplied PAT, stored via new
  `expo-secure-store` dependency); discover/import unauthenticated. New UI: a "Publish to
  registry" section on `SegmentDetailScreen`, a new `RegistryBrowseScreen`. See
  `docs/SEGMENT_REGISTRY.md`.

All four issues closed with full evidence posted as GitHub comments:
[#60](https://github.com/frason/GritMap/issues/60#issuecomment-5879976607),
[#61](https://github.com/frason/GritMap/issues/61#issuecomment-5881011904),
[#62](https://github.com/frason/GritMap/issues/62#issuecomment-5881468426),
[#63](https://github.com/frason/GritMap/issues/63#issuecomment-5881358090).

## Verified

- `npm run typecheck`: clean throughout (app + `ride-segments` package).
- `npm test`: 238/238 passing at the end of this batch (started at 206 for #60, grew with
  each issue's new tests — all real, none skipped, checked by name after each commit).
- `npm run web:smoke` (`expo export --platform web`): a real Metro bundle succeeded twice —
  once after the #61 package extraction, again after #62's new `expo-secure-store`
  dependency and new screens.
- Attempted a live functional check of the new registry UI via `expo start --web` in the
  browser pane: blocked by a **pre-existing, unrelated** limitation — `expo-sqlite`'s web
  build needs `SharedArrayBuffer`, which needs COOP/COEP headers this dev-server setup
  doesn't send. This affects the whole app on web, not anything from this session; the app
  has never been functionally verified on the web target for this reason — only via real
  iOS/Android per every prior handoff. Not something to fix as part of this batch.
- No live on-device pass of the actual publish/import flow with a real GitHub PAT was
  performed — see Hazards below.

## External state

- No device/simulator state changed by this increment.
- Added `.claude/launch.json` (new, tracked) so a future session can `preview_start` this
  app's web bundle without rediscovering the command.

## Hazards and blockers

- **Four commits are local-only, not pushed.** The client asked to push once this whole
  batch landed — that request should be honored now (or by the client themselves; push is
  blocked by this session's own tool permissions, same as the #60/#61 handoff).
- **#62's actual publish/import round-trip was never exercised with a real credential.**
  Publishing creates a real public commit under the client's GitHub identity — deliberately
  not triggered autonomously. Unit tests cover the real client code against a mocked
  `fetch`; an on-device tap-through with a real PAT is the natural next verification step,
  and needs a native rebuild first since `expo-secure-store` is a new native module (a
  plain JS reload into an old dev-client build won't have it linked).
- **#62's registry directory doesn't exist on `origin/main` yet** (only committed locally)
  — `registry/segments/` will 404 as "empty" until these commits are pushed, which is
  already handled gracefully (`listRegistrySegments` treats 404 as zero entries), but is
  worth knowing before assuming anything's actually published.
- `apps/karoo/` and the iOS project file remain under active, live editing by the
  concurrent Codex session (now at 0.9.0) — untouched by this thread throughout.

## Next safe action

Push the four local commits (`0017957`..`dd4878b`) to `origin/main`. After that, no
open post-MVP issues remain — the backlog filed at MVP completion (#57-#63) is fully
closed. Whatever's next is client-directed: a real on-device check of the new registry
publish/import flow would be the most valuable next touch on today's work specifically.
