# Handoff: beta-loop screens moved onto the design system; Home safe-area fix (committed locally, not pushed)

- Updated: `2026-10-08 15:50 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `078e131 feat: move the beta-loop screens onto the design system` (handoff files committed on top)
- Worktree: clean for phone files. `apps/karoo/*` and `docs/BETA_KAROO_INSTALL.md` are Codex's and were not touched.

## Outcome

Every screen in the coordinator's migration list now uses `src/theme` tokens and components only (no hex colors,
font sizes or static `colors` left in them), with loading, empty and error states, 44 pt targets, Dynamic Type and
VoiceOver labels, in the order asked:

1. **Segment Detail** (efforts, Goal and pacing plan, elevation chart, attempts, overflow menu) and **Import coach plan**.
2. **Send to Karoo** (loading/missing/error, a success or failure notice that reads as a sentence).
3. **Import** (ride files and segment files): progress ("Importing file 2 of 5..."), per-file result rows, an overall
   summary, and in-screen results instead of native alerts; duplicate prompt restyled.
4. **Post-ride:** Plan vs actual, Progress over time (was "Historical Range"), Ride detail.

Also fixed first, as its own commit (coordinator request): **Home** drew under the status bar / Dynamic Island and a long
goal name pushed "Change" off screen (`3b3e590`). Ride dates from a different year now show the year.

Shared components added in `src/theme/components`: `ScreenScroll`, `Section`, `StatTile`/`StatRow`, `Notice`,
`HeaderButton`; `ListRow` gained `iconColor`/`selected`; `TextField` gained `multiline`. `ScreenScroll` keeps the same
ScrollView through loading/content (the old View-to-ScrollView swap left a blurred, unreadable title under the iOS 26
navigation bar on Plan vs actual and Historical range) and adjusts for the keyboard.

## Changed

- `3b3e590` Home fix + shared components + `formatRideDate` year (test added) + `docs/screenshots/redesign/home-fix/`.
- `078e131` the migrated screens, `PredictedFinish.tsx`, `describeImportSummary.ts` (+ test), navigator titles/header
  buttons, `scripts/seed-demo-efforts.ts`, `docs/screenshots/redesign/{before,after}/`.
- Charts (`ElevationProfileChart`, `PlanVsActualChart`, `ChannelChart`, `ElevationSparkline`) use the palette and
  type scale; each is one VoiceOver element with a spoken summary. Elevation chart: watt labels sit in their own strip
  (no longer overlapping the line), Hold bands are visible, legend says what Rest/Hold/Push mean.
- `scripts/seed-demo-efforts.ts`: seeds synthetic demo rides along a registry segment's own path through the app's own
  importer and matcher (`node scripts/seed-demo-efforts.ts --db <gritmap.db> --segment "<name>" [--efforts N]
  [--goal-minutes M]`, app closed). Used for the screenshots. I seeded **3** efforts (not 1) because Progress over time
  needs at least 3. No personal GPS data is in the repo or the screenshots.

### Behavior and copy changes (beyond pure restyling)

- Segment-file import: native `Alert`s became on-screen results; "already in your library" shows an "Open that segment"
  button. File-picker failures now show a message instead of failing silently.
- Duplicate prompt: the safe choice (**Keep the existing ride**) is now the filled button, Replace is outlined, and the
  text says what replacing does (clears approvals on that ride, rechecks segments). Same two outcomes as before.
- Wording: "zones" -> "sections"; "confidence" -> "match"; Max/Min -> Highest/Lowest; "Historical Range" -> "Progress
  Over Time" and "Compare to history" -> "See progress over time"; "Publish to Registry" (menu + title) -> "Share to Open
  Segments"; "Import Rides" -> "Import"; "Choose Files" -> "Choose ride files"; "Import Segment JSON" -> "Import a
  segment file"; "Attempts" -> "All your efforts"; Create Segment -> "Create a segment from this ride".
- **Send to Karoo** screen's button is "Send route to Karoo" because that screen sends the route only; the plan send
  button on Segment Detail is exactly `PHONE_SEND_BUTTON` ("Send plan to Karoo") and Karoo steps still read from
  `onboardingCopy.ts`. If the coordinator wants this button to say "Send plan to Karoo" too, it is a one-line change but
  would be inaccurate.
- Plan vs actual's six-column table became one row per section (status word + color, plan/actual/time); "Zones on
  target" -> "Sections on target". The overflow menu is a themed modal with 44 pt rows.
- No change to the database, matcher, pacing math, plan-send recording, or the Karoo transfer contract.

## Verified

- `npx tsc --noEmit`: clean. `npm test`: 616/616 pass. `npm run web:smoke`: clean (all after the final edit).
- iPhone 17 simulator (Dynamic Island), dev client against Metro, demo data (Diablo registry segment, 3 synthetic
  rides, goal 40:00, FTP 250 W, 74.84 kg): every migrated screen photographed before and after in
  `docs/screenshots/redesign/{before,after}/`, plus loading (`12a`), error (`06c` invalid plan, `07b` Karoo unreachable),
  import results (`09b`), duplicate prompt (`09c`), no-segments ride (`10b`), plan preview (`06b`), and Segment Detail at the
  largest accessibility text size (`01b`). Home at default and largest text with a very long segment name:
  `home-fix/`.
- Import was exercised with a synthetic GPX plus a corrupt `.fit` through the real file picker (removed afterwards, along
  with the synthetic ride).

## External state

- The simulator DB holds the demo data above (the long Home test name was reverted). Metro dev server still running.
- Nothing pushed. `3b3e590` and `078e131` (and earlier `be21320`) are local.

## Goal alignment

- `docs/GOALS.md` Priority 1 (beta-ready loop: onboarding/empty states/design practice) and the start of Priority 2 (phone
  redesign). Screens still on the old style: Attempt Review, Attempt Comparison, Define Segment, Publish to Registry (body
  still says "Registry"), Open Segments (registry browse), Rides list rows.
- No shared contract touched (segment JSON, `gritmap-transfer`, coach plan, rider profile, pairing). Codex: nothing to do;
  `docs/BETA_KAROO_INSTALL.md` wording still matches `onboardingCopy.ts` (I did not change those strings).

## Hazards and blockers

- **VoiceOver has not been run by a person.** Labels/roles/live regions are set and statically reviewed only.
- Changing text size *while the app is open* leaves a stale, squeezed layout until relaunch (seen on Plan vs actual and
  Segment Detail); after relaunch largest-size layouts are correct. A rider changing Dynamic Type mid-session may notice.
- Progress over time loads every effort's track synchronously; it took ~16 s on a heavily loaded Mac (3 efforts). Worth
  optimizing before riders have dozens of efforts.
- `src/import/batchImport.test.ts` asserts under 30 s and failed once at machine load ~470; it passed in the coordinator's
  run and in mine on a quiet machine.
- The dev client's floating "Tools" gear covers the top-right of the screen in simulator screenshots (dev-only).
- Light mode stays pinned; dark palette exists but screens are not verified in dark.

## Next safe action

Jason: look at `docs/screenshots/redesign/after/`, then OK pushing `be21320`, `3b3e590`, `078e131`. Next migration batch:
Attempt Review/Comparison (remove "Coverage / Max deviation / Matcher version" diagnostics from the default view), Define
Segment, Publish to Registry, Open Segments, then a VoiceOver pass on a real iPhone.
