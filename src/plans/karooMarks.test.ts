import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { karooMark, latestChange, rideHighlights } from "./karooMarks.ts";

const oct5 = new Date(2026, 9, 5, 12).getTime();

describe("karooMark", () => {
  it("has no mark before anything was sent", () => {
    assert.equal(karooMark({}), undefined);
  });
  it("says last sent, never On Karoo", () => {
    assert.deepEqual(karooMark({ lastSentAtMs: oct5, sentFtpWatts: 280, currentFtpWatts: 280 }), { label: "Karoo", tone: "success" });
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

describe("older plan on Karoo after a goal change", () => {
  it("flags a send that is older than the goal's last save, and keeps a newer send as current", () => {
    const sent = 5_000;
    assert.deepEqual(karooMark({ lastSentAtMs: sent, planChangedAtMs: latestChange(undefined, 9_000) }), { label: "Older plan on Karoo", tone: "warning" });
    assert.equal(karooMark({ lastSentAtMs: sent, planChangedAtMs: latestChange(undefined, 4_000) })?.tone, "success");
    assert.equal(karooMark({ planChangedAtMs: latestChange(1_000, 9_000) }), undefined);
  });

  it("takes the later of the plan and goal times", () => {
    assert.equal(latestChange(3, 7), 7);
    assert.equal(latestChange(9, 7), 9);
    assert.equal(latestChange(undefined, undefined), undefined);
  });
});
