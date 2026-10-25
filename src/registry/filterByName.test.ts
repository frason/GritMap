import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { filterByName } from "./filterByName.ts";

const items = [{ name: "Hill Climb" }, { name: "River Loop" }, { name: undefined }];

describe("filterByName", () => {
  it("keeps everything for an empty query", () => {
    assert.equal(filterByName(items, "  ", (i) => i.name).length, 3);
  });
  it("matches every word, ignoring case", () => {
    assert.deepEqual(filterByName(items, "climb HILL", (i) => i.name), [items[0]]);
  });
  it("drops items without a name when searching", () => {
    assert.deepEqual(filterByName(items, "o", (i) => i.name), [items[1]]);
  });
});
