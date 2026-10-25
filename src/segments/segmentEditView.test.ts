import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { nudgePin, placePin, xToDistance, zoomWindow } from "./segmentEditView.ts";

const range = { startDistanceMeters: 1_000, endDistanceMeters: 4_000 };

describe("segmentEditView", () => {
  it("zooms to a tenth of the ride around the pin, kept inside the ride", () => {
    assert.deepEqual(zoomWindow(5_000, 10_000), { startDistanceMeters: 4_500, endDistanceMeters: 5_500 });
    assert.deepEqual(zoomWindow(0, 10_000), { startDistanceMeters: 0, endDistanceMeters: 1_000 });
    assert.deepEqual(zoomWindow(10_000, 10_000), { startDistanceMeters: 9_000, endDistanceMeters: 10_000 });
  });
  it("never zooms to less than 200 m and never past a short ride", () => {
    assert.equal(zoomWindow(500, 1_000).endDistanceMeters - zoomWindow(500, 1_000).startDistanceMeters, 200);
    assert.deepEqual(zoomWindow(50, 100), { startDistanceMeters: 0, endDistanceMeters: 100 });
  });
  it("maps a touch to a distance inside the shown stretch", () => {
    assert.equal(xToDistance(100, 200, { startDistanceMeters: 1_000, endDistanceMeters: 2_000 }), 1_500);
    assert.equal(xToDistance(-20, 200, { startDistanceMeters: 1_000, endDistanceMeters: 2_000 }), 1_000);
    assert.equal(xToDistance(300, 200, { startDistanceMeters: 1_000, endDistanceMeters: 2_000 }), 2_000);
  });
  it("keeps pins apart and inside the ride", () => {
    assert.equal(placePin("start", 9_000, range, 10_000).startDistanceMeters, 3_990);
    assert.equal(placePin("end", 0, range, 10_000).endDistanceMeters, 1_010);
    assert.equal(placePin("end", 20_000, range, 10_000).endDistanceMeters, 10_000);
  });
  it("nudges by a step and leaves the other pin alone", () => {
    assert.deepEqual(nudgePin("start", 1, range, 10_000), { startDistanceMeters: 1_010, endDistanceMeters: 4_000 });
    assert.deepEqual(nudgePin("end", -1, range, 10_000), { startDistanceMeters: 1_000, endDistanceMeters: 3_990 });
  });
});
