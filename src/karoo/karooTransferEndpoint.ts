const DEFAULT_KAROO_PORT = "8734";

/**
 * Accepts exactly what a rider is likely to type or paste from the Karoo screen: an IP,
 * IP:port, or the complete displayed HTTP URL. Produces one canonical transfer endpoint.
 */
export function karooTransferEndpoint(input: string): string {
  const trimmed = input.trim().replace(/\s+/g, "");
  if (trimmed.length === 0) throw new Error("Enter the Karoo address");
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("Invalid Karoo address");
  }
  if (url.protocol !== "http:") throw new Error("Karoo address must use http");
  if (!url.hostname) throw new Error("Invalid Karoo hostname");
  if (!url.port) url.port = DEFAULT_KAROO_PORT;
  url.pathname = "/transfer";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}
