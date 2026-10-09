import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { summarizeRegistrySegment } from "./summarizeRegistrySegment.ts";

describe("summarizeRegistrySegment", () => {
  it("reads the name and length from a real published registry file", async () => {
    const raw = JSON.parse(
      await readFile("registry/segments/17779c8b14fbe84126712e79982a870d82433a37d7c7193f3af4bbb2b5dc530c.json", "utf8"),
    );
    const summary = summarizeRegistrySegment(raw)!;
    assert.equal(typeof summary.name, "string");
    assert.ok(summary.name.length > 0);
    assert.ok(summary.distanceMeters! > 100);
    assert.ok(summary.elevationGainMeters! > 100);
  });

  it("adds the climbing when the points carry elevation, and leaves it out when they do not", () => {
    const withElevation = summarizeRegistrySegment({
      name: "Hill",
      referencePolyline: [
        { lat: 1, lng: 1, distanceMeters: 0, elevationMeters: 100 },
        { lat: 1, lng: 1, distanceMeters: 500, elevationMeters: 150 },
        { lat: 1, lng: 1, distanceMeters: 1000, elevationMeters: 140 },
        { lat: 1, lng: 1, distanceMeters: 1500, elevationMeters: 190 },
      ],
    })!;
    assert.equal(withElevation.distanceMeters, 1500);
    assert.equal(withElevation.elevationGainMeters, 100);
    assert.equal(summarizeRegistrySegment({ name: "Flat", referencePolyline: [{ distanceMeters: 0 }, { distanceMeters: 300 }] })!.elevationGainMeters, undefined);
  });

  it("trims the name and takes the last point's distance", () => {
    assert.deepEqual(
      summarizeRegistrySegment({ name: "  Hill  ", referencePolyline: [{ distanceMeters: 0 }, { distanceMeters: 812.5 }] }),
      { name: "Hill", distanceMeters: 812.5 },
    );
  });

  it("still gives a name when the polyline is missing or unusable", () => {
    assert.deepEqual(summarizeRegistrySegment({ name: "Hill" }), { name: "Hill" });
    assert.deepEqual(summarizeRegistrySegment({ name: "Hill", referencePolyline: [] }), { name: "Hill" });
    assert.deepEqual(summarizeRegistrySegment({ name: "Hill", referencePolyline: [{ distanceMeters: "far" }] }), { name: "Hill" });
    assert.deepEqual(summarizeRegistrySegment({ name: "Hill", referencePolyline: [null] }), { name: "Hill" });
  });

  it("returns nothing for anything without a usable name", () => {
    assert.equal(summarizeRegistrySegment(null), undefined);
    assert.equal(summarizeRegistrySegment("x"), undefined);
    assert.equal(summarizeRegistrySegment({}), undefined);
    assert.equal(summarizeRegistrySegment({ name: "   " }), undefined);
    assert.equal(summarizeRegistrySegment({ name: 5 }), undefined);
  });
});
