import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_APPEARANCE, parseAppearance, resolveScheme } from "./appearance.ts";

describe("parseAppearance", () => {
  it("accepts the three choices", () => {
    assert.equal(parseAppearance("system"), "system");
    assert.equal(parseAppearance("light"), "light");
    assert.equal(parseAppearance("dark"), "dark");
  });

  it("falls back to the default for anything else", () => {
    assert.equal(parseAppearance(undefined), DEFAULT_APPEARANCE);
    assert.equal(parseAppearance(""), DEFAULT_APPEARANCE);
    assert.equal(parseAppearance("Dark"), DEFAULT_APPEARANCE);
    assert.equal(parseAppearance("auto"), DEFAULT_APPEARANCE);
  });
});

describe("resolveScheme", () => {
  it("lets an explicit choice win over the phone", () => {
    assert.equal(resolveScheme("light", "dark"), "light");
    assert.equal(resolveScheme("dark", "light"), "dark");
    assert.equal(resolveScheme("dark", null), "dark");
  });

  it("follows the phone for system, and is light when the phone does not say", () => {
    assert.equal(resolveScheme("system", "dark"), "dark");
    assert.equal(resolveScheme("system", "light"), "light");
    assert.equal(resolveScheme("system", null), "light");
    assert.equal(resolveScheme("system", undefined), "light");
    assert.equal(resolveScheme("system", "unspecified"), "light");
  });
});
