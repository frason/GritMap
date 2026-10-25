import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { colors, darkColors, lightColors, paletteForScheme, type ColorPalette } from "./colors.ts";
import { contrastRatio } from "./contrast.ts";

const TEXT_AA = 4.5;
const CONTROL_EDGE = 3;

const palettes: [string, ColorPalette][] = [
  ["light", lightColors],
  ["dark", darkColors],
];

describe("contrast helper", () => {
  it("matches the WCAG reference values", () => {
    assert.equal(contrastRatio("#000000", "#FFFFFF").toFixed(2), "21.00");
    assert.equal(contrastRatio("#FFFFFF", "#FFFFFF").toFixed(2), "1.00");
    assert.equal(contrastRatio("#767676", "#FFFFFF").toFixed(2), "4.54"); // the classic AA grey
  });

  it("rejects malformed colors", () => {
    assert.throws(() => contrastRatio("red", "#FFFFFF"), /#RRGGBB/);
  });
});

describe("paletteForScheme", () => {
  it("is dark only for a dark system appearance", () => {
    assert.equal(paletteForScheme("dark"), darkColors);
    assert.equal(paletteForScheme("light"), lightColors);
    assert.equal(paletteForScheme(null), lightColors);
    assert.equal(paletteForScheme(undefined), lightColors);
    assert.equal(paletteForScheme("unspecified"), lightColors);
  });
});

describe("palettes", () => {
  it("define exactly the same tokens", () => {
    assert.deepEqual(Object.keys(darkColors).sort(), Object.keys(lightColors).sort());
  });

  it("keep `colors` as the light palette for screens that have not moved to useColors()", () => {
    assert.equal(colors, lightColors);
  });

  it("use only #RRGGBB values, so contrast can always be checked", () => {
    for (const palette of [lightColors, darkColors]) {
      for (const [token, value] of Object.entries(palette)) assert.match(value, /^#[0-9A-Fa-f]{6}$/, token);
    }
  });

  it("keep the old brand names pointing at the interactive colours until screens move to the cta names", () => {
    for (const [name, palette] of palettes) {
      assert.equal(palette.brand, palette.ctaText, `${name}: brand`);
      assert.equal(palette.brandFill, palette.cta, `${name}: brandFill`);
      assert.equal(palette.brandSubtle, palette.ctaSubtle, `${name}: brandSubtle`);
      assert.equal(palette.textOnBrand, palette.textOnCta, `${name}: textOnBrand`);
    }
  });

  for (const [name, palette] of palettes) {
    describe(`${name}`, () => {
      const onBackgrounds: (keyof ColorPalette)[] = ["background", "surface", "surfaceRaised"];
      const readable: (keyof ColorPalette)[] = [
        "textPrimary",
        "textSecondary",
        "textTertiary",
        "ctaText",
        "statusSuccess",
        "statusWarning",
        "statusDanger",
        "statusInfo",
        "intensityRest",
        "intensityHold",
        "intensityPush",
        "intensityMax",
      ];

      for (const background of onBackgrounds) {
        for (const token of readable) {
          it(`${token} on ${background} meets 4.5:1`, () => {
            const ratio = contrastRatio(palette[token], palette[background]);
            assert.ok(ratio >= TEXT_AA, `${token} ${palette[token]} on ${background} ${palette[background]} is ${ratio.toFixed(2)}`);
          });
        }
      }

      it("text on a filled call-to-action button meets 4.5:1, in its resting and pressed states", () => {
        for (const fillToken of ["cta", "ctaPressed"] as const) {
          const ratio = contrastRatio(palette.textOnCta, palette[fillToken]);
          assert.ok(ratio >= TEXT_AA, `textOnCta on ${fillToken} is ${ratio.toFixed(2)}`);
        }
      });

      it("status and intensity text on its tinted background meets 4.5:1", () => {
        const pairs: [keyof ColorPalette, keyof ColorPalette][] = [
          ["statusSuccess", "statusSuccessSubtle"],
          ["statusWarning", "statusWarningSubtle"],
          ["statusDanger", "statusDangerSubtle"],
          ["statusInfo", "statusInfoSubtle"],
          ["ctaText", "ctaSubtle"],
          ["intensityRest", "intensityRestSubtle"],
          ["intensityHold", "intensityHoldSubtle"],
          ["intensityPush", "intensityPushSubtle"],
          ["intensityMax", "intensityMaxSubtle"],
        ];
        for (const [foreground, background] of pairs) {
          const ratio = contrastRatio(palette[foreground], palette[background]);
          assert.ok(ratio >= TEXT_AA, `${foreground} on ${background} is ${ratio.toFixed(2)}`);
        }
      });

      it("primary and secondary text also read on a cta-tinted card", () => {
        assert.ok(contrastRatio(palette.textPrimary, palette.ctaSubtle) >= TEXT_AA);
        assert.ok(contrastRatio(palette.textSecondary, palette.ctaSubtle) >= TEXT_AA);
      });

      it("disabled text still meets 4.5:1 on the disabled background", () => {
        assert.ok(contrastRatio(palette.disabledText, palette.disabledBackground) >= TEXT_AA);
      });

      it("a form control's edge is visible (3:1) against every background it can sit on", () => {
        assert.ok(contrastRatio(palette.borderStrong, palette.surface) >= CONTROL_EDGE, "on surface");
        assert.ok(contrastRatio(palette.borderStrong, palette.background) >= CONTROL_EDGE, "on background");
        assert.ok(contrastRatio(palette.borderStrong, palette.surfaceRaised) >= CONTROL_EDGE, "on surfaceRaised");
      });

      it("the chart line is readable against the background and a card", () => {
        assert.ok(contrastRatio(palette.chartLine, palette.background) >= CONTROL_EDGE);
        assert.ok(contrastRatio(palette.chartLine, palette.surface) >= CONTROL_EDGE);
      });
    });
  }

  it("dark mode is a true black background with lifted surfaces", () => {
    assert.equal(darkColors.background, "#000000");
    assert.notEqual(darkColors.surface, darkColors.background);
    assert.notEqual(darkColors.surfaceRaised, darkColors.surface);
  });
});
