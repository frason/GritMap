import type { SendSegmentResult } from "./sendSegmentToKaroo.ts";

/**
 * One wording for every "send to Karoo" outcome. A 200 only means the Karoo received the
 * bytes -- import (and any rejection) happens afterwards and is shown on the Karoo.
 * An unreachable Karoo is by far the most common failure, and almost always means the
 * address changed (the Karoo's IP comes from the router) or its receive screen isn't open,
 * so say that instead of the raw network error.
 */
export function describeSendResult(result: SendSegmentResult, address: string): string {
  if (result.ok) return "Sent — check the Karoo screen to confirm it imported";
  if (result.unreachable === true) {
    return `Couldn't reach ${address.trim() || "the Karoo"}. Is the Karoo on the "Receive from Phone" screen and on the same Wi-Fi? Its address may have changed — check what it shows.`;
  }
  const status = result.statusCode === undefined ? "" : ` (HTTP ${result.statusCode})`;
  return `Send failed${status}${result.message === undefined ? "" : `: ${result.message}`}`;
}
