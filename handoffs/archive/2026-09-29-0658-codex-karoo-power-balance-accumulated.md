# Handoff: Post-MVP backlog cleared — #60, #61, #62, #63 all done

- Updated: `2026-09-28 17:45 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `dd4878b feat: optional git-repo-backed segment registry (#62)`
- Worktree: `apps/karoo/` and `ios/GritMap.xcodeproj/project.pbxproj` have substantial
  uncommitted work from a concurrent Codex session (Karoo source now at a 0.10.0 Pacing Profile
  visual milestone) — untouched by this increment. Codex's own prior handoff is preserved
  at `handoffs/archive/2026-09-28-1632-codex-pacing-profile-090.md`.

## Outcome

Concurrent Codex device update after this handoff was written: GritMap Karoo 0.9.1/code22
is installed on device `00442GA241760203`. The large Pacing Profile now combines target
distance and time in one fixed status block (for example `120 m BEHIND • +36s`), uses a
text-free colored bullseye on the moving target, and shades each Rest/Hold/Push road
surface with a five-stop dark-edge/bright-center gradient. All four local preview states
were regenerated and reviewed; full JVM tests and APK assembly passed. Codex's detailed
archive is `handoffs/archive/2026-09-28-1646-codex-unified-pace-status.md`.

Subsequent Codex source milestone: 0.10.0/code23 is clean-built and installed on Karoo
device `00442GA241760203`.
The 0.10.0 renderer aligns the remaining concept details: bottom-to-horizon road gradient,
depth-scaled grey shoulders, subtle mountain horizon, fixed Target/Pace/Actual data band,
signed rider-relative pace (`-` behind, `+` ahead), watts in the top recommendation,
next-block callout, and elevation values only on the far-left axis. Live units follow
`UserProfile.preferredUnit` from karoo-ext; preview defaults to imperial. Clean build: 109
JVM tests, 0 failures/errors. Replacement install retained app data; the extension process,
foreground service, and KarooSystemService connection all started without a crash. Detailed archive:
`handoffs/archive/2026-09-28-1710-codex-pacing-profile-0100.md`.

Latest Codex device refinement: 0.10.1/code24 is installed on the same Karoo. Mountains
are constrained to a shallow horizon band, the near road now fades toward near-black,
the fixed center Pace card shows signed time only, and the large guidance badge shows the
effort plus `AHEAD`, `BEHIND`, or `ON PACE` rather than target watts. Focused and full JVM
tests plus APK assembly passed. Post-install logs show the extension/service/Karoo
connection alive with no fatal startup error. Detailed archive:
`handoffs/archive/2026-09-28-2042-codex-pacing-profile-0101.md`.

Latest Codex readability refinement: 0.10.2/code25 is installed on Karoo device
`00442GA241760203`. All text within the large Pacing Profile was increased by 20%—segment
header, progress, road callout, rider label, Target/Pace/Actual cards, and elevation-axis
labels—while the colored Rest/Hold/Push recommendation bar deliberately retains its prior
size. The focused bitmap-renderer test, full JVM suite, APK assembly, and replacement
install all passed. Detailed archive:
`handoffs/archive/2026-09-28-2051-codex-pacing-profile-text-scale.md`.

Latest Codex visual refinement: 0.10.3/code26 is installed on the same Karoo. The large
Pacing Profile now uses a darker depth gradient and darker road shoulders, restores labeled
100-foot elevation contours down the road's left side, further enlarges the mini elevation
axis labels, and changes the fixed center Pace card from signed time to signed distance
(`-` behind, `+` ahead). Time remains in the top recommendation bar. Focused rendering
tests, the full JVM suite, APK assembly, and replacement install passed. Detailed archive:
`handoffs/archive/2026-09-28-visual-road-contours-distance.md`.

Latest Codex perspective refinement: 0.10.4/code27 is installed on the same Karoo.
Elevation-contour labels now share a fixed left alignment. The 1P road hides the virtual
target whenever the rider is ahead, while the target remains visible in the lower elevation
profile. The mountain horizon is smaller, higher, and shifts subtly opposite the distant
route bend for parallax. Focused rendering tests, full JVM tests, assembly, and replacement
install passed. Detailed archive:
`handoffs/archive/2026-09-28-pacer-visibility-mountain-parallax.md`.

Final Codex perspective pass: 0.10.5/code28 is installed on the same Karoo. The 1P road's
smallest point now terminates exactly at the bottom of the mountain horizon, the dashed
center line has been removed, and the road shoulders now widen strongly toward the rider,
taper into the distance, render about 50% darker, and use a synchronized bottom-to-horizon
gradient. Focused visual regression, full JVM tests, assembly, and replacement install
passed. Detailed archive:
`handoffs/archive/2026-09-28-final-road-perspective.md`.

Codex pacing-anchor correction: 0.10.6/code29 is installed on the same Karoo. The YOU
marker now remains at one fixed vertical screen anchor whether the rider is ahead or behind.
Mountain parallax is materially stronger and now uses separate movement rates for the rear
and foreground ridges, driven by the average upcoming route bend. Focused rendering tests,
full JVM tests, assembly, and replacement install passed. Detailed archive:
`handoffs/archive/2026-09-28-fixed-rider-stronger-parallax.md`.

Latest Codex road-edge refinement: 0.10.7/code30 is installed on the same Karoo. A tapered
near-black separator now sits between the colored 1P road and dark-grey perspective
shoulders, matching the original visual concept. Focused rendering tests, full JVM tests,
assembly, and replacement install passed. Detailed archive:
`handoffs/archive/2026-09-29-road-edge-separator.md`.

Codex Power Balance demo fix: 0.10.8/code31 is installed on the same Karoo. The physical
device demo loop now publishes a complete estimated W-prime state (actual/plan reserve,
projected finish, flow rates, history, and animation phase) instead of overwriting it with
null and triggering the obsolete Actual-vs-Target fallback. A regression assertion now
requires complete W-prime demo data. Full JVM tests, assembly, and replacement install
passed. Detailed archive: `handoffs/archive/2026-09-29-power-balance-demo-restored.md`.

Codex Power Balance UX redesign: 0.10.9/code32 is installed on the same Karoo. The large
field now uses the approved action-first battery hierarchy: action banner, reserve-vs-plan
headline, Plan/Ride flow nodes, large horizontal W-prime battery with plan marker, explicit
energy status, Actual/Plan drain-or-recovery cards expressed in watts, and projected finish
reserve. Active paths use thicker blue lines and compact chevrons with larger black lead-in
knockouts. Missing reserve data now shows a consistent calculating battery instead of the
obsolete power bar. Focused renderer and full JVM tests plus assembly/install passed.
Detailed archive: `handoffs/archive/2026-09-29-power-balance-ux-redesign.md`.

Codex Power Balance physical-layout correction: 0.10.10/code33 is installed on the same
Karoo. The renderer now receives the real `ViewConfig.viewSize` instead of drawing a fixed
600x520 bitmap that Karoo shrank and letterboxed. At the verified 480x624 field aspect, the
screen now includes a header/progress row, full-width action banner, large plan comparison,
expanded nodes and battery, stable status, large watt-rate cards, and projected finish.
Chevrons are distributed by actual path length so they no longer cluster at corners.
Focused actual-aspect visual regression, full JVM tests, assembly, and install passed.
Detailed archive: `handoffs/archive/2026-09-29-power-balance-actual-size.md`.

Codex Power Balance arrow correction: 0.10.11/code34 is installed on the same Karoo. Open
V-shaped chevrons that read as fishbones were replaced with filled arrows composed of a
rectangular shaft and triangular head. Negative-space lead-ins were shortened, arrows are
excluded from path elbows, and path-length spacing remains stable. The actual-aspect preview,
focused renderer test, full JVM suite, assembly, and install passed. Detailed archive:
`handoffs/archive/2026-09-29-power-balance-solid-arrows.md`.

Codex Power Balance composition pass: 0.10.12/code35 is installed on the same Karoo. The
small repeated arrow chain was replaced by sparse, large triangular direction markers on
continuous blue active routes; inactive routes remain subdued gray and markers stay clear
of elbows. The nodes, battery, reserve text, and active plumbing were enlarged, the lower
metric stack was tightened, and all on-plan/overextended/recovering states were rendered
at the verified 480x624 field size before running the full JVM suite and APK assembly.
Detailed archive: `handoffs/archive/2026-09-29-power-balance-composition-pass.md`.

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
