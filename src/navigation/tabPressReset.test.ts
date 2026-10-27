import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { stackToReset } from "./tabPressReset.ts";

describe("stackToReset", () => {
  it("does nothing for a stack that was never opened", () => {
    assert.equal(stackToReset(undefined), undefined);
    assert.equal(stackToReset({}), undefined);
  });

  it("does nothing when the stack is already on its list page", () => {
    assert.equal(stackToReset({ key: "stack-1", index: 0 }), undefined);
  });

  it("names the stack to pop when it is several screens deep", () => {
    assert.equal(stackToReset({ key: "stack-1", index: 3 }), "stack-1");
  });

  it("cannot target a stack that has no key yet", () => {
    assert.equal(stackToReset({ index: 2 }), undefined);
  });
});
