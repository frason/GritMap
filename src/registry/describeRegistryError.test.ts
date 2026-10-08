import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { describeRegistryError } from "./describeRegistryError.ts";

describe("describeRegistryError", () => {
  it("explains a network failure as a connection problem", () => {
    assert.match(describeRegistryError({ message: "Network request failed" }), /Check your internet connection/);
  });

  it("explains rate limiting and server trouble without codes or jargon", () => {
    assert.match(describeRegistryError({ statusCode: 403 }), /busy right now/);
    assert.match(describeRegistryError({ statusCode: 429 }), /busy right now/);
    assert.match(describeRegistryError({ statusCode: 503 }), /problem on its side/);
    assert.match(describeRegistryError({ statusCode: 404 }), /Couldn't load Open Segments/);
  });

  it("never leaks a status code, a raw message, or the word registry", () => {
    for (const input of [{ statusCode: 403, message: "rate limit exceeded" }, { statusCode: 500 }, { message: "Network request failed" }, { statusCode: 404 }]) {
      assert.doesNotMatch(describeRegistryError(input), /\d{3}|rate limit|Network request|registry/i);
    }
  });
});
