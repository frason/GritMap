import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toJavaDoubleString } from "./toJavaDoubleString.ts";

describe("toJavaDoubleString", () => {
  it("appends .0 to whole numbers, matching Java's Double.toString()", () => {
    assert.equal(toJavaDoubleString(37), "37.0");
    assert.equal(toJavaDoubleString(-122), "-122.0");
    assert.equal(toJavaDoubleString(0), "0.0");
    assert.equal(toJavaDoubleString(10), "10.0");
  });

  it("leaves non-whole numbers as JS's own toString() output, which agrees with Java's digit sequence", () => {
    assert.equal(toJavaDoubleString(37.001), "37.001");
    assert.equal(toJavaDoubleString(0.9), "0.9");
    assert.equal(toJavaDoubleString(-122.4193), "-122.4193");
  });

  it("normalizes -0 to 0.0 rather than surfacing the -0/0 JS/Java asymmetry", () => {
    assert.equal(toJavaDoubleString(-0), "0.0");
  });
});
