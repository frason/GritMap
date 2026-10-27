import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_SEGMENT_SORT, SEGMENT_SORTS, sortSegments, thinCourse } from "./segmentListView.ts";

const seg = (segmentId: string, name: string, createdAtMs: number, effortCount: number, lastEffortAtMs?: number) => ({
  segmentId,
  name,
  createdAtMs,
  effortCount,
  ...(lastEffortAtMs === undefined ? {} : { lastEffortAtMs }),
});
const ids = (list: { segmentId: string }[]) => list.map((s) => s.segmentId);

describe("sortSegments", () => {
  const list = [seg("a", "Beta", 100, 1, 5_000), seg("b", "alpha", 300, 4, 9_000), seg("c", "Gamma", 200, 0), seg("d", "Delta", 400, 2, 1_000)];

  it("defaults to the most recent attempts, with never-attempted segments last", () => {
    assert.equal(DEFAULT_SEGMENT_SORT, "recent");
    assert.equal(SEGMENT_SORTS[0]?.value, "recent");
    assert.deepEqual(ids(sortSegments(list, "recent")), ["b", "a", "d", "c"]);
  });

  it("orders segments with no attempts by newest added", () => {
    const none = [seg("x", "X", 100, 0), seg("y", "Y", 300, 0)];
    assert.deepEqual(ids(sortSegments(none, "recent")), ["y", "x"]);
  });

  it("sorts by name ignoring case", () => {
    assert.deepEqual(ids(sortSegments(list, "name")), ["b", "a", "d", "c"]);
  });

  it("sorts by recently added and by most efforts", () => {
    assert.deepEqual(ids(sortSegments(list, "added")), ["d", "b", "c", "a"]);
    assert.deepEqual(ids(sortSegments(list, "efforts")), ["b", "d", "a", "c"]);
  });

  it("does not change the input", () => {
    const copy = [...list];
    sortSegments(list, "name");
    assert.deepEqual(list, copy);
  });
});

describe("thinCourse", () => {
  const points = Array.from({ length: 100 }, (_, i) => ({ lat: i, lng: i + 100 }));

  it("keeps a short course as it is", () => {
    assert.equal(thinCourse(points.slice(0, 5), 40).length, 5);
  });

  it("thins a long course evenly and keeps both ends", () => {
    const thin = thinCourse(points, 10);
    assert.equal(thin.length, 10);
    assert.deepEqual(thin[0], { lat: 0, lng: 100 });
    assert.deepEqual(thin.at(-1), { lat: 99, lng: 199 });
  });
});
