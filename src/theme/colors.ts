// Semantic color tokens. Mirrors the "GritMap/Color" variable collection in the
// Figma mock (figma.com/design/cyaMDDfLBKFc4NNK1SUUnb) — keep names in sync with
// that file's variable names (color/background, color/brand, etc.) so a design
// change and a code change can be cross-referenced by name.
export const colors = {
  background: "#F4F5F7",
  surface: "#FFFFFF",
  border: "#E5E7EB",

  textPrimary: "#15181D",
  textSecondary: "#6B7280",
  textTertiary: "#9CA3AF",
  textOnBrand: "#FFFFFF",

  brand: "#0D9488",
  brandSubtle: "#E6F4F2",

  statusSuccess: "#16A34A",
  statusSuccessSubtle: "#E7F6EC",
  statusWarning: "#B45309",
  statusWarningSubtle: "#FDF1DF",
  statusDanger: "#DC2626",
  statusDangerSubtle: "#FBE9E9",
  statusInfo: "#2563EB",
  statusInfoSubtle: "#E8EFFD",

  disabledBackground: "#E9EAEC",
  disabledText: "#AFB3BA",
} as const;

export type ColorToken = keyof typeof colors;
