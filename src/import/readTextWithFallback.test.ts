import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readTextWithFallback } from "./readTextWithFallback.ts";

describe("readTextWithFallback", () => {
  it("returns the first readable document", async () => {
    let fallbackCalled = false;
    const text = await readTextWithFallback([
      async () => "segment-json",
      async () => {
        fallbackCalled = true;
        return "unused";
      },
    ]);
    assert.equal(text, "segment-json");
    assert.equal(fallbackCalled, false);
  });

  it("uses the next reader when an iOS provider URI fails", async () => {
    const text = await readTextWithFallback([
      async () => { throw new Error("file id was null"); },
      async () => "cached-segment-json",
    ]);
    assert.equal(text, "cached-segment-json");
  });

  it("reports all reader failures when none can read the document", async () => {
    await assert.rejects(
      readTextWithFallback([
        async () => { throw new Error("modern failed"); },
        async () => { throw new Error("legacy failed"); },
      ]),
      /modern failed \| legacy failed/,
    );
  });
});
