# Handoff: first-run onboarding, design foundations and empty states on the phone

- Updated: `2026-10-08 14:25 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `5fa75b8 docs: coordinator record of the current phone task` (the work below is the single commit that follows this head; **not pushed**)
- Worktree: clean after the commit; `apps/karoo/` and Codex's files untouched. Nothing pushed.

## Outcome

A stranger's fresh install now works: on an empty database the app opens a four-step onboarding (what GritMap does,
FTP and weight, how to get a segment, how to connect the Karoo) and then lands on an **empty Segments screen** with three
clear ways to get a segment. Walked on a wiped iPhone 17 simulator install (uninstalled and reinstalled the dev client;
new container, no database) -- screenshots in `docs/screenshots/onboarding/` (see list below). The design foundations the
coordinator asked for are in `src/theme/`.

## Changed

**Design system (`src/theme/`)**
- `colors.ts`: light and dark palettes with identical tokens, plus `paletteForScheme`; `colors` stays as the light
  palette for screens not yet migrated. Contrast was a real problem (brand teal on white was 3.7:1, `textTertiary`
  2.5:1, green 3.3:1): values retuned, new `brandFill` (button fill) and `borderStrong` (control edges). **This shifts
  the brand/secondary/tertiary/status colors slightly on every existing screen** (darker teal `#0F766E`, etc.).
- `contrast.ts` + `colors.test.ts`: WCAG AA (4.5:1 text, 3:1 control edges) asserted for every text/background pairing in
  **both** palettes, so a future color edit that breaks contrast fails the build.
- `typography.ts`: iOS text-style scale (largeTitle 34 ... caption2 11) with per-style Dynamic Type caps.
  `layout.ts`: 44 pt touch target, 50 pt primary button, screen padding. `useColors.ts`: palette follows the system
  appearance (`app.json` still pins `"userInterfaceStyle": "light"`, so dark ships dormant until every screen uses it).
- `components/`: `AppText`, `Button` (primary/secondary/tertiary/destructive, loading, a11y state), `Card`, `ListRow`,
  `TextField` (visible label, hint, unit, error read out by VoiceOver), `SegmentedControl`, `EmptyState`, `ErrorState`,
  `LoadingState`. Style/accessibility decisions are pure functions with tests (`buttonStyle`, `accessibility`).
- `Icon.tsx` now uses the palette and hides icons from VoiceOver; a few new icon names.

**Onboarding (`src/onboarding/`, `App.tsx`, `RootNavigator.tsx`)**
- `OnboardingFlow.tsx` (4 steps, Back, progress, skip on every step after Welcome, VoiceOver focus moves to each step's
  title, footer collapses to **Done** while the number pad is open). `onboardingState.ts`: shown only for an empty install;
  an install with any ride, segment or saved FTP is treated as existing and marked complete (so the author's own phone and
  every pre-onboarding install skip it). `riderNumbers.ts`: FTP/weight/max-HR parsing with plain-language errors, **kg or
  lb** (defaults to lb in US/LR/MM locales, stored as kg). `onboardingCopy.ts`: all wording and the canonical screen names.
- After onboarding the app opens on the **Segments** tab.

**Empty/loading/error states and plain language**
- Rides, Segments, Home, Open Segments (empty, loading, error) and **Segment Detail with no efforts** all use the shared
  states and say what to do. Segment list rows show "6.5 mi · No efforts yet" instead of "30m corridor" (`listSegments`
  now returns length and effort count). "Rerun matcher" is now "Check my rides again". Raw network/HTTP errors on Open
  Segments are reworded (`describeRegistryError`).
- **Open Segments listed raw fingerprints as names** (found during the walkthrough). It now reads each shared file and
  shows the name and length (`summarizeRegistrySegment`), with an Add button. The header link and screen are called
  **Open Segments** (was "Registry"); the profile screen is **Your Profile** (was "Power/HR Zones") and is reachable
  from a new **Profile** button on the Segments tab -- before, FTP and weight could not be edited once set.
- `ZonesSettingsScreen` (profile) and `SendToKarooScreen` rebuilt on the design system; the send screen shows the same
  five steps as onboarding. The inline send fields on Segment Detail carry the "open GritMap on the Karoo, tap Receive
  from Phone" hint and the example address.

**Hardcoded assumptions removed:** no personal data was found in `src/` apart from two code comments naming a specific
climb (neutralized). Remaining assumptions the beta should know: imperial units on all ride screens (miles, feet, mph),
and the Open Segments registry is this project's own public GitHub folder (`registryConfig.ts`).

**Screenshots** (`docs/screenshots/onboarding/`, simulator, 1000 px): 01 welcome, 02 numbers filled, 03 FTP error,
04 get a segment, 05 connect your Karoo, 06 Segments empty, 07 Rides empty, 08 Home empty, 09 Open Segments, 10 Segment
Detail with no efforts, 11 Your Profile, 12 Your Profile at the largest accessibility text size. The blue gear is the
development client's Tools button; it does not exist in a release build.

## Verified

- `npm run typecheck` clean; `npm test` **608/608** (was 493); `npm run web:smoke` clean.
- Fresh install walked on the iPhone 17 simulator (iOS 27) against the real Metro bundle: onboarding -> numbers
  validated ("FTP is usually between 40 and 700 watts") -> 250 W / 165 lb saved as 250 W / 74.84 kg (checked in the
  simulator's SQLite: `onboarding_completed_at_ms` set, `profile_version` 1) -> empty Segments. Open Segments loaded the two
  published segments with names; adding one opened Segment Detail with the no-efforts card. Dynamic Type at
  accessibility-extra-extra-extra-large still lays out and scrolls.
- **Not verified:** VoiceOver (no screen reader run; labels, roles, states and focus move are set and unit-tested only),
  dark mode (palette tested, app pinned light), a physical iPhone, Android, and a real send to a Karoo from the new screens.
- One simulator oddity worth knowing: the dev client's floating Tools button swallowed a tap on a button underneath it.

## External state

- The simulator `iPhone 17 (Manual QA)` now holds the fresh-install state (onboarding complete, FTP 250 W, 165 lb, one
  Open Segment added). Metro is still running on :8081. No Karoo or phone hardware touched.

## Goal alignment

- **Priority 1 (beta-ready loop)**: first-run onboarding, empty states and in-app Karoo instructions for a stranger; and
  the "beta-loop screens meet standard mobile design practice" bullet for onboarding, the profile screen, the send-to-Karoo
  screen and Open Segments. **Priority 2** (full phone redesign) is started, not done: segment detail, plan, import,
  ride detail, attempt review and plan-vs-actual still use their old ad-hoc styles. **Priority 3** (Open Segments usable
  by strangers) advanced: names instead of fingerprints and plain errors; publishing still needs a personal GitHub token
  and is the next blocker there.
- Shared contracts touched: **none**. No segment JSON, `gritmap-transfer`, coach plan, rider profile or pairing change.
  The rider profile still stores kilograms; the phone only converts at entry.
- **Karoo side (Codex), wording to keep consistent with `docs/BETA_KAROO_INSTALL.md`:** the phone tells riders to
  (1) install the extension "following the Karoo install guide you were sent" and look for **GritMap** in the Karoo's app
  list, (2) put phone and Karoo on the same Wi-Fi or an iPhone **Personal Hotspot**, (3) on the Karoo open **GritMap** and tap
  **Receive from Phone**, which shows an address like **192.168.1.23:8734** and stays open **10 minutes**, (4) on the phone
  open a segment and tap **Send plan to Karoo**, typing the address once, (5) check the Karoo. Exact strings live in
  `src/onboarding/onboardingCopy.ts` (`KAROO_RECEIVE_SCREEN`, `PHONE_SEND_BUTTON`, `KAROO_RECEIVE_WINDOW_MINUTES`,
  `KAROO_ADDRESS_EXAMPLE`) and are asserted by a test; if the Karoo button, address format, port or timeout change, change
  them there. The install guide should say how to find GritMap in the app list and which fields to add, since the phone
  points to it for step 1.

## Hazards and blockers

- The retuned light palette changes the look of every existing screen a little (darker teal, darker secondary text). It is
  an accessibility fix, but review a few screens before the beta build.
- Existing screens still use the static `colors` and ad-hoc styles; only new/rebuilt screens use the design system.
  Dark mode must stay off until they all do.
- Imperial-only units; publishing to Open Segments still needs a GitHub token; the onboarding says "the Karoo install guide
  you were sent", which must exist and be delivered with the beta.
- The Open Segments list fetches each shared file to read its name (capped at 60). Fine for the current handful; it needs
  an index file before the registry grows.
- VoiceOver has not been exercised by a person. Do a pass before inviting testers.

## Next safe action

Have a person walk the install on a real iPhone with VoiceOver
and the largest text size. Next phone work in priority order: migrate Segment Detail / plan / send / import / post-ride
screens onto the design system, then publishing to Open Segments without a personal token.
