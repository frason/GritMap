import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sendLogInventory } from "./karooPresence.ts";

describe("sendLogInventory", () => {
  it("holds the segments this phone has sent", () => {
    const inventory = sendLogInventory([{ segmentId: "a" }, { segmentId: "b" }]);
    assert.equal(inventory.hasSegment("a"), true);
    assert.equal(inventory.hasSegment("b"), true);
    assert.equal(inventory.hasSegment("c"), false);
  });

  it("is empty when nothing was sent", () => {
    assert.equal(sendLogInventory([]).hasSegment("a"), false);
  });
});
