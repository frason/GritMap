import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { fetchWithTimeout } from "./fetchWithTimeout.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("fetchWithTimeout", () => {
  it("returns a response that arrives before the deadline", async () => {
    const expected = new Response("OK", { status: 200 });
    globalThis.fetch = async () => expected;
    assert.equal(await fetchWithTimeout("http://karoo.test", {}, 100), expected);
  });

  it("aborts a request that never receives an HTTP response", async () => {
    globalThis.fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });
    await assert.rejects(fetchWithTimeout("http://karoo.test", {}, 5), /Aborted/);
  });
});
