import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { KG_PER_LB, defaultWeightUnit, kilogramsToDisplay, parseFtpInput, parseMaxHeartRateInput, parseWeightInput } from "./riderNumbers.ts";

describe("parseFtpInput", () => {
  it("accepts whole watts, with stray spaces or a 'W'", () => {
    assert.deepEqual(parseFtpInput("250"), { ok: true, value: 250 });
    assert.deepEqual(parseFtpInput("  250 "), { ok: true, value: 250 });
    assert.deepEqual(parseFtpInput("250 W"), { ok: true, value: 250 });
    assert.deepEqual(parseFtpInput("250w"), { ok: true, value: 250 });
  });

  it("explains empty, fractional, non-numeric and implausible input in plain words", () => {
    assert.match((parseFtpInput("") as { error: string }).error, /Enter your FTP in watts/);
    assert.match((parseFtpInput("250.5") as { error: string }).error, /whole watts/);
    assert.match((parseFtpInput("abc") as { error: string }).error, /whole watts/);
    assert.match((parseFtpInput("12") as { error: string }).error, /between 40 and 700/);
    assert.match((parseFtpInput("2500") as { error: string }).error, /between 40 and 700/);
    assert.deepEqual(parseFtpInput("40"), { ok: true, value: 40 });
    assert.deepEqual(parseFtpInput("700"), { ok: true, value: 700 });
  });
});

describe("parseWeightInput", () => {
  it("takes kilograms as entered", () => {
    assert.deepEqual(parseWeightInput("75", "kg"), { ok: true, value: 75 });
    assert.deepEqual(parseWeightInput("75.5", "kg"), { ok: true, value: 75.5 });
    assert.deepEqual(parseWeightInput("75,5", "kg"), { ok: true, value: 75.5 });
  });

  it("converts pounds to kilograms, since the rider profile stores kilograms", () => {
    const result = parseWeightInput("165", "lb");
    assert.ok(result.ok);
    assert.equal(result.value, Math.round(165 * KG_PER_LB * 100) / 100);
    assert.equal(result.value, 74.84);
  });

  it("rejects numbers that cannot be a rider in that unit, naming the unit", () => {
    assert.match((parseWeightInput("0", "kg") as { error: string }).error, /does not look right for kilograms/);
    assert.match((parseWeightInput("700", "kg") as { error: string }).error, /kilograms/);
    assert.match((parseWeightInput("30", "lb") as { error: string }).error, /pounds/); // 13.6 kg
    assert.ok(parseWeightInput("30", "kg").ok);
  });

  it("rejects empty and non-numeric input with a useful message", () => {
    assert.match((parseWeightInput("", "lb") as { error: string }).error, /in pounds/);
    assert.match((parseWeightInput("heavy", "kg") as { error: string }).error, /Enter a number/);
    assert.match((parseWeightInput("75 kg", "kg") as { error: string }).error, /Enter a number/);
  });
});

describe("kilogramsToDisplay", () => {
  it("shows the stored kilograms in the unit being edited", () => {
    assert.equal(kilogramsToDisplay(75.5, "kg"), "75.5");
    assert.equal(kilogramsToDisplay(74.84, "lb"), "165");
    assert.equal(kilogramsToDisplay(70, "lb"), "154.3");
  });
});

describe("defaultWeightUnit", () => {
  it("preselects pounds only where people use them", () => {
    assert.equal(defaultWeightUnit("en-US"), "lb");
    assert.equal(defaultWeightUnit("es_US"), "lb");
    assert.equal(defaultWeightUnit("en-GB"), "kg");
    assert.equal(defaultWeightUnit("de-DE"), "kg");
    assert.equal(defaultWeightUnit("en"), "kg");
    assert.equal(defaultWeightUnit(undefined), "kg");
  });
});

describe("parseMaxHeartRateInput", () => {
  it("accepts a plausible whole number, with or without bpm", () => {
    assert.deepEqual(parseMaxHeartRateInput("185"), { ok: true, value: 185 });
    assert.deepEqual(parseMaxHeartRateInput(" 185 bpm"), { ok: true, value: 185 });
  });

  it("rejects fractions, text and implausible values with a reason", () => {
    assert.match((parseMaxHeartRateInput("185.5") as { error: string }).error, /whole beats/);
    assert.match((parseMaxHeartRateInput("fast") as { error: string }).error, /whole beats/);
    assert.match((parseMaxHeartRateInput("60") as { error: string }).error, /between 100 and 230/);
    assert.match((parseMaxHeartRateInput("300") as { error: string }).error, /between 100 and 230/);
  });
});
