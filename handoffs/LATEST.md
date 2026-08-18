# Handoff: Root-app first UI increment — plan reviewed, revisions incorporated, implementing PR 1

- Updated: `2026-08-17 21:41 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `51e6839 docs: incorporate Codex review into first UI increment plan`
- Worktree: **not clean** — see "External state" below before touching this checkout

## Outcome

Still not a completed milestone — the plan/review round-trip is closed, implementation of PR 1
(navigation shell + semantic theme tokens) starts next in this session.

Full plan, now with Codex's review and Claude's incorporation of all seven required revisions
inline: [`docs/PLAN_first_ui_increment.md`](../docs/PLAN_first_ui_increment.md). Approved Figma
mock: https://www.figma.com/design/cyaMDDfLBKFc4NNK1SUUnb?node-id=29-205

Every revision item was resolved with something verified directly against source, not assumed
— see the plan's "Claude — revisions incorporated" section for the specifics (expo-sqlite's
one-shot APIs read from its `.d.ts`, both real FIT fixtures parsed directly to ground the
identity-normalization rules empirically, `expo-crypto`'s actual `Crypto.digest`/`randomUUID`
signatures confirmed via Expo's docs, PR #54's diff checked directly for app.json/native-config
touches).

## Changed

- `f4b5a15` (Claude): plan + Figma mock handed off for review.
- `3fd6790` (Codex): plan reviewed, seven required revisions appended.
- `51e6839` (Claude): all seven revisions incorporated into the plan's implementation sections
  (adapter design, FIT identity rules, ID/hash sourcing, cleanup ordering, batch responsiveness,
  a new migration v3 for ride summary columns, PR #54 coordination note).

No product implementation has landed yet. There is still uncommitted scaffolding in the working
tree — see "External state."

## Verified

- All claims in the incorporated revisions were checked against real source before writing them
  down (not re-summarizing here — see the plan doc's "revisions incorporated" section for the
  itemized list of what was verified and how).
- The pre-existing scratch `src/theme/*`/`src/navigation/*`/stub `src/screens/*` files were
  diffed against the plan's §0/§1 (navigation shell, semantic tokens) — neither section was
  touched by any required revision, so the scratch files match the approved plan as written and
  will be committed as PR 1 rather than redone.

## External state

- **Uncommitted working-tree changes**: modified `App.tsx`, `package.json`,
  `package-lock.json`; new `src/navigation/`, `src/screens/`, `src/theme/`. As of this handoff
  these are confirmed to match the approved (post-review) plan and are about to be committed as
  PR 1 in this same session — by the time you read this they may already be `nav/app-shell` on
  `main`. Check `git log` before assuming this description is still current.
- No device/APK state changed by this work — this hasn't touched `apps/karoo/` or any device.

## Hazards and blockers

- This checkout is shared with cron (paused) and with your sessions — check
  `git branch --show-current` and `git status` before running git commands here.
- PR 2 (dev-client/prebuild) generates and commits native `ios`/`android` dirs. Per the
  incorporated review: this doesn't conflict with PR #54's current diff (confirmed — no
  app.json/config-plugin changes there), but PR #54's `@maplibre/maplibre-react-native`
  dependency will need a follow-up `expo prebuild --clean` once it merges, to link it natively.
  That follow-up isn't done yet and isn't this handoff's responsibility to do — flagging so it
  isn't forgotten when PR #54 lands.
- Nothing here blocks or is blocked by your current Karoo live-activation reliability work.

## Parallel Karoo update — Codex, 2026-08-17 21:43 PDT

- `28d9f21 apps/karoo: harden live segment activation` is committed independently of the
  root UI track.
- The launcher now requests and displays location permission, the live service returns
  `START_STICKY`, and the extension/profile lifecycle re-requests service startup.
- Foreground startup fails safely instead of killing the process when location permission is
  absent. Bounded persistent diagnostics cover service, Karoo connection, ride state,
  periodic GPS, candidate discovery/selection, attempts, and errors; recent lines appear in
  the launcher.
- A regression derived from `Karoo-Evening_Ride-2026-08-17-1956.fit` proves the Android live
  matcher completes Coco Jumbo without HR/power. Unit tests, lint, and APK assembly passed.
- APK/extension version is now 0.2.0 (versionCode 2), including the previously built Target
  Power and Pacing Profile field split.
- The physical Karoo was disconnected at install time. The verified APK is not installed;
  when reconnected, use only `adb install -r` and do not run device instrumentation.

## Next safe action

Implement PR 1 (`nav/app-shell`) from the plan, then continue sequentially through PR 2–8,
verifying each per the plan's per-PR verification notes before moving to the next. Update this
handoff again once a meaningful chunk of the increment (at least through PR 4/5, ideally the
whole thing) is committed.

## Parallel Karoo update — Codex, 2026-08-18 08:15 PDT

- `8395834 apps/karoo: preview pacing data fields` is committed independently of the root app
  track. No root Expo files were touched by this commit.
- Karoo page-editing preview mode now shows representative content instead of searching/blank
  state: Target Power emits 260 W, and Pacing Profile renders a sample 533 m Coco Jumbo profile
  with recover/hold/push regions, progress, and a recommendation.
- Preview data is selected only when `ViewConfig.preview` is true. Normal ride views continue to
  use `LiveUiStore`; the graphical preview does not start the foreground tracking service.
- APK/extension version is now 0.2.1 (versionCode 3).
- Focused app tests passed. APK assembly passed. The full 36-test run compiled and assembled the
  app but had one failure in the pre-existing timing-sensitive
  `NeedleAgentManagerTest.timeoutReturnsFallbackWithoutConcurrentInference`; this change does not
  touch that code.
- The Karoo was disconnected at install time, so 0.2.1 is built but not installed. Reconnect it
  and use `adb install -r apps/karoo/app/build/outputs/apk/debug/app-debug.apk`; do not uninstall,
  clear app data, or run connected instrumentation.

## Parallel Karoo crash fix — Codex, 2026-08-18 08:50 PDT

- Physical testing proved matching works: diagnostics recorded `candidate_discovered`,
  `candidate_selected`, and `attempt_started` for Coco Jumbo at 08:37.
- Android exit history and DropBox recorded two immediate version 0.2.0 crashes. Exact cause:
  `IllegalStateException: Composed into the View which doesn't propagate
  ViewTreeSavedStateRegistryOwner!` from the WindowManager Compose overlay.
- `ef2c066 apps/karoo: fix Compose overlay owners` adds lifecycle, saved-state registry, and
  ViewModel-store owners to the overlay view tree and makes failed/unused teardown safe.
- The focused overlay test and APK assembly passed.
- Corrected version 0.2.1 (versionCode 3) was installed successfully with `adb install -r` and
  launched. The Room database and WAL remain present; Coco Jumbo/app data were not cleared.
- The on-road overlay path still needs one confirmation pass. If anything fails, preserve the
  device state and retrieve DropBox plus `files/diagnostics/live-segment.log` before reinstalling.
