import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import type { SegmentDetail } from "../db/getSegmentDetail.ts";
import type { SavedSegmentPlan } from "../db/segmentPlans.ts";
import { describeBleSend, describePacingNote, KAROO_TOO_OLD_FOR_PACING_TEXT, reduceBleEvent, showsPacingNote, type BleSendState } from "./bleSendStatus.ts";
import {
  assembleTransferPackage,
  buildDirectTransfer,
  CHUNK_BYTES,
  chunkFor,
  readDirectTransfer,
  validateManifest,
  type DirectTransfer,
  type DirectTransferTransport,
} from "./directTransfer.ts";
import { buildDirectTransferOffer, chooseVariant, toNativeOfferConfig, type DirectTransferOffer, type OfferVariant } from "./directTransferOffer.ts";
import { gateTransferExtensions } from "./receiverCapabilities.ts";
import { encodeTransferId } from "./transferId.ts";

const sha256Hex = async (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const NOW = 1_791_570_000_000;
const transferId = encodeTransferId(new Uint8Array(16).fill(7));

/** Codex's shared, invented contract fixtures (fixtures/contracts/): the Karoo's own tests parse the very same files. */
const caps = JSON.parse(readFileSync("fixtures/contracts/receiver-capabilities-v1.json", "utf8")) as Record<string, unknown>;
const ceilingsFixture = JSON.parse(readFileSync("fixtures/contracts/plan-ceilings-transfer-v1.json", "utf8")) as { baselinePacingPlan: Record<string, any> };
const recordFixture = JSON.parse(readFileSync("fixtures/contracts/segment-record-v1.json", "utf8")) as Record<string, unknown>;

const karooSegment = JSON.parse(readFileSync("apps/karoo/samples/Diablo.Northgate-to-Junction.40m30.guidance-package.json", "utf8")) as {
  segment: { schemaVersion: number; id: string; name: string; matching: { corridorMeters: number; requiredCoveragePct: number }; referencePolyline: { lat: number; lng: number; distanceMeters: number; elevationMeters?: number }[]; fingerprint: string };
};

function segmentDetail(): SegmentDetail {
  const s = karooSegment.segment;
  return { segmentId: s.id, name: s.name, corridorMeters: s.matching.corridorMeters, requiredCoveragePct: s.matching.requiredCoveragePct, schemaVersion: s.schemaVersion, fingerprint: s.fingerprint, createdAtMs: NOW, referencePolyline: s.referencePolyline };
}

/** The shared record fixture, re-pointed at this test's segment (its own fingerprint and installed length). */
function recordFor(segment: SegmentDetail) {
  const length = segment.referencePolyline.at(-1)!.distanceMeters;
  return { ...recordFixture, segmentFingerprint: segment.fingerprint, splits: [{ distanceMeters: 0, elapsedSeconds: 0 }, { distanceMeters: length, elapsedSeconds: recordFixture.bestDurationSeconds }] };
}

type OfferInput = Parameters<typeof buildDirectTransferOffer>[0];
const baseInput = (overrides: Partial<OfferInput> = {}): OfferInput => ({
  segment: segmentDetail(),
  rider: { ftpWatts: 250, weightKg: 70 },
  targetDurationMs: 40.5 * 60_000,
  planHistory: { attempts: [], riderWeightKg: 70 },
  nowMs: NOW,
  transferId,
  sha256Hex,
  ...overrides,
});

async function offerFor(overrides: Partial<OfferInput> = {}): Promise<DirectTransferOffer> {
  const result = await buildDirectTransferOffer(baseInput(overrides));
  assert.ok(result.ok, result.ok ? "" : result.message);
  return result.ok ? result.offer : (undefined as never);
}

const names = (offer: DirectTransferOffer) => offer.variants.map((variant) => variant.name);
const planOf = (variant: OfferVariant) => JSON.parse(new TextDecoder().decode(variant.transfer.planBytes)) as Record<string, any>;

/** The Karoo's reference reader over an in-memory phone serving exactly one frozen variant. */
async function readVariant(transfer: DirectTransfer) {
  const resources: Record<string, Uint8Array> = { plan: transfer.planBytes, segment: transfer.segmentBytes };
  if (transfer.riderBytes !== undefined) resources.rider = transfer.riderBytes;
  if (transfer.recordBytes !== undefined) resources.record = transfer.recordBytes;
  let last: { resource: string; offset: number } | undefined;
  const transport: DirectTransferTransport = {
    readManifest: async () => new TextEncoder().encode(transfer.manifestJson),
    writeRequest: async (body) => {
      const request = JSON.parse(new TextDecoder().decode(body)) as { resource: string; offset: number };
      if (resources[request.resource] === undefined) throw new Error("request refused");
      last = request;
    },
    readData: async () => chunkFor(resources[last!.resource]!, last!.offset, CHUNK_BYTES)!,
  };
  const result = await readDirectTransfer(transport, { haveSegmentFingerprint: () => false, sha256Hex });
  assert.ok(result.ok, result.ok ? "" : result.message);
  return assembleTransferPackage(result as Extract<typeof result, { ok: true }>) as Record<string, any>;
}

describe("variants against the Karoo-side contract fixtures", () => {
  it("builds the baseline exactly as before: no ceilings, no replan, no record, byte for byte what an old phone sent", async () => {
    const offer = await offerFor();
    const baseline = offer.variants.at(-1)!;
    assert.equal(baseline.name, "baseline");
    assert.deepEqual(baseline.requires, []);
    const plain = await buildDirectTransfer(baseInput() as Parameters<typeof buildDirectTransfer>[0]);
    assert.ok(plain.ok);
    if (!plain.ok) return;
    assert.equal(baseline.transfer.manifestJson, plain.transfer.manifestJson);
    assert.deepEqual(Buffer.from(baseline.transfer.planBytes), Buffer.from(plain.transfer.planBytes));
    const plan = planOf(baseline);
    assert.equal(plan.replan, undefined);
    assert.ok(plan.zones.every((zone: Record<string, unknown>) => zone.ceilingPowerWatts === undefined));
    assert.equal(baseline.transfer.recordBytes, undefined);
    assert.equal(baseline.transfer.manifest.record, undefined);
  });

  it("adds a ceilings variant whose plan has exactly the fixture's field names and honours its bounds", async () => {
    const offer = await offerFor();
    assert.deepEqual(names(offer), ["ceilings", "baseline"]);
    assert.equal(offer.pacing.ceilings, true);
    const ceilings = offer.variants[0]!;
    assert.deepEqual(ceilings.requires, ["planCeilingsV1"]);
    const plan = planOf(ceilings);
    assert.deepEqual(Object.keys(plan.replan).sort(), Object.keys(ceilingsFixture.baselinePacingPlan.replan).sort());
    assert.equal(plan.replan.schemaVersion, 1);
    assert.deepEqual(Object.keys(plan.zones[0]).sort(), Object.keys(ceilingsFixture.baselinePacingPlan.zones[0]).sort());
    const ftp = plan.ftpWatts as number;
    for (const zone of plan.zones) {
      assert.ok(Number.isInteger(zone.ceilingPowerWatts));
      assert.ok(zone.targetPowerWatts <= zone.ceilingPowerWatts, "target never above its ceiling");
      assert.ok(zone.ceilingPowerWatts <= Math.floor(1.5 * ftp) && zone.ceilingPowerWatts >= Math.floor(0.7 * ftp));
    }
    // The extension never changes the targets the rider is told to ride.
    const baselinePlan = planOf(offer.variants.at(-1)!);
    assert.deepEqual(plan.zones.map((z: any) => z.targetPowerWatts), baselinePlan.zones.map((z: any) => z.targetPowerWatts));
    assert.equal(plan.id, baselinePlan.id);
    assert.equal(plan.targetFinishTimeSeconds, baselinePlan.targetFinishTimeSeconds);
  });

  it("every variant manifest is valid and within the 512-byte ceiling", async () => {
    for (const overrides of [{}, { segmentIsPublic: true }, { rider: { ftpWatts: 250 } }]) {
      const offer = await offerFor(overrides);
      for (const variant of offer.variants) {
        assert.deepEqual(validateManifest(variant.transfer.manifestJson), [], `${variant.name}: ${variant.transfer.manifestJson.length} bytes`);
        assert.ok(new TextEncoder().encode(variant.transfer.manifestJson).length <= 512);
      }
    }
  });

  it("matches Codex's receiver gate for every kind of advertisement, old and new, valid and not", async () => {
    // A rider with no weight and a segment that is not public keeps the manifest small enough for the record descriptor.
    const segment = segmentDetail();
    const offer = await offerFor({ rider: { ftpWatts: 250 }, record: recordFor(segment) });
    assert.deepEqual(names(offer), ["full", "ceilings", "record", "baseline"]);
    assert.equal(offer.pacing.record, true);
    const full = await readVariant(offer.variants[0]!.transfer);
    assert.ok(full.segmentRecord, "the richest variant carries the record");
    assert.ok(full.baselinePacingPlan.replan, "... and the ceilings");
    const advertisements: unknown[] = [
      undefined, null, {}, [], "nope",
      caps,
      { ...caps, features: ["planCeilingsV1"] },
      { ...caps, features: ["segmentRecordV1"] },
      { ...caps, features: [] },
      { ...caps, features: ["somethingNew"] },
      { ...caps, features: ["planCeilingsV1", "somethingNew"] },
      { ...caps, v: 2 },
      { ...caps, unknown: 1 },
      { ...caps, maxRecordBytes: 10 },
      { ...caps, maxManifestBytes: 513 },
    ];
    for (const advertisement of advertisements) {
      const chosen = chooseVariant(offer.variants, advertisement);
      const got = await readVariant(chosen.transfer);
      assert.deepEqual(got, gateTransferExtensions(full, advertisement), `advertisement ${JSON.stringify(advertisement)} chose ${chosen.name}`);
    }
    assert.equal(chooseVariant(offer.variants, caps).name, "full");
    assert.equal(chooseVariant(offer.variants, undefined).name, "baseline");
    assert.equal(chooseVariant(offer.variants, { ...caps, features: ["planCeilingsV1"] }).name, "ceilings");
    assert.equal(chooseVariant(offer.variants, { ...caps, features: ["segmentRecordV1"] }).name, "record");
  });

  it("serves every variant through the chunked reader with all hashes verified, including the record", async () => {
    const offer = await offerFor({ rider: { ftpWatts: 250 }, record: recordFor(segmentDetail()) });
    for (const variant of offer.variants) {
      const pkg = await readVariant(variant.transfer);
      assert.equal(pkg.packageId, transferId);
      assert.equal(pkg.segment.fingerprint, segmentDetail().fingerprint);
    }
  });

  it("leaves the record out, and says so, when the 512-byte manifest cannot hold its descriptor; never the rider profile", async () => {
    const offer = await offerFor({ segmentIsPublic: true, record: recordFor(segmentDetail()) });
    assert.equal(offer.pacing.record, false);
    assert.equal(offer.pacing.recordOmitted, "manifest_too_large");
    assert.deepEqual(names(offer), ["ceilings", "baseline"]);
    for (const variant of offer.variants) assert.ok(variant.transfer.manifest.rider !== undefined, `${variant.name} keeps the rider profile`);
  });

  it("never stages a record that fails validation, and says so", async () => {
    const segment = segmentDetail();
    for (const record of [{ ...recordFor(segment), extra: 1 }, { ...recordFor(segment), segmentFingerprint: "cd".repeat(32) }, { ...recordFor(segment), bestDurationSeconds: 0 }, "x"]) {
      const offer = await offerFor({ rider: { ftpWatts: 250 }, record });
      assert.equal(offer.pacing.recordOmitted, "invalid_record");
      assert.ok(offer.variants.every((variant) => variant.transfer.recordBytes === undefined));
    }
  });

  it("offers no extension for an imported plan, which is never rewritten", async () => {
    const imported: SavedSegmentPlan = {
      id: "imp", segmentId: segmentDetail().segmentId, source: "human-coach", profileVersion: 1, ftpWatts: 250, createdAtMs: 1,
      zones: [{ startDistanceMeters: 0, endDistanceMeters: 5_000, targetPowerWatts: 200, classification: "HOLD", instruction: "Hold" }],
    };
    const offer = await offerFor({ importedPlan: imported, targetDurationMs: undefined });
    assert.deepEqual(names(offer), ["baseline"]);
    assert.deepEqual(offer.pacing, { ceilings: false, record: false });
  });

  it("hands the native layer a compact offer: baseline included, shared bytes sent once, nothing but known fields", async () => {
    const offer = await offerFor({ rider: { ftpWatts: 250 }, record: recordFor(segmentDetail()) });
    const config = JSON.parse(toNativeOfferConfig(offer, 120_000)) as { advertiseMs: number; resources: Record<string, string>; variants: { name: string; requires: string[]; manifest: string; resources: Record<string, string> }[] };
    assert.equal(config.advertiseMs, 120_000);
    assert.deepEqual(config.variants.map((v) => v.name), ["full", "ceilings", "record", "baseline"]);
    assert.deepEqual(config.variants.at(-1)!.requires, []);
    assert.equal(Object.keys(config.resources).length, 4, "baseline plan, ceilings plan, segment and record: the segment is not repeated per variant");
    for (const variant of config.variants) {
      assert.deepEqual(Object.keys(variant).sort(), ["manifest", "name", "requires", "resources"]);
      for (const key of Object.keys(variant.resources)) assert.ok(["plan", "segment", "rider", "record"].includes(key));
      for (const pooled of Object.values(variant.resources)) assert.ok(config.resources[pooled] !== undefined);
      assert.ok(variant.name.match(/^[a-z0-9]{1,24}$/));
    }
    assert.equal(config.variants.filter((v) => v.resources.segment === config.variants[0]!.resources.segment).length, 4);
  });
});

describe("what the phone says about pacing fields", () => {
  const offered = { ceilings: true, record: false };

  it("tells the rider plainly when the Karoo is too old for pacing limits, and what to do", () => {
    const note = describePacingNote(offered, "baseline");
    assert.equal(note?.kind, "tooOld");
    assert.equal(note?.text, KAROO_TOO_OLD_FOR_PACING_TEXT);
    assert.match(note!.text, /too old for pacing limits/);
    assert.match(note!.text, /Update GritMap on your Karoo/);
    assert.doesNotMatch(note!.text, /ceiling|replan|capabilit|variant|manifest|\bBLE\b|characteristic/i);
  });

  it("confirms delivery when the Karoo took a richer variant", () => {
    for (const variant of ["full", "ceilings", "record"]) assert.equal(describePacingNote(offered, variant)?.kind, "delivered");
  });

  it("says nothing when there was nothing extra to send, or the phone cannot tell which variant was used", () => {
    assert.equal(describePacingNote({ ceilings: false, record: false }, "baseline"), undefined);
    assert.equal(describePacingNote(offered, undefined), undefined);
  });

  it("shows the note only after the Karoo has read the plan, and the variant event changes no phase", () => {
    const states: [BleSendState, boolean][] = [
      [{ phase: "advertising" }, false], [{ phase: "connected" }, false], [{ phase: "rejected", code: "bad_plan" }, false],
      [{ phase: "timedOut" }, false], [{ phase: "imported", code: "ok" }, true], [{ phase: "sentUnconfirmed" }, true],
    ];
    for (const [state, shown] of states) assert.equal(showsPacingNote(state), shown, state.phase);
    const connected: BleSendState = { phase: "connected" };
    assert.deepEqual(reduceBleEvent(connected, { state: "variant", variant: "baseline" }), connected);
    assert.equal(describeBleSend({ phase: "imported", code: "ok" }).text, "Imported on your Karoo.");
  });
});
