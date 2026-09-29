# Handoff: Home/Goal tab built (#67); real expo-sqlite null-handling bug found and fixed

- Updated: `2026-09-29 07:44 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `293664c feat: goal-first Home tab (#67)`
- Worktree: `apps/karoo/` and `ios/GritMap.xcodeproj/project.pbxproj` have substantial
  uncommitted work from a concurrent Codex session (Karoo now at a 0.10.14 Power Balance
  central-illustration milestone, code37) — untouched by this increment. Codex's own
  accumulated updates through that point are preserved verbatim at
  `handoffs/archive/2026-09-29-0744-codex-karoo-power-balance-more.md` (same pattern as the
  prior handoff — Codex appends device-update paragraphs into this file's body rather than
  replacing it outright; archived as-is before each rewrite, nothing lost).

## Outcome

Continued down the roadmap filed in the previous handoff (client: "let's keep moving on
the next issue"). Built #67 (Home/Goal screen, the 3rd tab), the next item per the spec's
own priority order. Along the way, live-testing on a real iOS Simulator build caught a
genuine, previously-shipped crash bug — fixed it and audited/fixed every other instance of
the same pattern across the codebase.

## Changed

- **#67 implemented**, commit `293664c`. Migration v6 adds a singleton `active_goal` table
  (one segment + target duration — matches the MVP's single-goal scope, not a multi-goal
  dashboard). New `HomeScreen.tsx`, now the first tab, with three states: no segments yet
  (prompt into Import), segments exist but no goal set (pick one + enter mm:ss target), and
  goal set (goal statement, best confirmed attempt vs. target and the gap, a CTA into the
  best available comparison, recent rides). Reuses `listSegments`/`listAttemptsForSegment`/
  `listRides` — no new list queries. Closed with evidence:
  https://github.com/frason/GritMap/issues/67#issuecomment-5892594274
- **Real bug found and fixed**, commit `7fd6d89` (separate commit, lands first): every
  single-row DB getter checked `row === undefined` for "no matching row" — correct against
  `node:sqlite` (what every unit test runs against) but wrong against `expo-sqlite`'s real
  `getFirstSync()`, which returns `null` for the same case. `getActiveGoal` hit this
  immediately on the simulator (crashed with `Cannot read property 'segment_id' of null`
  the instant the app had no goal set — the common case for that query, not an edge case).
  That triggered an audit of every other `.get()`-based getter: `getAthleteProfile` (shipped
  last increment, same bug, never before hit live), `getAttemptDetail`, `getRideDetail`,
  `getRideIdentity`, `getSegmentDetail`, and `persistImportedRide`'s replace-by-id lookup —
  all fixed, each with a new regression test using a fake database that actually returns
  `null` (not achievable through `node:sqlite`, which is exactly how this stayed invisible
  to the existing suite this whole project).

## Verified

- `npm run typecheck`: clean throughout.
- `npm test`: 274/274 passing at the end of this increment (was 260 after the prior
  handoff; +14 — the goal DB layer plus 7 null-handling regression tests).
- `npm run web:smoke`: a real Metro bundle succeeds with the new tab/screen/migration.
- **Live iOS Simulator verification** (the same `iPhone 17 (Manual QA)` simulator/Metro
  setup from the prior increment, reattached): confirmed the crash is real and reproduces
  immediately on a fresh install, confirmed the fix resolves it, and confirmed the Home
  empty-state's "Import a ride" button correctly cross-navigates into the Rides tab's
  Import screen with tab state preserved on switching back. This is the first feature this
  session that was caught crashing live *before* being reported as done, not after.

## External state

- No device/simulator state changed beyond what's already noted in the prior handoff
  (stale worktree still present, not removed; client resolved their own physical-device
  dev-server connection issue separately).

## Hazards and blockers

- Commits `7fd6d89` and `293664c` (plus the prior increment's `dd22d92`/`7d93d96`) are on
  local `main`, not yet confirmed pushed.
- `apps/karoo/` and the iOS project file remain under active, live editing by the
  concurrent Codex session — untouched by this thread throughout, as in every prior
  handoff this session.
- The `getFirstSync()` null-handling pattern was fixed everywhere it was found via a
  targeted `grep` for `.get(` + `=== undefined` in `src/db/`, but that grep is a heuristic,
  not a proof of completeness — worth a second look if a similar "works in tests, crashes
  live" report ever surfaces again.

## Next safe action

Push. Then #68-#72 remain a real, ready-to-go, deliberately-not-started backlog — the
client indicated most of this is post-Oct-3 work. A live on-device check of the new Home
goal-setup flow (pick a real segment, enter a real target time, confirm the dashboard state
renders sensibly with real attempt data) plus the still-outstanding #62 registry and #73
zones on-device checks from earlier handoffs would be the most valuable next touches on
this session's work specifically.
