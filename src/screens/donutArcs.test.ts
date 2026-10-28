import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { donutArcs } from "./donutArcs.ts";

describe("donutArcs", () => {
  it("fills the whole ring across the zones, in order", () => {
    const arcs = donutArcs(
      [
        { zone: 1, percent: 25 },
        { zone: 2, percent: 75 },
      ],
      10,
    );
    const circumference = 2 * Math.PI * 10;
    assert.equal(arcs.length, 2);
    assert.ok(Math.abs(arcs[0]!.dashLength - circumference * 0.25) < 1e-9);
    assert.ok(Math.abs(arcs[1]!.dashLength - circumference * 0.75) < 1e-9);
    assert.ok(Math.abs(arcs[1]!.dashOffset + circumference * 0.25) < 1e-9);
  });

  it("skips zones with no time and scales percents that miss 100", () => {
    const arcs = donutArcs(
      [
        { zone: 1, percent: 0 },
        { zone: 2, percent: 49.5 },
        { zone: 3, percent: 49.5 },
      ],
      10,
    );
    const circumference = 2 * Math.PI * 10;
    assert.deepEqual(arcs.map((arc) => arc.zone), [2, 3]);
    assert.ok(Math.abs(arcs[0]!.dashLength + arcs[1]!.dashLength - circumference) < 1e-9);
  });

  it("draws nothing when there is no data", () => {
    assert.deepEqual(donutArcs([], 10), []);
    assert.deepEqual(donutArcs([{ zone: 1, percent: 0 }], 10), []);
  });
});
