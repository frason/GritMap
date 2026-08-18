// Semantic spacing/radius tokens. Mirrors the "GritMap/Spacing" variable
// collection in the Figma mock — keep names in sync with that file's variable
// names (space/16, radius/md, etc.).
export const spacing = {
  space2: 2,
  space4: 4,
  space8: 8,
  space12: 12,
  space16: 16,
  space20: 20,
  space24: 24,
  space32: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radius;
