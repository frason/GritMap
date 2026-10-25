# GritMap design system (phone app)

One rule: **screens and components name tokens, never raw values.** Colours, type, spacing and
radii live in `src/theme/`. Changing how the app looks is an edit to a token file, not a hunt
through screens.

## Where things live

| What | File | Change it to... |
|---|---|---|
| Colour primitives (the only hex values) | `src/theme/palette.ts` | rebrand: edit a family (for example `blue`) and every button, link, tab and chart accent follows |
| Semantic colours, light and dark | `src/theme/colors.ts` | repoint a role (for example make `intensityPush` use a different step) |
| Appearance choice (system, light, dark) | `src/theme/appearance.ts`, `AppearanceProvider.tsx` | flip `DEFAULT_APPEARANCE` to `"system"` once every screen uses the themed components |
| Type scale | `src/theme/typography.ts` | change sizes or weights; every `AppText` follows |
| Spacing and radii | `src/theme/spacing.ts` | add a step (and its Figma variable) |
| Touch targets, screen padding | `src/theme/layout.ts` | |
| Icons by meaning | `src/theme/icons.ts` | swap the icon set behind a name |
| Shared components | `src/theme/components/` | |

## Using tokens

- Colour: `const colors = useColors();` then `colors.surface`, `colors.ctaText`. Never import the
  static `colors` export in new code. Never write a hex value outside `palette.ts`.
- Text: `<AppText variant="subheadlineEmphasized" color="textSecondary">`. Never set `fontSize` by hand.
- Spacing and radius: `spacing.space16`, `radius.lg`.
- Dark mode is automatic once a component uses `useColors()`; there is no per-component dark code.

## Names match Figma

The semantic colour names mirror the **GritMap v2/Color** variable collection in the Figma file
(`cyaMDDfLBKFc4NNK1SUUnb`), in camelCase: Figma `color/text-on-cta` is `textOnCta`,
`color/intensity-hold-subtle` is `intensityHoldSubtle`. Type styles mirror `Type/*`, spacing mirrors
`GritMap/Spacing` (`space/16` is `space16`). When you add or rename a token, change both.

Roles to know:

- `cta` is the fill of a primary button or selected control; `textOnCta` sits on it. `ctaText` is the
  same blue used for text, links, icons and the active tab (lighter in dark so it reads on black).
  `ctaSubtle` is the quiet tint for selected rows and info panels.
- `intensityRest`, `intensityHold`, `intensityPush`, `intensityMax` are how hard a stretch of a plan
  asks you to ride. Use the strong colour for text and marks, the `Subtle` colour for the background
  behind them. Do not use them for success or error; those are `status*`.
- `surface` is a card, `surfaceRaised` is a card on a card, a sheet or a menu, `background` is the screen.

## Shared components (`src/theme/components`)

Built from tokens only, so they follow light/dark and any future rebrand with no changes here.

| Component | Use it for |
|---|---|
| `AppText` | all text (a type-scale variant plus a colour token) |
| `Button` | primary, secondary, tertiary, destructive; optional icon and loading; primary darkens while pressed |
| `Card` | a grouped block; `raised` for a card on a card, a sheet or a menu |
| `ListRow`, `StatTile`, `Section` | rows, number tiles and titled groups |
| `TextField`, `SegmentedControl` | forms |
| `Chip` | a state, result, filter or plan intensity (`neutral`, `cta`, `solid`, `rest`, `hold`, `push`, `max`, `success`, `warning`, `danger`, `info`); tappable chips keep a 44 pt touch area |
| `ProgressBar` | how far along (a best time against a goal) |
| `HeaderIconBar` | the pill of icon buttons in a tab header (add, settings, search, filter) |
| `InfoBubble` | the (i) that holds an explanation, so screens carry less text. First-run and Karoo-setup steps stay visible and do not use it |
| `Notice`, `EmptyState`, `ErrorState`, `LoadingState` | feedback and the three states every screen designs |

Pure logic for each (colours per tone, accessibility labels, progress clamping) lives in a `.ts` file
next to the component and is unit-tested, including contrast in both palettes.

## Navigation shell

Three iOS-style tabs (Home, Rides, Segments) in `src/navigation/RootNavigator.tsx`. A tab's first page
draws a large title with a `HeaderIconBar` (`tabHeaders.tsx`); pushed pages use the standard back
header. The menus and where each button goes are data in `headerActions.ts`. React Navigation's own
colours come from `navigationTheme.ts`, so the chrome follows light and dark. `aiDock.ts` reserves room at the right end of the tab bar for the later AI icon button (tabs on the left, AI on the right).

## Contrast is enforced

`src/theme/colors.test.ts` checks every text-on-background pairing in both palettes (4.5:1 for text,
3:1 for control edges). If you change a palette step the test names the pairing that broke.

## Deprecated names

`brand`, `brandFill`, `brandSubtle` and `textOnBrand` still exist so screens that have not been
rebuilt keep working; they equal `ctaText`, `cta`, `ctaSubtle` and `textOnCta`. New code uses the
cta names. Delete the old names when the last screen has moved (a test pins that they stay equal).
