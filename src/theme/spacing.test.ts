import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { radius, spacing } from "./spacing.ts";

describe("spacing scale", () => {
  it("only goes up, with no repeats", () => {
    const values = Object.values(spacing);
    for (let i = 1; i < values.length; i += 1) assert.ok(values[i]! > values[i - 1]!, `${values[i]} after ${values[i - 1]}`);
  });

  it("names every token after its value, so the Figma variable space/N and the code agree", () => {
    for (const [name, value] of Object.entries(spacing)) assert.equal(name, `space${value}`);
  });

  it("includes the in-between steps the redesign uses (6, 10, 14, 18)", () => {
    for (const step of [6, 10, 14, 18]) assert.ok(Object.values<number>(spacing).includes(step), `space${step}`);
  });
});

describe("radius scale", () => {
  it("only goes up and ends in a full pill", () => {
    assert.ok(radius.sm < radius.md && radius.md < radius.lg && radius.lg < radius.pill);
  });
});
