import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { karooMark, rideHighlights } from "./karooMarks.ts";

const oct5 = new Date(2026, 9, 5, 12).getTime();

describe("karooMark", () => {
  it("has no mark before anything was sent", () => {
    assert.equal(karooMark({}), undefined);
  });
  it("says last sent, never On Karoo", () => {
    assert.deepEqual(karooMark({ lastSentAtMs: oct5, sentFtpWatts: 280, currentFtpWatts: 280 }), { label: "Last sent Oct 5", tone: "success" });
  });
  it("flags an older plan when FTP changed or the plan was imported after the send", () => {
    assert.equal(karooMark({ lastSentAtMs: oct5, sentFtpWatts: 280, currentFtpWatts: 300 })?.label, "Older plan on Karoo");
    assert.equal(karooMark({ lastSentAtMs: oct5, planChangedAtMs: oct5 + 1 })?.tone, "warning");
  });
});

describe("rideHighlights", () => {
  it("keeps only sent segments, takes the fastest pass, and flags personal bests", () => {
    const result = rideHighlights({
      rideAttempts: [
        { segmentId: "a", segmentName: "Hill", durationMs: 600 },
        { segmentId: "a", segmentName: "Hill", durationMs: 590 },
        { segmentId: "b", segmentName: "Loop", durationMs: 300 },
        { segmentId: "c", segmentName: "Not sent", durationMs: 100 },
      ],
      sentSegmentIds: new Set(["a", "b"]),
      bestMsBySegment: new Map([["a", 590], ["b", 280]]),
    });
    assert.deepEqual(result.map((r) => [r.segmentId, r.durationMs, r.personalBest]), [["a", 590, true], ["b", 300, false]]);
  });
});
