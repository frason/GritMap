import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { extractRideName } from "./rideName.ts";

describe("extractRideName", () => {
  it("reads the FIT session sport profile name", () => {
    assert.equal(extractRideName({ sessions: [{ sportProfileName: "  Road  " }] }), "Road");
  });

  it("falls back to a GPX track name", () => {
    assert.equal(extractRideName({ trackName: "Evening spin" }), "Evening spin");
  });

  it("returns undefined for missing, empty or non-text names", () => {
    assert.equal(extractRideName({}), undefined);
    assert.equal(extractRideName({ sessions: [] }), undefined);
    assert.equal(extractRideName({ sessions: [{ sportProfileName: "   " }] }), undefined);
    assert.equal(extractRideName({ sessions: [{ sportProfileName: 7 }], trackName: 3 }), undefined);
  });

  it("collapses whitespace and caps the length", () => {
    assert.equal(extractRideName({ trackName: "a \n b" }), "a b");
    assert.equal(extractRideName({ trackName: "x".repeat(200) })?.length, 80);
  });
});
