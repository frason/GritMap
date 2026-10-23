import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { NO_POWER_COMPARE, NO_POWER_RIDE_NOTE } from "./describeNoPower.ts";

describe("no-power wording", () => {
  it("says pacing needs power and what to do, in plain words", () => {
    for (const text of [NO_POWER_RIDE_NOTE, NO_POWER_COMPARE.title, NO_POWER_COMPARE.body]) {
      assert.doesNotMatch(text, /null|undefined|channel|stream|wattage/i);
    }
    assert.match(NO_POWER_RIDE_NOTE, /needs power/);
    assert.match(NO_POWER_COMPARE.body, /Pacing needs power/);
    assert.match(NO_POWER_COMPARE.body, /power meter/);
  });
});
