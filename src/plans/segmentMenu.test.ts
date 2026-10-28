import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { segmentMenuKeyAt, segmentMenuOptions } from "./segmentMenu.ts";

describe("segment menu", () => {
  it("offers Send to Karoo and Delete, then Cancel", () => {
    assert.deepEqual(segmentMenuOptions(), ["Send to Karoo", "Delete segment", "Cancel"]);
  });

  it("maps taps to actions and treats Cancel as nothing", () => {
    assert.equal(segmentMenuKeyAt(0), "send");
    assert.equal(segmentMenuKeyAt(1), "delete");
    assert.equal(segmentMenuKeyAt(2), undefined);
  });
});
