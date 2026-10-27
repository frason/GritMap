import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fallbackRideTitle, formatRideDate, rideTitle } from "./formatRideStats.ts";

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

describe("rideTitle", () => {
  it("builds 'Sat morning ride' style titles from the start time", () => {
    const at = (hour: number) => new Date(2026, 9, 3, hour).getTime(); // a Saturday
    assert.match(fallbackRideTitle(at(7)), /^\S+ morning ride$/);
    assert.match(fallbackRideTitle(at(13)), /afternoon ride$/);
    assert.match(fallbackRideTitle(at(18)), /evening ride$/);
    assert.match(fallbackRideTitle(at(22)), /night ride$/);
  });

  it("prefers the ride's own name, then the date title, then a plain 'Ride'", () => {
    assert.equal(rideTitle({ name: "Road", startTimestampMs: 1 }), "Road");
    assert.match(rideTitle({ startTimestampMs: new Date(2026, 9, 3, 7).getTime() }), /morning ride$/);
    assert.equal(rideTitle({}), "Ride");
  });
});
