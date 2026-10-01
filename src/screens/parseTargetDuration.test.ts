import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseTargetDurationInput } from "./parseTargetDuration.ts";

describe("parseTargetDurationInput", () => {
  it("parses a valid minutes/seconds pair", () => {
    assert.equal(parseTargetDurationInput("39", "0"), 2_340_000);
    assert.equal(parseTargetDurationInput("5", "30"), 330_000);
  });

  it("defaults an empty seconds input to 0", () => {
    assert.equal(parseTargetDurationInput("5", ""), 300_000);
  });

  it("rejects non-numeric input", () => {
    assert.equal(parseTargetDurationInput("abc", "0"), undefined);
    assert.equal(parseTargetDurationInput("5", "xy"), undefined);
  });

  it("rejects negative minutes or seconds", () => {
    assert.equal(parseTargetDurationInput("-5", "0"), undefined);
    assert.equal(parseTargetDurationInput("5", "-10"), undefined);
  });

  it("rejects seconds >= 60", () => {
    assert.equal(parseTargetDurationInput("5", "60"), undefined);
    assert.equal(parseTargetDurationInput("5", "75"), undefined);
  });

  it("rejects a total duration of zero", () => {
    assert.equal(parseTargetDurationInput("0", "0"), undefined);
  });
});
