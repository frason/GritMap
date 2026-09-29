# Handoff: Post-MVP roadmap planned and filed; Power/HR zones built (#73)

- Updated: `2026-09-29 06:58 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `dd22d92 feat: power/HR zones in segment comparison (#73)`
- Worktree: `apps/karoo/` and `ios/GritMap.xcodeproj/project.pbxproj` have substantial
  uncommitted work from a concurrent Codex session (Karoo now at a 0.10.12 Power Balance UX
  milestone, code35) — untouched by this increment. Codex's own accumulated updates through
  that point are preserved verbatim at
  `handoffs/archive/2026-09-29-0658-codex-karoo-power-balance-accumulated.md` (Codex had been
  appending device-update paragraphs into this file's body rather than replacing it outright
  — archived as-is before this rewrite, nothing lost).

## Outcome

With the #60-#63 post-MVP backlog cleared (previous handoff) and the client's Oct 3, 2026 PR
attempt only 4 days out, the client asked for a full re-read of
`docs/Grip-Map-app-spec.md` against the current app state, a prioritized roadmap, and that
roadmap turned into real GitHub issues — plus building the single highest-priority item.

Audited the spec section-by-section against `src/` (confirmed via `grep` — no `zone`/`ftp`/
`goal` code existed anywhere) and produced a plan (`/Users/frason/.claude/plans/precious-
frolicking-petal.md`), approved by the client after two clarifying rounds (scope: file the
backlog AND build the top item now; wearable: Apple Watch, confirming HealthKit over
Garmin's API; AI coach: file a scoping issue now, explicitly blocked, rather than omit it).

## Changed

- Filed 7 issues on GitHub, in the spec's own stated priority order:
  [#67](https://github.com/frason/GritMap/issues/67) Home/Goal screen (3rd tab),
  [#68](https://github.com/frason/GritMap/issues/68) historical trend/band comparison,
  [#69](https://github.com/frason/GritMap/issues/69) Peloton ingestion via HealthKit,
  [#70](https://github.com/frason/GritMap/issues/70) biometric/contextual data layer,
  [#71](https://github.com/frason/GritMap/issues/71) Android Peloton/Health Connect
  availability spike, [#72](https://github.com/frason/GritMap/issues/72) AI coach layer
  (scoping only, explicitly blocked on #69/#70), and
  [#73](https://github.com/frason/GritMap/issues/73) Power/HR zones — filed then
  immediately built and closed, see below.
- **#73 implemented**, commit `dd22d92`: migration v5 adds a singleton `athlete_profile`
  table (`ftp_watts`, `max_heart_rate_bpm`, both nullable). `src/zones/classifyZone.ts`
  classifies samples into Coggan's standard 7-zone %FTP power model and a standard 5-zone
  %max-HR model. `src/zones/computeZoneBreakdown.ts` reuses `compareAttempts.ts`'s already-
  computed gap-aware samples (no new data pass) to produce a per-attempt zone-time
  breakdown. `AttemptComparisonScreen` shows this above the existing raw-value overlays,
  linking to a new `ZonesSettingsScreen` when thresholds aren't set — the existing overlay
  is completely unaffected either way.
- Not filed, by design (documented in the plan): multi-user auth/backend, Garmin API
  (resolved — Apple Watch confirmed, HealthKit is the path).

## Verified

- `npm run typecheck`: clean (app + `ride-segments` package) after every commit.
- `npm test`: 260/260 passing at the end of this increment (was 238 after the prior
  handoff; +22 new tests for zones/athlete-profile). Two pre-existing migration tests
  (`migrations.test.ts`, `initializeDatabase.test.ts`) had the new schema's `PRAGMA
  user_version` hardcoded to the old value (4) and needed updating to 5 — caught by the
  suite itself, fixed, not a design flaw.
- `npm run web:smoke` (`expo export --platform web`): a real Metro bundle succeeds with the
  new screen, navigation route, and migration.
- No live on-device tap-through of the new Zones UI was performed — same pattern as this
  session's other UI-touching work, left for the client.

## External state

- No device/simulator state changed by this increment.
- Earlier in this session, a real iOS Simulator build (`iPhone 17 (Manual QA)`) was used to
  verify the #62 registry UI live — that work is already committed/pushed from the prior
  handoff. During that pass, a real environmental hazard was found and fixed: the Metro dev
  server that had been running on port 8081 for 16+ days was serving from a stale leftover
  worktree (`.claude/worktrees/gritmap-uncommitted-changes-e95217`, corresponding to an
  already-merged PR), not this repo — killed and restarted from the correct directory. That
  stale worktree still exists on disk and is very likely safe to delete, but wasn't removed
  autonomously; flagged to the client, not yet actioned.
- The client separately hit a "can't connect to dev server" issue rebuilding on their own
  physical iPhone — diagnosed as the dev-client's Bonjour/mDNS auto-discovery not finding
  Metro; resolved by entering the LAN IP (`192.168.7.38:8081`) manually via "Enter URL
  manually" in the dev-client home screen. Not a code issue.

## Hazards and blockers

- This commit (`dd22d92`) and the prior handoff's four commits are on local `main`; the
  client had already pushed through `85026b2` before this increment started — this new
  commit is not yet confirmed pushed.
- `apps/karoo/` and the iOS project file remain under active, live editing by the
  concurrent Codex session (now well past 0.10.0, many device-verified increments deep) —
  untouched by this thread throughout, as in every prior handoff this session.
- The stale worktree (`.claude/worktrees/gritmap-uncommitted-changes-e95217`) mentioned
  above is still present and still corresponds to an already-merged PR — safe to remove,
  but that's the client's call, not made here.

## Next safe action

Push `dd22d92`. Then: #67-#72 are a real, ready-to-go backlog (deliberately not started,
per the plan) — the client indicated most of this is post-Oct-3 work given the imminent PR
attempt. A live on-device check of the new Zones UI (enter a real FTP/max-HR, confirm the
comparison screen shows a sensible breakdown) would be the most valuable next touch on
today's work specifically, alongside the still-outstanding #62 registry publish/import
on-device check from the prior handoff.
