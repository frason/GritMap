import type { SegmentDetail } from "../db/getSegmentDetail.ts";
import type { SavedSegmentPlan } from "../db/segmentPlans.ts";
import { buildTransferBaselinePlan, buildTransferSegmentJson } from "../karoo/buildTransferParts.ts";
import type { PlanHistoryInput } from "../pacing/generateRealisticPlan.ts";
import { buildRiderHistoryPackage } from "../pacing/buildRiderHistoryPackage.ts";
import { isTransferId } from "./transferId.ts";

/**
 * Phone-side implementation of docs/BLE_DIRECT_TRANSFER_CONTRACT.md (v2): build the exact bytes
 * (segment, plan, rider), the manifest that describes them, and a reference reader that walks the same
 * chunk protocol the Karoo will, so the contract is testable without a radio.
 */
export const SERVICE_UUID = "e7a4e868-0a21-45d6-ac63-5812c740ba12";
export const MANIFEST_UUID = "a9c5876c-8f5f-48be-aae7-eb47ef573c41";
export const REQUEST_UUID = "59e28123-c142-4b89-acba-57d76e483b72";
export const DATA_UUID = "83e82ba5-a7f4-47c5-bf6c-6473178bef68";
export const STATUS_UUID = "c0bb77af-3bd8-4c60-b669-91ac74c778b9";

export const MAX_MANIFEST_BYTES = 512;
export const CHUNK_BYTES = 512;
export const MIN_CHUNK_BYTES = 20;
export const MAX_PLAN_BYTES = 128 * 1024;
export const MAX_SEGMENT_BYTES = 512 * 1024;
export const MAX_RIDER_BYTES = 16 * 1024;
/** Where a published segment lives (src/registry/registryConfig.ts); the manifest only says "public: true". */
export const OPEN_SEGMENTS_BASE_URL = "https://raw.githubusercontent.com/frason/GritMap/main/registry/segments/";
export const MAX_REQUEST_BYTES = 64;
export const MAX_STATUS_BYTES = 128;

export type ResourceName = "plan" | "segment" | "rider";
export const RESOURCE_CAPS: Record<ResourceName, number> = { plan: MAX_PLAN_BYTES, segment: MAX_SEGMENT_BYTES, rider: MAX_RIDER_BYTES };

export interface ManifestResource {
  bytes: number;
  sha256: string;
}

export interface TransferManifest {
  v: 2;
  transferId: string;
  createdAtMs: number;
  segmentFingerprint: string;
  chunkBytes: number;
  plan: ManifestResource;
  segment: ManifestResource & { public?: true };
  rider?: ManifestResource;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const SHA256 = /^[0-9a-f]{64}$/;

export function jsonBytes(value: object): Uint8Array {
  return encoder.encode(JSON.stringify(value));
}

export interface DirectTransfer {
  manifest: TransferManifest;
  manifestJson: string;
  planBytes: Uint8Array;
  segmentBytes: Uint8Array;
  riderBytes: Uint8Array | undefined;
  /** The plan as built, for the caller's records. */
  baselinePacingPlan: object;
}

export type BuildDirectTransferResult = { ok: true; transfer: DirectTransfer } | { ok: false; message: string };

/**
 * Builds a transfer from the same segment and plan the Wi-Fi send uses (`buildTransferParts.ts`), plus
 * the same rider history object when a weight is known. `sha256Hex` is injected so tests do not need a
 * native crypto module.
 */
export async function buildDirectTransfer(input: {
  segment: SegmentDetail;
  rider: { ftpWatts: number; weightKg?: number | undefined; maxHeartRateBpm?: number | undefined };
  targetDurationMs: number | undefined;
  importedPlan?: SavedSegmentPlan | undefined;
  nowMs: number;
  transferId: string;
  sha256Hex: (bytes: Uint8Array) => Promise<string>;
  /** Only when the phone knows this exact segment is published in Open Segments. */
  segmentIsPublic?: boolean | undefined;
  /** The rider's past efforts on this segment, so a generated plan is made realistic (see buildTransferBaselinePlan). */
  planHistory?: PlanHistoryInput | undefined;
}): Promise<BuildDirectTransferResult> {
  if (!isTransferId(input.transferId)) return { ok: false, message: "Invalid transfer id" };
  const plan = buildTransferBaselinePlan({
    segment: input.segment,
    rider: input.rider,
    targetDurationMs: input.targetDurationMs,
    importedPlan: input.importedPlan,
    packageId: input.transferId,
    nowMs: input.nowMs,
    planHistory: input.planHistory,
  });
  if (!plan.ok) return { ok: false, message: plan.message };

  const planBytes = jsonBytes(plan.baselinePacingPlan);
  const segmentBytes = jsonBytes(buildTransferSegmentJson(input.segment));
  const riderBytes =
    input.rider.weightKg === undefined
      ? undefined
      : jsonBytes(
          buildRiderHistoryPackage({
            ftpWatts: input.rider.ftpWatts,
            weightKg: input.rider.weightKg,
            ...(input.rider.maxHeartRateBpm === undefined ? {} : { maxHeartRateBpm: input.rider.maxHeartRateBpm }),
          }),
        );

  const over: string[] = [];
  if (planBytes.length > MAX_PLAN_BYTES) over.push(`plan is ${planBytes.length} bytes (limit ${MAX_PLAN_BYTES})`);
  if (segmentBytes.length > MAX_SEGMENT_BYTES) over.push(`segment is ${segmentBytes.length} bytes (limit ${MAX_SEGMENT_BYTES})`);
  if (riderBytes !== undefined && riderBytes.length > MAX_RIDER_BYTES) over.push(`rider is ${riderBytes.length} bytes (limit ${MAX_RIDER_BYTES})`);
  if (over.length > 0) return { ok: false, message: over.join("; ") };

  const [planSha, segmentSha, riderSha] = await Promise.all([
    input.sha256Hex(planBytes),
    input.sha256Hex(segmentBytes),
    riderBytes === undefined ? Promise.resolve(undefined) : input.sha256Hex(riderBytes),
  ]);

  const manifest: TransferManifest = {
    v: 2,
    transferId: input.transferId,
    createdAtMs: input.nowMs,
    segmentFingerprint: input.segment.fingerprint,
    chunkBytes: CHUNK_BYTES,
    plan: { bytes: planBytes.length, sha256: planSha },
    segment: { bytes: segmentBytes.length, sha256: segmentSha, ...(input.segmentIsPublic === true ? { public: true as const } : {}) },
    ...(riderBytes === undefined || riderSha === undefined ? {} : { rider: { bytes: riderBytes.length, sha256: riderSha } }),
  };
  const manifestJson = JSON.stringify(manifest);
  const problems = validateManifest(manifestJson);
  if (problems.length > 0) return { ok: false, message: `Manifest is invalid: ${problems.join("; ")}` };

  return { ok: true, transfer: { manifest, manifestJson, planBytes, segmentBytes, riderBytes, baselinePacingPlan: plan.baselinePacingPlan } };
}

/** Everything the Karoo's strict manifest parser should reject, as readable strings; empty means accepted. */
export function validateManifest(json: string): string[] {
  if (encoder.encode(json).length > MAX_MANIFEST_BYTES) return [`manifest is larger than ${MAX_MANIFEST_BYTES} bytes`];
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return ["manifest is not JSON"];
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return ["manifest is not an object"];
  const m = value as Record<string, unknown>;
  const problems: string[] = [];
  const allowed = ["v", "transferId", "createdAtMs", "segmentFingerprint", "chunkBytes", "plan", "segment", "rider"];
  for (const key of Object.keys(m)) if (!allowed.includes(key)) problems.push(`unknown field ${key}`);
  for (const key of ["v", "transferId", "createdAtMs", "segmentFingerprint", "chunkBytes", "plan", "segment"]) {
    if (!(key in m)) problems.push(`missing ${key}`);
  }
  if (m.v !== 2) problems.push("v must be 2");
  if (typeof m.transferId !== "string" || !isTransferId(m.transferId)) problems.push("transferId must be 22 base64url characters");
  if (typeof m.createdAtMs !== "number" || !Number.isInteger(m.createdAtMs) || m.createdAtMs <= 0) problems.push("createdAtMs must be a positive integer");
  if (typeof m.segmentFingerprint !== "string" || !SHA256.test(m.segmentFingerprint)) problems.push("segmentFingerprint must be 64 lowercase hex");
  if (typeof m.chunkBytes !== "number" || !Number.isInteger(m.chunkBytes) || m.chunkBytes < MIN_CHUNK_BYTES || m.chunkBytes > CHUNK_BYTES) {
    problems.push(`chunkBytes must be ${MIN_CHUNK_BYTES} to ${CHUNK_BYTES}`);
  }
  for (const name of ["plan", "segment", "rider"] as const) {
    if (!(name in m)) continue;
    const resource = m[name];
    if (typeof resource !== "object" || resource === null) {
      problems.push(`${name} must be an object`);
      continue;
    }
    const r = resource as Record<string, unknown>;
    const keys = name === "segment" ? ["bytes", "sha256", "public"] : ["bytes", "sha256"];
    for (const key of Object.keys(r)) if (!keys.includes(key)) problems.push(`unknown field ${name}.${key}`);
    if (typeof r.bytes !== "number" || !Number.isInteger(r.bytes) || r.bytes < 1) problems.push(`${name}.bytes must be a positive integer`);
    else if (r.bytes > RESOURCE_CAPS[name]) problems.push(`${name}.bytes is over the ${RESOURCE_CAPS[name]} byte cap`);
    if (typeof r.sha256 !== "string" || !SHA256.test(r.sha256)) problems.push(`${name}.sha256 must be 64 lowercase hex`);
    if (name === "segment" && "public" in r && r.public !== true) problems.push("segment.public, when present, must be true");
  }
  return problems;
}

/** What a central writes to the Request characteristic. */
export function requestBytes(resource: ResourceName, offset: number): Uint8Array {
  return encoder.encode(JSON.stringify({ resource, offset }));
}

/** The phone's answer to a Data read: the last requested chunk. Mirrors TransferSession.swift. */
export function chunkFor(bytes: Uint8Array, offset: number, chunkBytes: number): Uint8Array | undefined {
  if (!Number.isInteger(offset) || offset < 0 || offset >= bytes.length) return undefined;
  return bytes.subarray(offset, Math.min(offset + chunkBytes, bytes.length));
}

export interface Receipt {
  transferId: string;
  status: "imported" | "rejected";
  code: string;
}

export function receiptBytes(receipt: Receipt): Uint8Array {
  return encoder.encode(JSON.stringify(receipt));
}

/** Parses a Status write; undefined when it is not a valid receipt for `transferId`. Mirrors TransferSession.swift. */
export function parseReceipt(bytes: Uint8Array, transferId: string): Receipt | undefined {
  if (bytes.length > MAX_STATUS_BYTES) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(decoder.decode(bytes));
  } catch {
    return undefined;
  }
  if (typeof value !== "object" || value === null) return undefined;
  const r = value as Record<string, unknown>;
  if (Object.keys(r).length !== 3) return undefined;
  if (r.transferId !== transferId) return undefined;
  if (r.status !== "imported" && r.status !== "rejected") return undefined;
  if (typeof r.code !== "string" || !/^[a-z0-9_]{1,32}$/.test(r.code)) return undefined;
  return { transferId, status: r.status, code: r.code };
}

/** The transport a reader uses: one GATT connection to the phone. */
export interface DirectTransferTransport {
  readManifest(): Promise<Uint8Array>;
  writeRequest(body: Uint8Array): Promise<void>;
  readData(): Promise<Uint8Array>;
}

export type ReadResult =
  | { ok: true; segment: Uint8Array | undefined; plan: Uint8Array; rider: Uint8Array | undefined; manifest: TransferManifest }
  | { ok: false; code: "bad_manifest" | "too_large" | "bad_hash" | "timeout"; message: string };

/**
 * The Karoo's side of the exchange as a reference implementation (also used by the tests): read and
 * validate the manifest, skip the segment when its fingerprint is already installed, read every needed
 * resource chunk by chunk, and verify length and SHA-256 over the exact reassembled bytes before
 * anything is parsed.
 */
export async function readDirectTransfer(
  transport: DirectTransferTransport,
  options: { haveSegmentFingerprint: (fingerprint: string) => boolean; sha256Hex: (bytes: Uint8Array) => Promise<string> },
): Promise<ReadResult> {
  const manifestBytes = await transport.readManifest();
  const manifestText = decoder.decode(manifestBytes);
  const problems = validateManifest(manifestText);
  if (problems.length > 0) return { ok: false, code: "bad_manifest", message: problems.join("; ") };
  const manifest = JSON.parse(manifestText) as TransferManifest;

  const fetchResource = async (name: ResourceName, info: ManifestResource): Promise<Uint8Array | ReadResult> => {
    const out = new Uint8Array(info.bytes);
    let offset = 0;
    while (offset < info.bytes) {
      await transport.writeRequest(requestBytes(name, offset));
      const chunk = await transport.readData();
      if (chunk.length === 0 || chunk.length > manifest.chunkBytes || offset + chunk.length > info.bytes) {
        return { ok: false, code: "bad_hash", message: `${name} chunk at ${offset} has an impossible length` };
      }
      out.set(chunk, offset);
      offset += chunk.length;
    }
    if ((await options.sha256Hex(out)) !== info.sha256) return { ok: false, code: "bad_hash", message: `${name} SHA-256 mismatch` };
    return out;
  };

  const plan = await fetchResource("plan", manifest.plan);
  if (!(plan instanceof Uint8Array)) return plan;
  let segment: Uint8Array | undefined;
  if (!options.haveSegmentFingerprint(manifest.segmentFingerprint)) {
    const fetched = await fetchResource("segment", manifest.segment);
    if (!(fetched instanceof Uint8Array)) return fetched;
    segment = fetched;
  }
  let rider: Uint8Array | undefined;
  if (manifest.rider !== undefined) {
    const fetched = await fetchResource("rider", manifest.rider);
    if (!(fetched instanceof Uint8Array)) return fetched;
    rider = fetched;
  }
  return { ok: true, segment, plan, rider, manifest };
}

/** The existing `gritmap-transfer` package the Karoo then hands to its unchanged strict parser. */
export function assembleTransferPackage(result: Extract<ReadResult, { ok: true }>): object {
  const parse = (bytes: Uint8Array) => JSON.parse(decoder.decode(bytes)) as unknown;
  return {
    schemaVersion: 1,
    packageType: "gritmap-transfer",
    packageId: result.manifest.transferId,
    createdAtMs: result.manifest.createdAtMs,
    ...(result.segment === undefined ? {} : { segment: parse(result.segment) }),
    ...(result.rider === undefined ? {} : { riderHistory: parse(result.rider) }),
    baselinePacingPlan: parse(result.plan),
  };
}

export function bytesToBase64(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    const n = (b0 << 16) | ((b1 ?? 0) << 8) | (b2 ?? 0);
    out += alphabet[(n >> 18) & 63]! + alphabet[(n >> 12) & 63]!;
    out += b1 === undefined ? "=" : alphabet[(n >> 6) & 63]!;
    out += b2 === undefined ? "=" : alphabet[n & 63]!;
  }
  return out;
}
