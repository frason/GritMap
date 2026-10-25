import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { darkColors, lightColors } from "../colors.ts";
import { contrastRatio } from "../contrast.ts";
import { buttonAccessibility, resolveButtonColors, type ButtonVariant } from "./buttonStyle.ts";

const VARIANTS: ButtonVariant[] = ["primary", "secondary", "tertiary", "destructive"];

describe("resolveButtonColors", () => {
  for (const [name, palette] of [["light", lightColors], ["dark", darkColors]] as const) {
    for (const variant of VARIANTS) {
      for (const disabled of [false, true]) {
        it(`${name} ${variant}${disabled ? " (disabled)" : ""}: label text meets 4.5:1 on whatever it sits on`, () => {
          const colors = resolveButtonColors(palette, variant, disabled);
          // Transparent buttons sit on the screen background or a card surface; check both.
          const surfaces = colors.background === "transparent" ? [palette.background, palette.surface] : [colors.background];
          for (const surface of surfaces) {
            const ratio = contrastRatio(colors.text, surface);
            assert.ok(ratio >= 4.5, `${colors.text} on ${surface} is ${ratio.toFixed(2)}`);
          }
        });
      }
    }

    it(`${name}: a secondary button's outline is visible (3:1) against the screen`, () => {
      const { border } = resolveButtonColors(palette, "secondary", false);
      assert.ok(contrastRatio(border, palette.background) >= 3);
      assert.ok(contrastRatio(border, palette.surface) >= 3);
    });
  }

  it("fills only the primary and destructive variants", () => {
    assert.equal(resolveButtonColors(lightColors, "primary", false).background, lightColors.cta);
    assert.equal(resolveButtonColors(lightColors, "secondary", false).background, "transparent");
    assert.equal(resolveButtonColors(lightColors, "tertiary", false).background, "transparent");
  });
});

describe("pressed state", () => {
  for (const [name, palette] of [["light", lightColors], ["dark", darkColors]] as const) {
    it(`${name}: a pressed primary button is the darker fill and its label still meets 4.5:1`, () => {
      const pressed = resolveButtonColors(palette, "primary", false, true);
      assert.equal(pressed.background, palette.ctaPressed);
      assert.ok(contrastRatio(pressed.text, pressed.background) >= 4.5);
    });

    it(`${name}: pressing does not change the other variants or a disabled button`, () => {
      for (const variant of ["secondary", "tertiary", "destructive"] as const) {
        assert.deepEqual(resolveButtonColors(palette, variant, false, true), resolveButtonColors(palette, variant, false, false));
      }
      assert.deepEqual(resolveButtonColors(palette, "primary", true, true), resolveButtonColors(palette, "primary", true, false));
    });
  }
});

describe("buttonAccessibility", () => {
  it("is a button with its label, and enabled by default", () => {
    assert.deepEqual(buttonAccessibility({ label: "Save" }), {
      accessibilityRole: "button",
      accessibilityLabel: "Save",
      accessibilityState: { disabled: false, busy: false },
    });
  });

  it("announces progress and is not actionable while loading", () => {
    const state = buttonAccessibility({ label: "Send plan", loading: true });
    assert.equal(state.accessibilityLabel, "Send plan, in progress");
    assert.deepEqual(state.accessibilityState, { disabled: true, busy: true });
  });

  it("passes a hint through and reports disabled", () => {
    const state = buttonAccessibility({ label: "Next", hint: "Goes to step 3", disabled: true });
    assert.equal(state.accessibilityHint, "Goes to step 3");
    assert.equal(state.accessibilityState.disabled, true);
  });
});
