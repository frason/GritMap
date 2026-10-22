import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parsePastDateInput } from "./parsePastDate.ts";

const NOW = new Date(2026, 9, 20, 12, 0, 0).getTime();

describe("parsePastDateInput", () => {
  it("reads year-month-day and month/day/year as noon local time", () => {
    const iso = parsePastDateInput("2025-06-14", NOW);
    const us = parsePastDateInput("6/14/2025", NOW);
    assert.ok(iso.ok && us.ok);
    assert.equal(iso.ok && iso.value, new Date(2025, 5, 14, 12).getTime());
    assert.equal(us.ok && us.value, iso.ok ? iso.value : -1);
  });

  it("accepts single-digit months and days and surrounding spaces", () => {
    const parsed = parsePastDateInput("  2025-5-9 ", NOW);
    assert.equal(parsed.ok && parsed.value, new Date(2025, 4, 9, 12).getTime());
  });

  it("refuses text that is not a date, an impossible date and a date in the future", () => {
    assert.equal(parsePastDateInput("last May", NOW).ok, false);
    assert.equal(parsePastDateInput("", NOW).ok, false);
    assert.equal(parsePastDateInput("2025-02-30", NOW).ok, false);
    assert.equal(parsePastDateInput("2025-13-01", NOW).ok, false);
    assert.equal(parsePastDateInput("1999-01-01", NOW).ok, false);
    const future = parsePastDateInput("2026-10-21", NOW);
    assert.equal(future.ok, false);
    assert.match(future.ok ? "" : future.error, /future/);
  });

  it("accepts today", () => {
    assert.equal(parsePastDateInput("2026-10-20", NOW).ok, true);
  });
});
