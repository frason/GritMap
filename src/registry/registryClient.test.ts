import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { fetchRegistrySegment, listRegistrySegments, publishRegistrySegment } from "./registryClient.ts";
import type { RegistryConfig } from "./registryConfig.ts";
import type { PortableSegmentInput } from "../segments/toPortableSegmentJson.ts";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

const CONFIG: RegistryConfig = { owner: "frason", repo: "GritMap", path: "registry/segments", branch: "main" };

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as Response;
}

function sampleSegment(): PortableSegmentInput {
  return {
    id: "wall",
    name: "Local Wall",
    schemaVersion: 1,
    corridorMeters: 30,
    requiredCoveragePct: 0.9,
    fingerprint: "abc123",
    referencePolyline: [
      { lat: 37.0, lng: -122.0, distanceMeters: 0 },
      { lat: 37.001, lng: -122.0, distanceMeters: 111 },
    ],
  };
}

describe("listRegistrySegments", () => {
  it("lists fingerprints from the GitHub contents API, stripping .json", async () => {
    let requestedUrl: string | undefined;
    globalThis.fetch = (async (url: string) => {
      requestedUrl = url;
      return jsonResponse([
        { name: "abc123.json", path: "registry/segments/abc123.json" },
        { name: "def456.json", path: "registry/segments/def456.json" },
        { name: "README.md", path: "registry/segments/README.md" },
      ]);
    }) as typeof fetch;

    const result = await listRegistrySegments(CONFIG);

    assert.equal(requestedUrl, "https://api.github.com/repos/frason/GritMap/contents/registry/segments?ref=main");
    assert.equal(result.ok, true);
    assert.deepEqual(result.entries, [
      { fingerprint: "abc123", path: "registry/segments/abc123.json" },
      { fingerprint: "def456", path: "registry/segments/def456.json" },
    ]);
  });

  it("treats a 404 (registry directory doesn't exist yet) as an empty, successful listing", async () => {
    globalThis.fetch = (async () => jsonResponse(undefined, { ok: false, status: 404 })) as typeof fetch;
    const result = await listRegistrySegments(CONFIG);
    assert.deepEqual(result, { ok: true, entries: [] });
  });

  it("reports a real error status as not ok", async () => {
    globalThis.fetch = (async () => jsonResponse(undefined, { ok: false, status: 500 })) as typeof fetch;
    const result = await listRegistrySegments(CONFIG);
    assert.equal(result.ok, false);
    assert.equal(result.statusCode, 500);
  });

  it("reports a network failure without throwing", async () => {
    globalThis.fetch = (async () => {
      throw new Error("offline");
    }) as typeof fetch;
    const result = await listRegistrySegments(CONFIG);
    assert.deepEqual(result, { ok: false, entries: [], message: "offline" });
  });
});

describe("fetchRegistrySegment", () => {
  it("fetches from raw.githubusercontent.com, not the API host", async () => {
    let requestedUrl: string | undefined;
    globalThis.fetch = (async (url: string) => {
      requestedUrl = url;
      return jsonResponse({ id: "wall" });
    }) as typeof fetch;

    const result = await fetchRegistrySegment(CONFIG, "abc123");

    assert.equal(
      requestedUrl,
      "https://raw.githubusercontent.com/frason/GritMap/main/registry/segments/abc123.json",
    );
    assert.deepEqual(result, { ok: true, segment: { id: "wall" } });
  });

  it("reports a 404 as not ok (a real error here, unlike the listing)", async () => {
    globalThis.fetch = (async () => jsonResponse(undefined, { ok: false, status: 404 })) as typeof fetch;
    const result = await fetchRegistrySegment(CONFIG, "missing");
    assert.deepEqual(result, { ok: false, statusCode: 404 });
  });
});

describe("publishRegistrySegment", () => {
  it("PUTs base64-encoded content with the auth token, when not already published", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      if (init === undefined) return jsonResponse(undefined, { ok: false, status: 404 }); // fetchRegistrySegment's GET
      calls.push({ url, init });
      return jsonResponse({ content: { path: "registry/segments/abc123.json", html_url: "https://github.com/x" } }, { status: 201 });
    }) as typeof fetch;

    const result = await publishRegistrySegment(CONFIG, "gh-token", sampleSegment());

    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, "https://api.github.com/repos/frason/GritMap/contents/registry/segments/abc123.json");
    assert.equal(calls[0]!.init.method, "PUT");
    assert.equal((calls[0]!.init.headers as Record<string, string>).Authorization, "Bearer gh-token");
    const body = JSON.parse(calls[0]!.init.body as string);
    assert.equal(body.branch, "main");
    assert.equal(Buffer.from(body.content, "base64").toString("utf8"), JSON.stringify(
      {
        schemaVersion: 1,
        id: "wall",
        name: "Local Wall",
        direction: "forward",
        matching: { corridorMeters: 30, requiredCoveragePct: 0.9 },
        referencePolyline: sampleSegment().referencePolyline,
        fingerprint: "abc123",
      },
      null,
      2,
    ));
    assert.deepEqual(result, {
      ok: true,
      path: "registry/segments/abc123.json",
      htmlUrl: "https://github.com/x",
    });
  });

  it("reports already-published without ever sending the token, when the fingerprint already exists", async () => {
    let putCalled = false;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      if (init !== undefined) putCalled = true;
      return jsonResponse({ id: "wall" }); // fetchRegistrySegment's GET succeeds
    }) as typeof fetch;

    const result = await publishRegistrySegment(CONFIG, "gh-token", sampleSegment());

    assert.equal(putCalled, false);
    assert.deepEqual(result, {
      ok: true,
      alreadyPublished: true,
      path: "registry/segments/abc123.json",
    });
  });

  it("surfaces the GitHub error message on a failed PUT", async () => {
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      if (init === undefined) return jsonResponse(undefined, { ok: false, status: 404 });
      return jsonResponse({ message: "Bad credentials" }, { ok: false, status: 401 });
    }) as typeof fetch;

    const result = await publishRegistrySegment(CONFIG, "bad-token", sampleSegment());

    assert.deepEqual(result, { ok: false, statusCode: 401, message: "Bad credentials" });
  });
});
