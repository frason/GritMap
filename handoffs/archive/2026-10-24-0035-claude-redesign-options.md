# Handoff: phone redesign options in Figma (light and dark, three navigation structures)

- Updated: `2026-10-24 00:35 PDT`
- Agent: `Claude`
- Branch: `claude/gritmap-figma-screens-a4c73c`
- Head: `860f82c docs: handoff for building the GritMap screens in Figma` (plus this file and the LATEST entry, uncommitted)
- Worktree: this handoff file and a `handoffs/LATEST.md` entry only; no app code touched

## Outcome

Options for Jason's review, not decisions. Figma file `cyaMDDfLBKFc4NNK1SUUnb` ("GritMap-Screens"), new page **GritMap Redesign Options**, six sections:

1. **Read me** — option summaries with pros and cons, notes on the complaint fixes, new tokens needed, open items.
2. **Foundations v2** — the new colour collection as swatches, the v2 Button and Chip components, extra icons.
3. **Option A: bottom tabs** (Home, Plans, Rides, Explore). 8 screens, each in Light and Dark.
4. **Option B: Rides, Goals, Settings** (no navigation bar; three panels on one home, everything else pushed). 9 screens, Light and Dark.
5. **Option C: segment cards, plans first** (top Segments or Rides switch, floating Add button, plan and Send to Karoo on the home card). 8 screens, Light and Dark.
6. **Fixes** — Jason's three complaints, Light and Dark: long-segment elevation view (F1 auto 1-mile blocks that fit the screen, F2 scroll with edge fade, arrow, "swipe for all sections" chip and minimap), create segment (clear Start and Finish modes: F3 start, F4 finish), compare efforts (chart first, metric chips, touch cursor with readout, zones and detail collapsed).

Every option shows: home, a segment with its plan, the send-to-Karoo flow (waiting and sent; Bluetooth first, Wi-Fi as a fallback link), rides, ride results, Open Segments browse, and the empty first run (which says plainly that GritMap needs a power meter and a heart-rate monitor). A reserved docked-AI handle is on the left edge of the home screens; nothing deeper is designed for it.

The earlier page **GritMap App Screens** (59 frames of the current app, built 2026-10-20) is unchanged. When it was built, the old `GritMap/Color` Light values were updated to match `src/theme/colors.ts` (text-secondary 6B7280 to 4B5563, text-tertiary 9CA3AF to 646B78, brand 0D9488 to 0F766E, status-success 16A34A to 166534, status-warning B45309 to 92400E, status-danger DC2626 to B91C1C, status-info 2563EB to 1D4ED8, disabled-text AFB3BA to 5F6672) and a Dark mode was added; the original "Page 1" mock was left in place.

## Build (started 2026-10-24): direction chosen by Jason and step (a) tokens

- **Navigation chosen by Jason: Option B2** (three iOS-style tabs Home, Rides, Segments; header icon bars; Rides map cards; ride page with a three-height sheet; Segments cards with plan strip; segment page = Option A's Plan, Efforts and Course tabs; search opens Explore). The A and C options are not being built.
- **Branch:** `claude/redesign-foundation` in the worktree `.claude/worktrees/gritmap-figma-screens-a4c73c`, based on `origin/main` 27e452f. Nothing committed or pushed. Build 8 (`build8b`) is not part of this branch; do not edit its screens' logic differently.
- **Step (a) done, uncommitted, pure UI (no data, migration, BLE or plan logic changes):** `src/theme/palette.ts` (the only hex values; tuned steps), `colors.ts` rebuilt on the primitives with the v2 tokens (cta, ctaText, ctaSubtle, textOnCta, surfaceRaised, intensity rest/hold/push/max with tints, chart and scrim; old brand names kept as deprecated aliases), spacing 6/10/14/18, `subheadlineEmphasized` and `footnoteEmphasized` text styles, `appearance.ts` plus `AppearanceProvider.tsx` and `useColors` following the rider's choice (stored in `app_settings` key `appearance`, no migration; default stays light until every screen is themed, then flip `DEFAULT_APPEARANCE` and `app.json` `userInterfaceStyle`), a themed status bar in `App.tsx`, `docs/DESIGN_SYSTEM.md`. The whole app is now blue instead of teal.
- **Verified:** `npm run typecheck` clean; `npm test` 815 tests, 0 failures (theme tests extended: contrast for every pairing in both palettes incl. intensity and raised surfaces, aliases pinned, spacing and type scale). No hex values left outside `palette.ts`. Not run: simulator.
- **Figma synced:** added `color/cta-text` and `space/6,10,14,18`; tuned light `intensity-hold` #14703A, `intensity-push` #A94A06, `text-tertiary` #646B78 and `border-strong` #7C8493 to match code (these changed to pass contrast).
- **Plan placement (Jason's decision via the coordinator, 2026-10-24):** keep B2 as is (Home, Rides, Segments; segment page Plan, Efforts, Course). Decide whether plans also get a list (on Home or its own area) only after Jason sees the Plan tab built. The Plan tab must be a full first-class view (goal and staged goal, targets by section, predicted finish, realistic-plan notices, coach-plan import, send to Karoo with the On Karoo / Last sent mark), not a cramped card. The shared components must let a plans list (all planned segments in one place) be added without rework. When the Plan tab is built, show Jason it plus one sketch of a plans-list option. GOALS priority 4: plans must not be buried.
- **Step (b) done (shared components), uncommitted, pure UI:** existing components moved onto the cta tokens (Button radius lg and a darker pressed fill, SegmentedControl, TextField focus, ListRow selection, HeaderButton, LoadingState, Card `raised`); new `Chip` (11 tones, tappable chips keep a 44 pt area), `ProgressBar`, `HeaderIconBar`, `InfoBubble`; 14 new semantic icons (home, bolt, heart, trophy, sparkles, settings, filter, swap, user, compass, close, check, chevronDown); `docs/DESIGN_SYSTEM.md` lists them. Verified: typecheck clean, 851 tests, 0 failures (new tests: chip contrast per tone in both palettes, button pressed state, progress clamping, icon names exist in the icon font). Not verified: on a device or simulator (the components are not on any screen yet; the first on-screen check is step c). Still to build for plans: `PlanStrip`, plan section rows and the Karoo mark (steps d and e), designed so a plans list can reuse them.
- **Step (c) done (navigation shell), uncommitted, pure UI:** `RootNavigator` is the B2 shell: iOS-style bottom tabs Home, Rides, Segments on the tokens (new icons, `ctaText` active, theme-driven bar). Each tab's first page draws a large-title header with a `HeaderIconBar` (`src/navigation/TabHeader.tsx`, `tabHeaders.tsx`): Home (plus menu: Import a ride, Find a segment, New segment from a ride; gear), Rides (plus = Import), Segments (search = Open Segments, plus menu: New segment from a ride / from a file / Find in Open Segments). Pushed pages keep the standard back-button header. Home's gear opens "Your Profile" for now (the full Settings screen with the appearance choice comes later). The old Rides "Import" and Segments "Profile" and "Open Segments" header buttons are replaced by these icons. `NavigationContainer` takes its colours from the tokens (`navigationTheme.ts`), so tab bar, headers and back buttons follow light and dark. The AI dock is only reserved (`aiDock.ts`: 22 x 64 pt left-edge handle and clearance; nothing built). One layout line touched in `HomeScreen.tsx`: its own top safe-area inset is removed because the tab header now clears the status bar (no logic changed; flag to the build8b owner). Rides filter is not added yet (no filters exist). Verified: typecheck clean, 859 tests 0 failures (new: menus, navigation targets, theme colours, dock numbers), `expo export --platform ios` bundles. Not verified: on a simulator or device (Mac load was high and a native rebuild is long); the first visual check should be done by Jason or on the next simulator pass, with the Dynamic Type, VoiceOver and 44 pt checks for the tab headers.
- **Next (waiting for Jason's review):** (b) shared components (Chip, ProgressBar, header icon bar, info bubble, themed Button/Card/ListRow/forms, empty/loading/error), then (c) the tab shell with room reserved for the later AI panel, (d) plans, (e) Home/Segments with On Karoo and Last sent marks from the phone's send log, (f) ride results, compare, create segment modes, Open Segments, onboarding.

## Round 2 (same day, after Jason's feedback)

- Audit and added screens, each in Light and Dark: A8 Plans tab, A9 segment detail (course), A10 settings, A11 open segment preview; B9 goals list, B10 plan editor, B11 open segment preview, B12 import rides; C8 segment detail, C9 settings, C10 open segment preview, C11 make a plan. Still missing for all: loading and error states for the new screens.
- Fixes: F2 (scroll with cues) is the preferred long-segment elevation, F1 kept as an alternative. Create segment v2 (F5a, F5b) is modelled on the Strava crop screen Jason shared: full-screen map, Start and Finish each on their own bar with nudge buttons, an elevation strip on the shared axis, Save opens a name sheet, no modes. v1 (F3, F4) kept.
- Create segment v3 (F6a to F6d, Light and Dark) replaces v2 after Jason's feedback: Start and Finish are modes. The active one is expanded (value with arrows, slider); the other collapses to one line with no arrows and expands when tapped. Dragging or tapping the elevation strip zooms it onto that section for fine-tuning, then it returns to the full route after 3 seconds. The locate button (crosshair, ringed in the mode colour) re-centres the map on the active pin: the map is panned so the start (or finish) sits in the middle of the map window. v1 (F3) and v2 (F5) are kept, labelled. The Dark frames have prototype links for the tap, zoom and 3-second return (flow "Create segment v3 (Dark)").
- "On Karoo" status marks (requested by Jason via the coordinator): a chip in three states, "On Karoo" (known), "Older plan on Karoo" (known, Karoo plan older than the phone's) and a quiet "Last sent <date>" (not known; phone only knows what it sent). Placed on list rows and cards (A1, A8; B9; C1) and in segment page headers (A2; B2; C2; C8), Light and Dark. A spec frame in "Foundations v2" ("Karoo status: states and data needs") lists, per state, the data needed for the known version (Karoo inventory: segment id or fingerprint, plan id and hash, plan version and received time, a "checked" time) and for the not-known fallback (phone send log: segment id, plan hash, sent time, imported or rejected result; and plan updated time for a phone-only "Changed since last sent"). Nothing here assumes the inventory contract's shape, which is Codex's design note.
- Option B2 ("Option B2: Home, Rides, Segments (tabs)" section, 21 screens, Light and Dark): Jason's chosen direction for B. Three iOS-style tabs; each header has an icon bar (Home +/gear, Rides +/filter, Segments search/+); search opens Explore. Home and Rides use large map cards with the sent-to-Karoo segments highlighted and PRs called out. The ride page is a full-width map with a three-height sheet (opens at half). Segments are cards with the plan strip and Karoo marks; the segment page is Option A's Plan, Efforts and Course tabs; Compare is in Efforts. Home lists segments sent from this phone ("Last sent" marks until the Karoo inventory exists). Dark frames have prototype links (79 interactions; flows "B2 tabs" and "B2 first run"). Map highlights are illustrative overlays; not click-tested in present mode.
- The Dark frames of A, B and C are wired as clickable Figma prototypes (six flows: home-to-send and first run for each option). Not click-tested in present mode.

## Changed

- Figma only. New variable collection `GritMap v2/Color` (Light and Dark, 33 tokens: cta, intensity rest/hold/push/max with tints, surface-raised, scrim, chart tokens, status). It reuses `GritMap/Spacing`. New text styles `Type/subheadlineEmphasized`, `footnoteEmphasized`, `bodyEmphasized`. New components `v2 Button` and `v2 Chip`.
- Repo: this file and a `handoffs/LATEST.md` entry. No `src/` changes.

## Verified

- Screenshots of every section were reviewed after building (Light and Dark pairs, including the Read me page).
- Not verified: contrast of intensity text on its tint; Dynamic Type at large sizes; Dark map tiles (maps are simulator screenshots and stay light); VoiceOver order. 44 pt targets were used for buttons and icon buttons, but chips are smaller and are display-only in these frames.

## External state

- Figma file edits only. A hidden helper layer used while building was removed.
- Simulator `iPhone 17 Pro` still has the Release build and demo data installed from the earlier task.

## Goal alignment

- Serves priority 2 (full phone redesign), built around priority 4 (plans first), with Open Segments (3) designed as a first-class area. Navigation was left open on purpose.
- Contracts: none touched. Phone-only; no Karoo fields.
- Spacing: a few layouts use 6, 10, 14 and 18 pt that are not in `src/theme/spacing.ts`; add those tokens or snap to the scale before implementation.
- Sample data: the Diablo segment and ride numbers come from the simulator demo data; other segment names, times and goals are illustrative. Nothing personal is in the repo or the file.

## Hazards and blockers

- Choosing a direction is Jason's. Nothing here should be built until he does.
- Not designed: a multi-plan list per segment (the Plans tab in A is shown only as the segment plan page), settings screens beyond B's, info-bubble copy (icons are placeholders), loading and error states for the new screens (the earlier app frames cover the old ones).
- Inter stands in for SF Pro in Figma.

## Next safe action

Jason reviews the Read me, picks or mixes a navigation option and the long-segment approach. Then design the multi-plan list, info-bubble copy and the missing states for the chosen option before any code.
