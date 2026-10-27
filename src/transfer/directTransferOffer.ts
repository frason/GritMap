import { buildDirectTransfer, bytesToBase64, type DirectTransfer } from "./directTransfer.ts";
import { parseReceiverCapabilities, type ReceiverCapabilities } from "./receiverCapabilities.ts";
import { validateSegmentRecord } from "./segmentRecord.ts";

/**
 * One Bluetooth send, staged as several complete offers (docs/RECEIVER_CAPABILITIES_CONTRACT.md): a baseline that
 * every Karoo, old or new, can read, and richer variants carrying the optional pacing fields. The phone is the BLE
 * peripheral, so the Karoo (the central) tells it what it understands by writing the optional capabilities
 * characteristic before its first manifest read; the native layer then freezes exactly one variant for that Karoo.
 * A Karoo that never writes it (every released one) is served the baseline unchanged.
 */
export type OfferFeature = "planCeilingsV1" | "segmentRecordV1";
export type VariantName = "full" | "ceilings" | "record" | "baseline";

export interface OfferVariant {
  name: VariantName;
  /** The receiver features this variant carries fields for. Empty for the baseline. */
  requires: OfferFeature[];
  transfer: DirectTransfer;
}

/** What the phone had to offer beyond the baseline, so it can say honestly what the Karoo did and did not get. */
export interface PacingOffered {
  /** Plan ceilings and replan limits were generated (a generated realistic plan; never an imported coach plan). */
  ceilings: boolean;
  /** A valid personal-best record was staged in at least one variant. */
  record: boolean;
  /** Why a record that was supplied is not in any variant (never silently dropped). */
  recordOmitted?: "invalid_record" | "manifest_too_large";
}

export interface DirectTransferOffer {
  transferId: string;
  /** Richest first, the baseline always last. */
  variants: OfferVariant[];
  pacing: PacingOffered;
}

export type BuildDirectTransferOfferResult = { ok: true; offer: DirectTransferOffer } | { ok: false; message: string };

type BuildInput = Parameters<typeof buildDirectTransfer>[0];

/** The advertisement the phone pretends to receive, only to ask the shared builder for the matching extension fields. */
function advertisementFor(features: OfferFeature[]): ReceiverCapabilities {
  return { v: 1, transferV: 2, versionCode: 1, features, maxManifestBytes: 512, maxRecordBytes: features.includes("segmentRecordV1") ? 8192 : 0 };
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

function segmentLengthMeters(segment: BuildInput["segment"]): number | undefined {
  return segment.referencePolyline[segment.referencePolyline.length - 1]?.distanceMeters;
}

/**
 * Builds the baseline (exactly what the phone has always sent) plus every richer variant that has something to
 * add: ceilings and replan limits for a generated plan, and a validated `segmentRecord` when one is supplied and the
 * 512-byte manifest still holds its descriptor. A record that is invalid or does not fit is left out and reported in
 * `pacing.recordOmitted`; the rider profile is never dropped to make room and nothing is truncated.
 */
export async function buildDirectTransferOffer(
  input: Omit<BuildInput, "receiverCapabilities" | "record"> & { record?: unknown },
): Promise<BuildDirectTransferOfferResult> {
  const { record: suppliedRecord, ...rest } = input;
  const shared: Omit<BuildInput, "receiverCapabilities" | "record"> = rest;
  const baseline = await buildDirectTransfer(shared);
  if (!baseline.ok) return baseline;

  const variants: OfferVariant[] = [];
  const pacing: PacingOffered = { ceilings: false, record: false };

  const withCeilings = await buildDirectTransfer({ ...shared, receiverCapabilities: advertisementFor(["planCeilingsV1"]) });
  if (withCeilings.ok && !sameBytes(withCeilings.transfer.planBytes, baseline.transfer.planBytes)) {
    pacing.ceilings = true;
    variants.push({ name: "ceilings", requires: ["planCeilingsV1"], transfer: withCeilings.transfer });
  }

  if (suppliedRecord !== undefined) {
    const length = segmentLengthMeters(input.segment);
    const problems = validateSegmentRecord(suppliedRecord, {
      segmentFingerprint: input.segment.fingerprint,
      ...(length === undefined ? {} : { segmentLengthMeters: length }),
    });
    if (problems.length > 0) {
      pacing.recordOmitted = "invalid_record";
    } else {
      if (pacing.ceilings) {
        const full = await buildDirectTransfer({ ...shared, receiverCapabilities: advertisementFor(["planCeilingsV1", "segmentRecordV1"]), record: suppliedRecord as object });
        if (full.ok) variants.push({ name: "full", requires: ["planCeilingsV1", "segmentRecordV1"], transfer: full.transfer });
      }
      const recordOnly = await buildDirectTransfer({ ...shared, receiverCapabilities: advertisementFor(["segmentRecordV1"]), record: suppliedRecord as object });
      if (recordOnly.ok) variants.push({ name: "record", requires: ["segmentRecordV1"], transfer: recordOnly.transfer });
      if (variants.some((variant) => variant.transfer.recordBytes !== undefined)) pacing.record = true;
      else pacing.recordOmitted = "manifest_too_large";
    }
  }

  variants.sort((a, b) => b.requires.length - a.requires.length);
  variants.push({ name: "baseline", requires: [], transfer: baseline.transfer });
  return { ok: true, offer: { transferId: input.transferId, variants, pacing } };
}

/**
 * Which variant a receiver gets: among the variants whose required features it advertised (and whose record fits the
 * limit it advertised), the one that carries the most; the baseline for any missing, malformed or unrecognised
 * advertisement. Mirrors `TransferSession.chooseVariant` in the native module, which makes the real choice.
 */
export function chooseVariant(variants: OfferVariant[], advertisement: unknown): OfferVariant {
  const capabilities = parseReceiverCapabilities(advertisement);
  let best: OfferVariant | undefined;
  for (const variant of variants) {
    const usable =
      capabilities === undefined
        ? variant.requires.length === 0
        : variant.requires.every((feature) => capabilities.features.includes(feature)) && (variant.transfer.recordBytes?.length ?? 0) <= capabilities.maxRecordBytes;
    if (usable && (best === undefined || variant.requires.length > best.requires.length)) best = variant;
  }
  return best ?? variants[variants.length - 1]!;
}

/**
 * The JSON the native module's `startTransferVariants` takes (see `TransferOffer` in TransferSession.swift). Resources are
 * pooled by their SHA-256 so the segment and rider bytes, which every variant shares, cross the bridge once. Contains
 * the transfer's bytes: never log it.
 */
export function toNativeOfferConfig(offer: DirectTransferOffer, advertiseMs: number): string {
  const pool: Record<string, string> = {};
  const poolName = (sha256: string, bytes: Uint8Array): string => {
    if (pool[sha256] === undefined) pool[sha256] = bytesToBase64(bytes);
    return sha256;
  };
  const variants = offer.variants.map((variant) => {
    const { transfer } = variant;
    const resources: Record<string, string> = {
      plan: poolName(transfer.manifest.plan.sha256, transfer.planBytes),
      segment: poolName(transfer.manifest.segment.sha256, transfer.segmentBytes),
    };
    if (transfer.riderBytes !== undefined && transfer.manifest.rider !== undefined) resources.rider = poolName(transfer.manifest.rider.sha256, transfer.riderBytes);
    if (transfer.recordBytes !== undefined && transfer.manifest.record !== undefined) resources.record = poolName(transfer.manifest.record.sha256, transfer.recordBytes);
    return { name: variant.name, requires: variant.requires, manifest: transfer.manifestJson, resources };
  });
  return JSON.stringify({ advertiseMs, resources: pool, variants });
}
