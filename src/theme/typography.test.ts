import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MIN_TOUCH_TARGET, PRIMARY_BUTTON_HEIGHT } from "./layout.ts";
import { MIN_BODY_FONT_SIZE, typography } from "./typography.ts";

describe("type scale", () => {
  const order = ["largeTitle", "title1", "title2", "title3", "headline", "body", "callout", "subheadline", "footnote", "caption1", "caption2"] as const;

  it("is ordered from largest to smallest and never grows back", () => {
    for (let i = 1; i < order.length; i += 1) {
      assert.ok(typography[order[i]!].fontSize <= typography[order[i - 1]!].fontSize, `${order[i]} bigger than ${order[i - 1]}`);
    }
  });

  it("gives every style room: line height at least the font size, and sane multipliers", () => {
    for (const name of order) {
      const style = typography[name];
      assert.ok(style.lineHeight >= style.fontSize, `${name} line height`);
      assert.ok(style.fontSize >= MIN_BODY_FONT_SIZE, `${name} is below the readable minimum`);
      assert.ok(style.maxFontSizeMultiplier >= 1.3 && style.maxFontSizeMultiplier <= 3, `${name} multiplier`);
    }
  });

  it("lets larger styles cap lower than body text, since they are already big", () => {
    assert.ok(typography.largeTitle.maxFontSizeMultiplier < typography.body.maxFontSizeMultiplier);
  });

  it("matches the iOS text-style sizes at the default Dynamic Type setting", () => {
    assert.deepEqual(
      [typography.largeTitle.fontSize, typography.title1.fontSize, typography.headline.fontSize, typography.body.fontSize, typography.footnote.fontSize, typography.caption2.fontSize],
      [34, 28, 17, 17, 13, 11],
    );
  });
});

describe("layout constants", () => {
  it("keep touch targets at the HIG minimum or above", () => {
    assert.equal(MIN_TOUCH_TARGET, 44);
    assert.ok(PRIMARY_BUTTON_HEIGHT >= MIN_TOUCH_TARGET);
  });
});
