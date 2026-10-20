# Handoff: build every GritMap screen as editable Figma frames (task for a fresh session with the Figma tools)

- Updated: `2026-10-20 14:40 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `910153c docs: BLE verified on Karoo; multi-segment task unblocked for Codex`
- Worktree: Codex's uncommitted Karoo/doc/handoff edits only; no phone-app changes pending

## Outcome

Nothing built yet. Jason wants to redesign the app and cut screens that aren't necessary, and asked for every
screen to be placed in Figma so he can edit them there. Figma was authorized after the previous session started, so
that session had no Figma tools (a session loads its tools at start). This handoff lets a **new session in this
project** do the work.

## Task for the new session

Build every GritMap screen as editable frames in Jason's file:
`https://www.figma.com/design/cyaMDDfLBKFc4NNK1SUUnb/GritMap-Screens` (file key `cyaMDDfLBKFc4NNK1SUUnb`,
start at node `0:1`). Before the first Figma write, load the `figma-use` skill, as the tools require. Use the file
Jason supplied; do not create a new one unless it is unreachable.

Preferred output: native, editable frames (auto layout, text layers, real text styles and colors), one frame per
screen at iPhone size (402 x 874 pt; the simulator's iPhone 17 Pro), grouped by area in labeled sections. Fallback
for any screen that does not convert cleanly: a screenshot frame captured from the simulator, labeled as such.
Do not overwrite or delete anything already in the file without looking at it first.

## Screens (from `src/navigation/types.ts` and the navigators)

| Area | Screen (route) | File |
|---|---|---|
| Home tab | Home | `src/screens/HomeScreen.tsx` |
| Rides tab | Ride list (`RideList`) | `RideListScreen.tsx` |
| | Ride detail (`RideDetail`) | `RideDetailScreen.tsx` |
| | Import (`Import`) | `ImportScreen.tsx` (rows: `ImportFileRow.tsx`; modal: `DuplicateDecisionModal.tsx`) |
| | Define segment (`DefineSegment`) | `DefineSegmentScreen.tsx` |
| Segments tab | Segment list (`SegmentList`) | `SegmentListScreen.tsx` |
| | Segment detail (`SegmentDetail`) | `SegmentDetailScreen.tsx` |
| | Review effort (`AttemptReview`) | `AttemptReviewScreen.tsx` |
| | Compare efforts (`AttemptComparison`) | `AttemptComparisonScreen.tsx` |
| | Plan vs actual (`PlanVsActual`) | `PlanVsActualScreen.tsx` |
| | Progress over time (`HistoricalBand`) | `HistoricalBandScreen.tsx` |
| | Send to Karoo (`SendToKaroo`) | `SendToKarooScreen.tsx` (Bluetooth beta card: `BleSendSection.tsx`, dev-flagged) |
| | Import coach plan (`ImportCoachPlan`) | `ImportCoachPlanScreen.tsx` |
| | Share to Open Segments (`PublishToRegistry`) | `PublishToRegistryScreen.tsx` |
| | Open Segments browse (`RegistryBrowse`) | `RegistryBrowseScreen.tsx` |
| | Your Profile (`ZonesSettings`) | `ZonesSettingsScreen.tsx` |
| First run | Onboarding flow | `src/onboarding/OnboardingFlow.tsx` |

17 routed screens plus the onboarding flow and the duplicate-decision modal. Several screens have states worth a
frame each (empty, loading, error, with data); `src/theme/components/` has `EmptyState`, `ErrorState`, `LoadingState`.

## Design tokens and components to mirror

`src/theme/colors.ts` (light and dark palettes), `typography.ts`, `spacing.ts`, `layout.ts`, `icons.ts`, and the
shared components in `src/theme/components/` (`AppText`, `Button`, `Card`, `ListRow`, `Notice`, `SegmentedControl`,
`StatTile`, `TextField`, `Section`, `ScreenScroll`). Prefer Figma variables and styles taken from these tokens so
Jason's redesign edits tokens, not hex values. Wording rule: "zones" means power/HR zones only; pacing-plan
stretches are "sections".

## Getting real screen content

- iOS Simulator `iPhone 17 Pro` (UDID `D60DCABF-F1A9-4337-BA9C-2380791F107C`) has a data set: the Diablo Northgate to
  Junction segment, three rides, efforts and a plan. Install a Release build (`xcodebuild -workspace
  ios/GritMap.xcworkspace -scheme GritMap -configuration Release -sdk iphonesimulator -destination
  'generic/platform=iOS Simulator' -derivedDataPath <scratch>/dd CODE_SIGNING_ALLOWED=NO build`), launch with the
  simulator control tool and screenshot each route. The app database is at
  `<app data container>/Documents/SQLite/gritmap.db`; `app_settings` key `dev_ble_transfer` = `1` shows the
  Bluetooth card; `onboarding_completed_at_ms` controls the first-run flow.
- Never put personal ride GPS in a published file beyond the sample data above; the real ride files are gitignored.
- Nothing in this task needs the Karoo, `apps/karoo/`, a device, or any credentials.

## Verified

- Nothing built. Confirmed only that this session had no Figma tools and that the screen list matches the
  navigators and `src/navigation/types.ts` on `main` at the head above.

## External state

- Figma: authorized by Jason in his own account; the file above is empty or unknown to me; I have not read it.
- Nothing installed, pushed or published by this handoff.

## Goal alignment

- Not a `docs/GOALS.md` roadmap item: a design-exploration support task requested directly by Jason to prune screens.
  It does not change app behaviour or any shared contract. Read `docs/GOALS.md` first: the pruning decisions
  should be checked against the beta scope (and any screen the Karoo flow depends on, such as Send to Karoo and
  Your Profile, whose FTP the Karoo's plan import requires).

## Hazards and blockers

- The Figma tools may need a full session restart after authorization; if `use_figma` still cannot be found,
  re-authorize (`/mcp` in an interactive `claude` terminal) and start again.
- Converting React Native screens to Figma is manual: build frames from the code and simulator screenshots; there
  is no automatic export of these screens.
- The map screens (`RouteMapView`) show live OpenFreeMap tiles; use a screenshot for the map area.

## Next safe action

In the new session: read `docs/GOALS.md`, load `figma-use`, inspect the Figma file, create the token variables and
section structure, then build the screens one area at a time (Home, Rides, Segments, Tools, Onboarding) and report
the frame list back to Jason so he can mark which screens to cut.
