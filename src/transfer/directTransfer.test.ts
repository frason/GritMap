import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import type { SegmentDetail } from "../db/getSegmentDetail.ts";
import { describeBleSend, reduceBleEvent, type BleSendState } from "./bleSendStatus.ts";
import { isBleTransferEnabled } from "./bleTransferSettings.ts";
import {
  assembleTransferPackage,
  buildDirectTransfer,
  bytesToBase64,
  CHUNK_BYTES,
  chunkFor,
  MAX_MANIFEST_BYTES,
  MAX_PLAN_BYTES,
  MAX_SEGMENT_BYTES,
  parseReceipt,
  readDirectTransfer,
  receiptBytes,
  validateManifest,
  type DirectTransfer,
  type DirectTransferTransport,
} from "./directTransfer.ts";
import { encodeTransferId, isTransferId } from "./transferId.ts";

const sha256Hex = async (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const NOW = 1_791_570_000_000;

/** The Karoo's own Diablo 40:30 guidance-package fixture: its segment is what the phone must reproduce. */
const fixture = JSON.parse(readFileSync("apps/karoo/samples/Diablo.Northgate-to-Junction.40m30.guidance-package.json", "utf8")) as {
  segment: {
    schemaVersion: number;
    id: string;
    name: string;
    matching: { corridorMeters: number; requiredCoveragePct: number };
    referencePolyline: { lat: number; lng: number; distanceMeters: number; elevationMeters?: number }[];
    fingerprint: string;
  };
};

function segmentDetail(): SegmentDetail {
  return {
    segmentId: fixture.segment.id,
    name: fixture.segment.name,
    corridorMeters: fixture.segment.matching.corridorMeters,
    requiredCoveragePct: fixture.segment.matching.requiredCoveragePct,
    schemaVersion: fixture.segment.schemaVersion,
    fingerprint: fixture.segment.fingerprint,
    createdAtMs: NOW,
    referencePolyline: fixture.segment.referencePolyline,
  };
}

const transferId = encodeTransferId(new Uint8Array(randomBytes(16)));

async function build(overrides: Partial<Parameters<typeof buildDirectTransfer>[0]> = {}): Promise<DirectTransfer> {
  const result = await buildDirectTransfer({
    segment: segmentDetail(),
    rider: { ftpWatts: 280, weightKg: 92.5, maxHeartRateBpm: 178 },
    targetDurationMs: 40.5 * 60_000,
    nowMs: NOW,
    transferId,
    sha256Hex,
    ...overrides,
  });
  assert.ok(result.ok, result.ok ? "" : result.message);
  return result.ok ? result.transfer : (undefined as never);
}

/** An in-memory phone peripheral that serves exactly what contract section "Chunked read" says. */
function fakePeripheral(transfer: DirectTransfer, options: { tamper?: "plan" | "segment" } = {}) {
  const resources: Record<string, Uint8Array> = { plan: transfer.planBytes, segment: transfer.segmentBytes };
  if (transfer.riderBytes !== undefined) resources.rider = transfer.riderBytes;
  const served: Record<string, Uint8Array> = {};
  for (const [name, bytes] of Object.entries(resources)) {
    served[name] = new Uint8Array(bytes);
    if (options.tamper === name) served[name]![5] = served[name]![5]! ^ 1;
  }
  let last: { resource: string; offset: number } | undefined;
  const requests: { resource: string; offset: number }[] = [];
  const transport: DirectTransferTransport = {
    readManifest: async () => new TextEncoder().encode(transfer.manifestJson),
    writeRequest: async (body) => {
      const request = JSON.parse(new TextDecoder().decode(body)) as { resource: string; offset: number };
      const data = served[request.resource];
      if (data === undefined || request.offset < 0 || request.offset >= data.length) throw new Error("request refused");
      last = request;
      requests.push(request);
    },
    readData: async () => {
      if (last === undefined) throw new Error("no request");
      const chunk = chunkFor(served[last.resource]!, last.offset, CHUNK_BYTES);
      if (chunk === undefined) throw new Error("bad offset");
      return chunk;
    },
  };
  return { transport, requests };
}

describe("transfer id", () => {
  it("is 128 random bits as 22 unpadded base64url characters, matching Node", () => {
    for (let i = 0; i < 100; i += 1) {
      const bytes = new Uint8Array(randomBytes(16));
      const id = encodeTransferId(bytes);
      assert.equal(id, Buffer.from(bytes).toString("base64url"));
      assert.ok(isTransferId(id));
    }
    assert.throws(() => encodeTransferId(new Uint8Array(15)));
  });
});

describe("manifest and resources from the Karoo's real fixture", () => {
  it("reproduces the fixture's segment bytes and hashes every resource exactly", async () => {
    const transfer = await build();
    assert.deepEqual(JSON.parse(new TextDecoder().decode(transfer.segmentBytes)), fixture.segment);
    const m = transfer.manifest;
    assert.equal(m.v, 2);
    assert.equal(m.transferId, transferId);
    assert.equal(m.segmentFingerprint, fixture.segment.fingerprint);
    assert.equal(m.plan.sha256, createHash("sha256").update(transfer.planBytes).digest("hex"));
    assert.equal(m.segment.sha256, createHash("sha256").update(transfer.segmentBytes).digest("hex"));
    assert.equal(m.rider!.sha256, createHash("sha256").update(transfer.riderBytes!).digest("hex"));
    assert.equal(m.plan.bytes, transfer.planBytes.length);
    assert.ok(transfer.planBytes.length < MAX_PLAN_BYTES && transfer.segmentBytes.length < MAX_SEGMENT_BYTES);
  });

  it("fits in 512 bytes with every optional field present, including the public flag", async () => {
    const plain = await build();
    assert.ok(new TextEncoder().encode(plain.manifestJson).length <= MAX_MANIFEST_BYTES);
    assert.equal(plain.manifest.segment.public, undefined);
    const pub = await build({ segmentIsPublic: true });
    assert.equal(pub.manifest.segment.public, true);
    const size = new TextEncoder().encode(pub.manifestJson).length;
    assert.ok(size <= MAX_MANIFEST_BYTES, `manifest is ${size} bytes`);
    assert.deepEqual(validateManifest(pub.manifestJson), []);
  });

  it("omits the rider resource when no weight is known", async () => {
    const transfer = await build({ rider: { ftpWatts: 280 } });
    assert.equal(transfer.riderBytes, undefined);
    assert.equal(transfer.manifest.rider, undefined);
    assert.deepEqual(validateManifest(transfer.manifestJson), []);
  });

  it("refuses to offer a transfer over a size cap, and says why a plan cannot be built", async () => {
    const big = segmentDetail();
    big.referencePolyline = Array.from({ length: 12_000 }, (_, i) => ({ lat: 37 + i * 1e-5, lng: -122, distanceMeters: i * 10, elevationMeters: 100 + i }));
    const over = await buildDirectTransfer({ segment: big, rider: { ftpWatts: 250 }, targetDurationMs: 1_800_000, nowMs: NOW, transferId, sha256Hex });
    assert.equal(over.ok, false);
    if (!over.ok) assert.match(over.message, /segment is \d+ bytes/);
    const noGoal = await buildDirectTransfer({ segment: segmentDetail(), rider: { ftpWatts: 250 }, targetDurationMs: undefined, nowMs: NOW, transferId, sha256Hex });
    assert.deepEqual(noGoal, { ok: false, message: "Set a goal time first." });
  });
});

describe("manifest validation (what the Karoo's strict parser should reject)", () => {
  it("accepts the built manifest and rejects each violation", async () => {
    const transfer = await build();
    assert.deepEqual(validateManifest(transfer.manifestJson), []);
    const mutate = (change: (m: Record<string, unknown>) => void) => {
      const copy = JSON.parse(transfer.manifestJson) as Record<string, unknown>;
      change(copy);
      return validateManifest(JSON.stringify(copy));
    };
    assert.match(mutate((m) => (m.v = 1))[0]!, /v must be 2/);
    assert.match(mutate((m) => (m.extra = 1))[0]!, /unknown field extra/);
    assert.match(mutate((m) => delete m.plan)[0]!, /missing plan/);
    assert.match(mutate((m) => (m.transferId = "short"))[0]!, /transferId/);
    assert.match(mutate((m) => ((m.plan as Record<string, unknown>).sha256 = "A".repeat(64)))[0]!, /plan.sha256/);
    assert.match(mutate((m) => ((m.plan as Record<string, unknown>).bytes = MAX_PLAN_BYTES + 1))[0]!, /over the \d+ byte cap/);
    assert.match(mutate((m) => ((m.segment as Record<string, unknown>).bytes = MAX_SEGMENT_BYTES + 1))[0]!, /segment.bytes is over/);
    assert.match(mutate((m) => (m.chunkBytes = 513))[0]!, /chunkBytes/);
    assert.match(mutate((m) => ((m.segment as Record<string, unknown>).public = "yes"))[0]!, /must be true/);
    assert.match(mutate((m) => ((m.segment as Record<string, unknown>).url = "https://x.example/s"))[0]!, /unknown field segment.url/);
    assert.match(validateManifest("x".repeat(600))[0]!, /larger than 512/);
  });
});

describe("chunked read with a reference Karoo reader", () => {
  const options = (have: boolean) => ({ haveSegmentFingerprint: () => have, sha256Hex });

  it("reassembles plan, segment and rider byte for byte and assembles the existing gritmap-transfer package", async () => {
    const transfer = await build();
    const { transport, requests } = fakePeripheral(transfer);
    const result = await readDirectTransfer(transport, options(false));
    assert.ok(result.ok);
    if (!result.ok) return;
    assert.ok(Buffer.from(result.plan).equals(Buffer.from(transfer.planBytes)));
    assert.ok(Buffer.from(result.segment!).equals(Buffer.from(transfer.segmentBytes)));
    assert.ok(Buffer.from(result.rider!).equals(Buffer.from(transfer.riderBytes!)));
    // 512-byte chunks, in order, from offset 0, no gaps.
    const planRequests = requests.filter((r) => r.resource === "plan");
    assert.deepEqual(planRequests.map((r) => r.offset), Array.from({ length: Math.ceil(transfer.planBytes.length / 512) }, (_, i) => i * 512));

    const pkg = assembleTransferPackage(result) as Record<string, unknown>;
    assert.deepEqual(Object.keys(pkg).sort(), ["baselinePacingPlan", "createdAtMs", "packageId", "packageType", "riderHistory", "schemaVersion", "segment"]);
    assert.equal(pkg.packageType, "gritmap-transfer");
    assert.equal(pkg.packageId, transferId);
    assert.deepEqual(pkg.segment, fixture.segment);
    const plan = pkg.baselinePacingPlan as { segmentFingerprint: string; ftpWatts: number; zones: { endDistanceMeters: number }[] };
    assert.equal(plan.segmentFingerprint, fixture.segment.fingerprint);
    assert.ok(Math.abs(plan.zones.at(-1)!.endDistanceMeters - fixture.segment.referencePolyline.at(-1)!.distanceMeters) <= 0.01);
  });

  it("never requests the segment when the Karoo already has the fingerprint", async () => {
    const transfer = await build();
    const { transport, requests } = fakePeripheral(transfer);
    const result = await readDirectTransfer(transport, options(true));
    assert.ok(result.ok);
    if (!result.ok) return;
    assert.equal(result.segment, undefined);
    assert.equal(requests.some((r) => r.resource === "segment"), false);
    assert.equal((assembleTransferPackage(result) as Record<string, unknown>).segment, undefined);
  });

  it("detects a corrupted plan or segment by SHA-256 before anything is parsed", async () => {
    const transfer = await build();
    for (const tamper of ["plan", "segment"] as const) {
      const { transport } = fakePeripheral(transfer, { tamper });
      const result = await readDirectTransfer(transport, options(false));
      assert.equal(result.ok, false, tamper);
      if (!result.ok) assert.equal(result.code, "bad_hash");
    }
  });

  it("rejects a manifest that violates the contract before reading anything", async () => {
    const transfer = await build();
    const { transport, requests } = fakePeripheral({ ...transfer, manifestJson: transfer.manifestJson.replace('"v":2', '"v":3') });
    const result = await readDirectTransfer(transport, options(false));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "bad_manifest");
    assert.equal(requests.length, 0);
  });
});

describe("receipt", () => {
  it("accepts only the matching id, a known status and a short snake_case code", () => {
    const ok = parseReceipt(receiptBytes({ transferId, status: "imported", code: "ok" }), transferId);
    assert.deepEqual(ok, { transferId, status: "imported", code: "ok" });
    assert.equal(parseReceipt(receiptBytes({ transferId: "x".repeat(22), status: "imported", code: "ok" }), transferId), undefined);
    assert.equal(parseReceipt(new TextEncoder().encode(`{"transferId":"${transferId}","status":"done","code":"ok"}`), transferId), undefined);
    assert.equal(parseReceipt(new TextEncoder().encode(`{"transferId":"${transferId}","status":"imported","code":"OK!"}`), transferId), undefined);
    assert.equal(parseReceipt(new TextEncoder().encode(`{"transferId":"${transferId}","status":"imported","code":"ok","x":1}`), transferId), undefined);
    assert.equal(parseReceipt(new Uint8Array(200), transferId), undefined);
  });
});

describe("what the phone says", () => {
  const events: Parameters<typeof reduceBleEvent>[1][] = [
    { state: "advertising" },
    { state: "connected" },
    { state: "progress", resource: "plan", served: 512, total: 3000 },
    { state: "sentUnconfirmed" },
    { state: "timedOut" },
    { state: "stopped" },
    { state: "poweredOff" },
    { state: "unauthorized" },
    { state: "unsupported" },
    { state: "error" },
    { state: "receipt", status: "rejected", code: "bad_hash" },
  ];

  it("says Imported only for a receipt with status imported", () => {
    for (const event of events) {
      const text = describeBleSend(reduceBleEvent({ phase: "idle" }, event)).text;
      assert.doesNotMatch(text, /imported/i, JSON.stringify(event));
    }
    const done = describeBleSend(reduceBleEvent({ phase: "idle" }, { state: "receipt", status: "imported", code: "ok" }));
    assert.equal(done.text, "Imported on your Karoo.");
    assert.equal(done.tone, "success");
  });

  it("walks advertising, connected, sending with a percentage, then sent-unconfirmed", () => {
    let state: BleSendState = { phase: "idle" };
    state = reduceBleEvent(state, { state: "advertising" });
    assert.match(describeBleSend(state).text, /Inbox, then Receive from Phone/);
    state = reduceBleEvent(state, { state: "connected" });
    state = reduceBleEvent(state, { state: "progress", resource: "plan", served: 1500, total: 3000 });
    assert.match(describeBleSend(state).text, /Sending the plan to your Karoo… 50%/);
    state = reduceBleEvent(state, { state: "progress", resource: "plan", served: 3000, total: 3000 });
    assert.equal(state.phase === "sending" && state.planDone, true);
    state = reduceBleEvent(state, { state: "sentUnconfirmed" });
    assert.match(describeBleSend(state).text, /Sent; check your Karoo/);
  });

  it("explains a rejection in words and falls back for an unknown code", () => {
    assert.match(describeBleSend({ phase: "rejected", code: "ftp_mismatch" }).text, /different FTP/);
    assert.match(describeBleSend({ phase: "rejected", code: "something_new" }).text, /couldn't use this transfer\./);
  });
});

describe("development flag and base64", () => {
  const db = (value?: string) => ({ prepare: () => ({ get: () => (value === undefined ? undefined : { value }), run: () => undefined }) });

  it("is off for a release build without a flag, on in a dev build, a build flag or the device setting", () => {
    assert.equal(isBleTransferEnabled(db(), false, ""), false);
    assert.equal(isBleTransferEnabled(db("0"), false, ""), false);
    assert.equal(isBleTransferEnabled(db(), true, ""), true);
    assert.equal(isBleTransferEnabled(db(), false, "1"), true);
    assert.equal(isBleTransferEnabled(db("1"), false, ""), true);
  });

  it("encodes bytes as standard padded base64, like Node", () => {
    for (const length of [0, 1, 2, 3, 4, 5, 257]) {
      const bytes = new Uint8Array(randomBytes(length));
      assert.equal(bytesToBase64(bytes), Buffer.from(bytes).toString("base64"));
    }
  });
});
