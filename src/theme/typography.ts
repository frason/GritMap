/**
 * Type scale, named after (and sized like) the iOS text styles at the default Dynamic Type size, so
 * a designer, an engineer and the HIG all use the same words. Every style scales with the rider's
 * text-size setting (React Native's `allowFontScaling` is on by default); layouts built from these
 * must grow vertically and never fix a height around text.
 *
 * `maxFontSizeMultiplier` stops the very largest accessibility sizes from breaking a fixed-size
 * surface: big titles are already large, so they are capped lower than body text.
 */
export type TypographyStyle = {
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly fontWeight: "400" | "600" | "700";
  readonly maxFontSizeMultiplier: number;
};

export const typography = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: "700", maxFontSizeMultiplier: 1.3 },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: "700", maxFontSizeMultiplier: 1.4 },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: "700", maxFontSizeMultiplier: 1.5 },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: "600", maxFontSizeMultiplier: 1.6 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: "600", maxFontSizeMultiplier: 2 },
  body: { fontSize: 17, lineHeight: 22, fontWeight: "400", maxFontSizeMultiplier: 2 },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: "400", maxFontSizeMultiplier: 2 },
  subheadline: { fontSize: 15, lineHeight: 20, fontWeight: "400", maxFontSizeMultiplier: 2 },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: "400", maxFontSizeMultiplier: 2 },
  caption1: { fontSize: 12, lineHeight: 16, fontWeight: "400", maxFontSizeMultiplier: 2 },
  caption2: { fontSize: 11, lineHeight: 13, fontWeight: "400", maxFontSizeMultiplier: 2 },
} as const satisfies Record<string, TypographyStyle>;

export type TypographyVariant = keyof typeof typography;

/** Nothing below this is used for text a rider has to read. */
export const MIN_BODY_FONT_SIZE = 11;
