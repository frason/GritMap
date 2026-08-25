import type { SegmentDetail } from "../db/getSegmentDetail.ts";
import { toPortableSegmentJson } from "../segments/toPortableSegmentJson.ts";

export interface SendSegmentResult {
  ok: boolean;
  statusCode?: number;
  message?: string;
}

/**
 * Posts a segment to the Karoo's local HTTP receiver (apps/karoo's HttpSegmentInbox.kt) --
 * the phone and Karoo must be on the same WiFi network, and the Karoo must have "Receive
 * from Phone" active (a user-initiated, one-shot listener, not a persistent server). Uses the
 * same toPortableSegmentJson() output already verified byte-for-byte against Karoo's real
 * SegmentJsonParser.kt in the segment-definition increment.
 */
export async function sendSegmentToKaroo(
  segment: SegmentDetail,
  hostAndPort: string,
): Promise<SendSegmentResult> {
  const json = toPortableSegmentJson({
    id: segment.segmentId,
    name: segment.name,
    schemaVersion: segment.schemaVersion,
    corridorMeters: segment.corridorMeters,
    requiredCoveragePct: segment.requiredCoveragePct,
    fingerprint: segment.fingerprint,
    referencePolyline: segment.referencePolyline,
  });

  try {
    const response = await fetch(`http://${hostAndPort}/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(json),
    });
    return { ok: response.ok, statusCode: response.status };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
