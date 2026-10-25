// Semantic spacing/radius tokens. Mirrors the "GritMap/Spacing" variable collection in the Figma
// file; keep names in sync with that file's variable names (space/16, radius/md, etc.).
// space/6, space/10, space/14 and space/18 were added for the redesign, where tight layouts
// (chips, caption strips, stat rows) sit between the original steps.
export const spacing = {
  space2: 2,
  space4: 4,
  space6: 6,
  space8: 8,
  space10: 10,
  space12: 12,
  space14: 14,
  space16: 16,
  space18: 18,
  space20: 20,
  space24: 24,
  space32: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radius;
