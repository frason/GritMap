import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { binByDistance } from "./binSeries.ts";

describe("binByDistance", () => {
  it("averages each step and places it at the middle of the samples in it", () => {
    const bins = binByDistance(
      [
        { distanceMeters: 0, primary: 100, comparison: 200 },
        { distanceMeters: 100, primary: 200, comparison: 300 },
        { distanceMeters: 450, primary: 300, comparison: 100 },
        { distanceMeters: 500, primary: 500, comparison: 100 },
      ],
      400,
    );
    assert.deepEqual(bins, [
      { distanceMeters: 50, primary: 150, comparison: 250 },
      { distanceMeters: 475, primary: 400, comparison: 100 },
    ]);
  });

  it("leaves a channel null where a step has no readings, never zero", () => {
    const bins = binByDistance(
      [
        { distanceMeters: 0, primary: null, comparison: 10 },
        { distanceMeters: 10, primary: null, comparison: 20 },
      ],
      400,
    );
    assert.deepEqual(bins, [{ distanceMeters: 5, primary: null, comparison: 15 }]);
  });

  it("skips empty steps and handles no data", () => {
    assert.equal(binByDistance([], 400).length, 0);
    const bins = binByDistance(
      [
        { distanceMeters: 10, primary: 1, comparison: 1 },
        { distanceMeters: 1000, primary: 3, comparison: 3 },
      ],
      400,
    );
    assert.equal(bins.length, 2);
  });

  it("uses a quarter mile by default", () => {
    const bins = binByDistance([
      { distanceMeters: 0, primary: 1, comparison: 1 },
      { distanceMeters: 402, primary: 3, comparison: 3 },
      { distanceMeters: 403, primary: 5, comparison: 5 },
    ]);
    assert.equal(bins.length, 2);
  });
});
