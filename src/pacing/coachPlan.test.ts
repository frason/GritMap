import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MAX_INSTRUCTION_CHARACTERS,
  parseCoachPlan,
  summarizeCoachPlan,
  type CoachPlanContext,
  type ParsedCoachPlan,
} from "./coachPlan.ts";

const FINGERPRINT = "ab".repeat(32);
const CONTEXT: CoachPlanContext = { segmentFingerprint: FINGERPRINT, segmentLengthMeters: 1_000, ftpWatts: 280 };

function document(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schemaVersion: 1,
    packageType: "gritmap-coach-plan",
    source: "human-coach",
    segmentFingerprint: FINGERPRINT,
    zones: [
      { startDistanceMeters: 0, endDistanceMeters: 400, targetPowerWatts: 260 },
      { startDistanceMeters: 400, endDistanceMeters: 700, targetPowerWatts: 300 },
      { startDistanceMeters: 700, endDistanceMeters: 1_000, targetPowerWatts: 240 },
    ],
    ...overrides,
  });
}

function accepted(text: string, context = CONTEXT): { plan: ParsedCoachPlan; warnings: string[] } {
  const result = parseCoachPlan(text, context);
  assert.ok(result.ok, result.ok ? "" : result.errors.join("; "));
  return result;
}

function rejected(text: string, context = CONTEXT): string[] {
  const result = parseCoachPlan(text, context);
  assert.ok(!result.ok, "expected the plan to be rejected");
  return result.errors;
}

describe("parseCoachPlan: accepted documents", () => {
  it("normalizes a watts plan and derives classification and instruction when omitted", () => {
    const { plan, warnings } = accepted(document());
    assert.deepEqual(warnings, []);
    assert.equal(plan.source, "human-coach");
    assert.equal(plan.segmentFingerprint, FINGERPRINT);
    assert.equal(plan.zones.length, 3);
    // distance-weighted mean = (260*400 + 300*300 + 240*300) / 1000 = 266; 260/266 = .98 -> HOLD,
    // 300/266 = 1.13 -> PUSH, 240/266 = .902 -> still HOLD (REST starts below 0.90).
    assert.deepEqual(
      plan.zones.map((zone) => zone.classification),
      ["HOLD", "PUSH", "HOLD"],
    );
  });

  it("derives REST/HOLD/PUSH at 90% / 110% of the plan's own mean power", () => {
    const { plan } = accepted(
      document({
        zones: [
          { startDistanceMeters: 0, endDistanceMeters: 500, targetPowerWatts: 200 },
          { startDistanceMeters: 500, endDistanceMeters: 1_000, targetPowerWatts: 300 },
        ],
      }),
    );
    // mean 250: 200/250 = 0.80 -> REST, 300/250 = 1.20 -> PUSH
    assert.deepEqual(
      plan.zones.map((zone) => zone.classification),
      ["REST", "PUSH"],
    );
    assert.deepEqual(
      plan.zones.map((zone) => zone.instruction),
      ["Rest", "Push"],
    );
  });

  it("honors explicit classification (RECOVER means REST) and instruction", () => {
    const { plan } = accepted(
      document({
        zones: [
          { startDistanceMeters: 0, endDistanceMeters: 500, targetPowerWatts: 250, classification: "recover", instruction: "Spin easy" },
          { startDistanceMeters: 500, endDistanceMeters: 1_000, targetPowerWatts: 250, classification: "PUSH" },
        ],
      }),
    );
    assert.equal(plan.zones[0]!.classification, "REST");
    assert.equal(plan.zones[0]!.instruction, "Spin easy");
    assert.equal(plan.zones[1]!.classification, "PUSH");
    assert.equal(plan.zones[1]!.instruction, "Push");
  });

  it("converts targetPercentFtp to whole watts at the rider's FTP", () => {
    const { plan } = accepted(
      document({
        zones: [
          { startDistanceMeters: 0, endDistanceMeters: 500, targetPercentFtp: 95 },
          { startDistanceMeters: 500, endDistanceMeters: 1_000, targetPercentFtp: 105.5 },
        ],
      }),
    );
    assert.deepEqual(
      plan.zones.map((zone) => zone.targetPowerWatts),
      [266, 295], // 0.95*280 = 266, 1.055*280 = 295.4
    );
  });

  it("accepts a plan wrapped in a markdown code fence, as AI tools usually emit", () => {
    const fenced = "```json\n" + document() + "\n```";
    assert.equal(accepted(fenced).plan.zones.length, 3);
  });

  it("carries author, notes and target finish time when present", () => {
    const { plan } = accepted(
      document({ author: "  Sam  ", notes: "Go easy on the first mile", targetFinishTimeSeconds: 2_340.4 }),
    );
    assert.equal(plan.authorLabel, "Sam");
    assert.equal(plan.notes, "Go easy on the first mile");
    assert.equal(plan.targetFinishTimeSeconds, 2_340);
  });

  it("snaps rounding-sized mismatches to the exact segment geometry", () => {
    const { plan } = accepted(
      document({
        zones: [
          { startDistanceMeters: 2, endDistanceMeters: 399.5, targetPowerWatts: 260 },
          { startDistanceMeters: 400, endDistanceMeters: 997, targetPowerWatts: 270 },
        ],
      }),
    );
    assert.equal(plan.zones[0]!.startDistanceMeters, 0);
    assert.equal(plan.zones[1]!.startDistanceMeters, 399.5);
    assert.equal(plan.zones.at(-1)!.endDistanceMeters, 1_000);
  });

  it("matches a fingerprint case-insensitively and stores it lowercase", () => {
    const { plan } = accepted(document({ segmentFingerprint: FINGERPRINT.toUpperCase() }));
    assert.equal(plan.segmentFingerprint, FINGERPRINT);
  });

  it("rounds fractional watts to whole watts", () => {
    const { plan } = accepted(
      document({ zones: [{ startDistanceMeters: 0, endDistanceMeters: 1_000, targetPowerWatts: 249.6 }] }),
    );
    assert.equal(plan.zones[0]!.targetPowerWatts, 250);
  });

  it("warns about, and ignores, unknown fields", () => {
    const { warnings } = accepted(
      document({
        commentary: "nice",
        zones: [{ startDistanceMeters: 0, endDistanceMeters: 1_000, targetPowerWatts: 250, why: "x" }],
      }),
    );
    assert.deepEqual(warnings.sort(), ['Ignored unknown plan field "commentary"', 'Ignored unknown zone field "why"']);
  });

  it("shortens an over-long instruction for the Karoo display and says so", () => {
    const long = "x".repeat(200);
    const { plan, warnings } = accepted(
      document({ zones: [{ startDistanceMeters: 0, endDistanceMeters: 1_000, targetPowerWatts: 250, instruction: long }] }),
    );
    assert.equal(plan.zones[0]!.instruction.length, MAX_INSTRUCTION_CHARACTERS);
    assert.ok(plan.zones[0]!.instruction.endsWith("…"));
    assert.equal(warnings.length, 1);
  });
});

describe("parseCoachPlan: rejected documents", () => {
  it("rejects text that is not JSON, and non-object JSON", () => {
    assert.match(rejected("not json")[0]!, /Not valid JSON/);
    assert.deepEqual(rejected("[1,2]"), ["Plan must be a JSON object"]);
  });

  it("rejects a plan written for a different segment", () => {
    const errors = rejected(document({ segmentFingerprint: "cd".repeat(32) }));
    assert.deepEqual(errors, ["This plan is for a different segment (segmentFingerprint does not match)"]);
  });

  it("rejects a wrong packageType, schemaVersion or source", () => {
    const errors = rejected(document({ packageType: "other", schemaVersion: 2, source: "robot" }));
    assert.equal(errors.length, 3);
  });

  it("rejects a gap and an overlap between zones, naming the zones", () => {
    const gap = rejected(
      document({
        zones: [
          { startDistanceMeters: 0, endDistanceMeters: 400, targetPowerWatts: 260 },
          { startDistanceMeters: 450, endDistanceMeters: 1_000, targetPowerWatts: 260 },
        ],
      }),
    );
    assert.match(gap[0]!, /zone 2 starts at 450 m but zone 1 ends at 400 m \(gap\)/);
    const overlap = rejected(
      document({
        zones: [
          { startDistanceMeters: 0, endDistanceMeters: 600, targetPowerWatts: 260 },
          { startDistanceMeters: 500, endDistanceMeters: 1_000, targetPowerWatts: 260 },
        ],
      }),
    );
    assert.match(overlap[0]!, /overlap/);
  });

  it("rejects zones that do not start at 0 or do not reach the segment end", () => {
    assert.match(
      rejected(document({ zones: [{ startDistanceMeters: 50, endDistanceMeters: 1_000, targetPowerWatts: 250 }] }))[0]!,
      /must start at 0 m/,
    );
    assert.match(
      rejected(document({ zones: [{ startDistanceMeters: 0, endDistanceMeters: 900, targetPowerWatts: 250 }] }))[0]!,
      /zones cover 900 m but the segment is 1000 m/,
    );
  });

  it("rejects a target above 150% of FTP, quoting the limit", () => {
    const errors = rejected(
      document({ zones: [{ startDistanceMeters: 0, endDistanceMeters: 1_000, targetPowerWatts: 421 }] }),
    );
    assert.match(errors[0]!, /421 W is outside 0-420 W/);
  });

  it("accepts exactly 150% of FTP", () => {
    accepted(document({ zones: [{ startDistanceMeters: 0, endDistanceMeters: 1_000, targetPowerWatts: 420 }] }));
  });

  it("rejects a step over 100 W between neighbouring zones, accepts exactly 100 W", () => {
    const tooBig = rejected(
      document({
        zones: [
          { startDistanceMeters: 0, endDistanceMeters: 500, targetPowerWatts: 200 },
          { startDistanceMeters: 500, endDistanceMeters: 1_000, targetPowerWatts: 301 },
        ],
      }),
    );
    assert.match(tooBig[0]!, /zones 1 and 2 differ by 101 W/);
    accepted(
      document({
        zones: [
          { startDistanceMeters: 0, endDistanceMeters: 500, targetPowerWatts: 200 },
          { startDistanceMeters: 500, endDistanceMeters: 1_000, targetPowerWatts: 300 },
        ],
      }),
    );
  });

  it("requires exactly one of targetPowerWatts / targetPercentFtp per zone", () => {
    const both = rejected(
      document({
        zones: [{ startDistanceMeters: 0, endDistanceMeters: 1_000, targetPowerWatts: 250, targetPercentFtp: 90 }],
      }),
    );
    assert.match(both[0]!, /exactly one of targetPowerWatts or targetPercentFtp/);
    const neither = rejected(document({ zones: [{ startDistanceMeters: 0, endDistanceMeters: 1_000 }] }));
    assert.match(neither[0]!, /exactly one of/);
  });

  it("rejects empty, oversized, and malformed zone arrays", () => {
    assert.match(rejected(document({ zones: [] }))[0]!, /non-empty array/);
    assert.match(rejected(document({ zones: "no" }))[0]!, /non-empty array/);
    const many = Array.from({ length: 201 }, (_, i) => ({
      startDistanceMeters: i,
      endDistanceMeters: i + 1,
      targetPowerWatts: 250,
    }));
    assert.match(rejected(document({ zones: many }))[0]!, /maximum is 200/);
    assert.match(rejected(document({ zones: [7] }))[0]!, /zone 1 must be an object/);
  });

  it("rejects an unknown classification and non-numeric distances", () => {
    assert.match(
      rejected(
        document({ zones: [{ startDistanceMeters: 0, endDistanceMeters: 1_000, targetPowerWatts: 250, classification: "SPRINT" }] }),
      )[0]!,
      /classification must be REST, HOLD, or PUSH/,
    );
    assert.match(
      rejected(document({ zones: [{ startDistanceMeters: "0", endDistanceMeters: 1_000, targetPowerWatts: 250 }] }))[0]!,
      /numeric startDistanceMeters/,
    );
  });

  it("reports several problems at once instead of stopping at the first", () => {
    const errors = rejected(document({ source: "robot", segmentFingerprint: "nope", zones: [] }));
    assert.ok(errors.length >= 3, errors.join("; "));
  });

  it("caps a flood of errors", () => {
    const zones = Array.from({ length: 50 }, () => ({ startDistanceMeters: 0, endDistanceMeters: 1 }));
    const errors = rejected(document({ zones }));
    assert.equal(errors.length, 13);
    assert.match(errors.at(-1)!, /…and \d+ more/);
  });

  it("rejects an oversized document before parsing it", () => {
    assert.match(rejected("x".repeat(100_001))[0]!, /too large/);
  });
});

describe("summarizeCoachPlan", () => {
  it("reports distance-weighted average, %FTP, and range", () => {
    const { plan } = accepted(document());
    assert.deepEqual(summarizeCoachPlan(plan.zones, 280), {
      zoneCount: 3,
      averagePowerWatts: 266,
      percentOfFtp: 95,
      minPowerWatts: 240,
      maxPowerWatts: 300,
    });
  });
});
