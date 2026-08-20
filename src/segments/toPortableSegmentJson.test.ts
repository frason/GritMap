import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toPortableSegmentJson } from "./toPortableSegmentJson.ts";

describe("toPortableSegmentJson", () => {
  it("produces the exact shape apps/karoo's SegmentJsonParser.parse() expects", () => {
    const json = toPortableSegmentJson({
      id: "wall",
      name: "Local Wall",
      schemaVersion: 1,
      corridorMeters: 30,
      requiredCoveragePct: 0.9,
      fingerprint: "abc123",
      referencePolyline: [
        { lat: 37.0, lng: -122.0, distanceMeters: 0, elevationMeters: 10 },
        { lat: 37.001, lng: -122.0, distanceMeters: 111 },
      ],
    });

    assert.deepEqual(json, {
      schemaVersion: 1,
      id: "wall",
      name: "Local Wall",
      direction: "forward",
      matching: { corridorMeters: 30, requiredCoveragePct: 0.9 },
      referencePolyline: [
        { lat: 37.0, lng: -122.0, distanceMeters: 0, elevationMeters: 10 },
        { lat: 37.001, lng: -122.0, distanceMeters: 111 },
      ],
      fingerprint: "abc123",
    });
  });

  it("omits elevationMeters entirely (not as null/undefined) when absent, matching the parser's optional field", () => {
    const json = toPortableSegmentJson({
      id: "x",
      name: "x",
      schemaVersion: 1,
      corridorMeters: 30,
      requiredCoveragePct: 0.9,
      fingerprint: "f",
      referencePolyline: [{ lat: 0, lng: 0, distanceMeters: 0 }],
    }) as { referencePolyline: Array<Record<string, unknown>> };

    assert.ok(!("elevationMeters" in json.referencePolyline[0]!));
  });

  it("is round-trippable through JSON.stringify/parse without losing precision", () => {
    const json = toPortableSegmentJson({
      id: "wall",
      name: "Local Wall",
      schemaVersion: 1,
      corridorMeters: 30,
      requiredCoveragePct: 0.9,
      fingerprint: "abc123",
      referencePolyline: [{ lat: 37.001, lng: -122.4193, distanceMeters: 111.5 }],
    });

    assert.deepEqual(JSON.parse(JSON.stringify(json)), json);
  });
});
