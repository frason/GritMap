import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatRideDate } from "./formatRideStats.ts";

const NOW = new Date(2026, 9, 8, 12).getTime();

describe("formatRideDate", () => {
  it("omits the year for a ride in the current year", () => {
    const text = formatRideDate(new Date(2026, 6, 18, 9).getTime(), NOW);
    assert.doesNotMatch(text, /2026/);
    assert.match(text, /18/);
  });

  it("shows the year for a ride from an earlier year, so a newest-first list reads in order", () => {
    const text = formatRideDate(new Date(2025, 10, 9, 9).getTime(), NOW);
    assert.match(text, /2025/);
    assert.match(text, /9/);
  });

  it("shows the year for a ride dated in a later year", () => {
    assert.match(formatRideDate(new Date(2027, 0, 3, 9).getTime(), NOW), /2027/);
  });
});
