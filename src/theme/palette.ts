// Raw colour primitives: the ONLY place hex values live. Everything the app draws comes from the
// semantic tokens in colors.ts, which point at these steps, so a rebrand is an edit to this file
// (for example, change `blue` and every button, link, tab and chart accent follows).
//
// Steps are tuned, not interpolated: each one was picked so the semantic pairings in colors.ts pass
// WCAG AA (src/theme/colors.test.ts says which pairing broke if you change one). Keep the step
// numbers in step with the "GritMap v2/Color" variables in the Figma file when you edit them.

export const palette = {
  white: "#FFFFFF",
  black: "#000000",

  /** Neutrals for text, surfaces and lines, light and dark. Low numbers are light, high are dark. */
  slate: {
    50: "#F5F6F8",
    100: "#E9EAEC",
    200: "#E3E5EA",
    300: "#A9B0BC",
    400: "#8A93A1",
    450: "#7C8493",
    500: "#646B78",
    550: "#5F6672",
    600: "#4A5160",
    750: "#262A32",
    800: "#1F242C",
    850: "#1B1E24",
    900: "#111317",
    950: "#0B0D12",
  },

  /** The interactive colour: buttons, links, the active tab, selected controls. */
  blue: {
    50: "#E7EFFF",
    400: "#6AA2FF",
    500: "#2F6FEB",
    600: "#0A5CFF",
    700: "#0847C7",
    800: "#1F57C9",
    950: "#0F2347",
  },

  /** Intensity colours: how hard a stretch of a plan asks you to ride. Rest, hold, push and max. */
  cyan: { 50: "#DFF3F8", 400: "#38BDF8", 700: "#0E7490", 950: "#0B2A38" },
  emerald: { 50: "#E3F5E9", 400: "#4ADE80", 700: "#14703A", 950: "#0F2E1B" },
  orange: { 50: "#FDF0DC", 400: "#FBBF24", 700: "#A94A06", 950: "#33260B" },

  /** Status colours. Red doubles as the "max" intensity. */
  green: { 50: "#E7F6EC", 400: "#4ADE80", 800: "#166534", 950: "#12301C" },
  amber: { 50: "#FDF1DF", 400: "#FBBF24", 800: "#92400E", 950: "#33260B" },
  red: { 50: "#FBE9E9", 400: "#F87171", 700: "#B91C1C", 950: "#381414" },
  info: { 50: "#E8EFFD", 400: "#60A5FA", 700: "#1D4ED8", 950: "#13233F" },
} as const;
