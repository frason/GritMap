import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { darkColors, lightColors } from "../colors.ts";
import { contrastRatio } from "../contrast.ts";
import { chipAccessibilityLabel, resolveChipColors, type ChipTone } from "./chipStyle.ts";

const TONES: ChipTone[] = ["neutral", "cta", "solid", "rest", "hold", "push", "max", "success", "warning", "danger", "info"];

describe("resolveChipColors", () => {
  for (const [name, palette] of [["light", lightColors], ["dark", darkColors]] as const) {
    for (const tone of TONES) {
      it(`${name} ${tone}: the label meets 4.5:1 on the chip`, () => {
        const { text, background } = resolveChipColors(palette, tone);
        const ratio = contrastRatio(text, background);
        assert.ok(ratio >= 4.5, `${text} on ${background} is ${ratio.toFixed(2)}`);
      });
    }

    it(`${name}: a neutral chip is told apart from the screen by its hairline`, () => {
      const { border } = resolveChipColors(palette, "neutral");
      assert.equal(border, palette.border);
      for (const tone of TONES.filter((t) => t !== "neutral")) assert.equal(resolveChipColors(palette, tone).border, "transparent");
    });
  }

  it("keeps the intensity tones on the intensity tokens, not the status ones", () => {
    assert.equal(resolveChipColors(lightColors, "push").text, lightColors.intensityPush);
    assert.equal(resolveChipColors(lightColors, "warning").text, lightColors.statusWarning);
  });
});

describe("chipAccessibilityLabel", () => {
  it("says selected only for a chosen chip", () => {
    assert.equal(chipAccessibilityLabel("Nearby", true), "Nearby, selected");
    assert.equal(chipAccessibilityLabel("Nearby", false), "Nearby");
    assert.equal(chipAccessibilityLabel("On Karoo", undefined), "On Karoo");
  });
});
