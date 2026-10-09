import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { describePublishError, describeRegistryError, registryErrorKind } from "./describeRegistryError.ts";

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

  it("sorts failures into offline, busy, server and other", () => {
    assert.equal(registryErrorKind({}), "offline");
    assert.equal(registryErrorKind({ statusCode: 429 }), "busy");
    assert.equal(registryErrorKind({ statusCode: 502 }), "server");
    assert.equal(registryErrorKind({ statusCode: 404 }), "other");
  });

  it("explains a failed share in rider words without codes, jargon or the server's own message", () => {
    for (const input of [{}, { statusCode: 401 }, { statusCode: 403 }, { statusCode: 404 }, { statusCode: 429 }, { statusCode: 500 }, { statusCode: 422 }]) {
      assert.doesNotMatch(describePublishError(input), /\d{3}|HTTP|repo scope|registry/i);
    }
    assert.match(describePublishError({ statusCode: 401 }), /did not accept that token/);
    assert.match(describePublishError({}), /internet connection/);
  });
});
