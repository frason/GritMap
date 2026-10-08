export const KAROO_SEND_TIMEOUT_MS = 15_000;

/**
 * React Native's fetch has no default deadline. A stale Karoo address can therefore leave the
 * screen on "Sending…" forever instead of returning an actionable connection error.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = KAROO_SEND_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
