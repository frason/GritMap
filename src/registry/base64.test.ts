import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { utf8ToBase64 } from "./base64.ts";

describe("utf8ToBase64", () => {
  it("matches Buffer's base64 encoding for plain ASCII", () => {
    const text = "hello world";
    assert.equal(utf8ToBase64(text), Buffer.from(text, "utf8").toString("base64"));
  });

  it("matches Buffer's base64 encoding for JSON with punctuation", () => {
    const text = JSON.stringify({ name: "Local Wall", corridorMeters: 30 }, null, 2);
    assert.equal(utf8ToBase64(text), Buffer.from(text, "utf8").toString("base64"));
  });

  it("matches Buffer's base64 encoding for multi-byte UTF-8 characters", () => {
    const text = "Côte d'Azur climb — 45°";
    assert.equal(utf8ToBase64(text), Buffer.from(text, "utf8").toString("base64"));
  });

  it("pads correctly for input lengths not divisible by 3", () => {
    assert.equal(utf8ToBase64("a"), Buffer.from("a", "utf8").toString("base64"));
    assert.equal(utf8ToBase64("ab"), Buffer.from("ab", "utf8").toString("base64"));
    assert.equal(utf8ToBase64("abc"), Buffer.from("abc", "utf8").toString("base64"));
  });

  it("handles empty input", () => {
    assert.equal(utf8ToBase64(""), "");
  });
});
