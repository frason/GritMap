import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";

import { sendSegmentToKaroo } from "./sendSegmentToKaroo.ts";
import type { SegmentDetail } from "../db/getSegmentDetail.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function sampleSegment(): SegmentDetail {
  return {
    segmentId: "segment-1",
    name: "Local Wall",
    corridorMeters: 30,
    requiredCoveragePct: 0.9,
    schemaVersion: 1,
    fingerprint: "abc123",
    createdAtMs: 1_000,
    referencePolyline: [
      { lat: 37.0, lng: -122.0, distanceMeters: 0, elevationMeters: 10 },
      { lat: 37.001, lng: -122.0, distanceMeters: 111 },
    ],
  };
}

describe("sendSegmentToKaroo", () => {
  it("POSTs the portable segment JSON to the Karoo's /transfer endpoint", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return { ok: true, status: 200 } as Response;
    }) as typeof fetch;

    const result = await sendSegmentToKaroo(sampleSegment(), "192.168.1.42:8734");

    assert.deepEqual(result, { ok: true, statusCode: 200 });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, "http://192.168.1.42:8734/transfer");
    assert.equal(calls[0]?.init.method, "POST");
    assert.equal(
      (calls[0]?.init.headers as Record<string, string>)["Content-Type"],
      "application/json",
    );
    assert.deepEqual(JSON.parse(calls[0]?.init.body as string), {
      schemaVersion: 1,
      id: "segment-1",
      name: "Local Wall",
      direction: "forward",
      matching: { corridorMeters: 30, requiredCoveragePct: 0.9 },
      referencePolyline: [
        { lat: 37.0, lng: -122.0, distanceMeters: 0, elevationMeters: 10 },
        { lat: 37.001, lng: -122.0, distanceMeters: 111 },
      ],
      fingerprint: "abc123",
    });
  });

  it("reports a non-2xx response as not ok, with its status code", async () => {
    globalThis.fetch = (async () => ({ ok: false, status: 500 }) as Response) as typeof fetch;

    const result = await sendSegmentToKaroo(sampleSegment(), "192.168.1.42:8734");

    assert.deepEqual(result, { ok: false, statusCode: 500 });
  });

  it("reports a network failure (e.g. Karoo unreachable) without throwing", async () => {
    globalThis.fetch = (async () => {
      throw new Error("Network request failed");
    }) as typeof fetch;

    const result = await sendSegmentToKaroo(sampleSegment(), "192.168.1.42:8734");

    assert.equal(result.ok, false);
    assert.equal(result.message, "Network request failed");
  });
});
