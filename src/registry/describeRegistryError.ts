/** Rider-facing wording for a failed Open Segments request; never a status code or a raw network error. */
export function describeRegistryError(input: { statusCode?: number; message?: string }): string {
  if (input.statusCode === 403 || input.statusCode === 429) {
    return "Open Segments is busy right now. Please try again in a few minutes.";
  }
  if (input.statusCode !== undefined && input.statusCode >= 500) {
    return "Open Segments is having a problem on its side. Please try again later.";
  }
  if (input.statusCode === undefined) {
    return "Couldn't reach Open Segments. Check your internet connection and try again.";
  }
  return "Couldn't load Open Segments. Please try again.";
}

export type RegistryErrorKind = "offline" | "busy" | "server" | "other";

/** Which of the failures above it is, so a screen can pick a fitting title and icon. */
export function registryErrorKind(input: { statusCode?: number }): RegistryErrorKind {
  if (input.statusCode === undefined) return "offline";
  if (input.statusCode === 403 || input.statusCode === 429) return "busy";
  if (input.statusCode >= 500) return "server";
  return "other";
}

/** Rider-facing wording for a failed attempt to share a segment; never a status code or the server's own message. */
export function describePublishError(input: { statusCode?: number }): string {
  if (input.statusCode === undefined) return "Couldn't reach Open Segments. Check your internet connection and try again.";
  if (input.statusCode === 401) return "GitHub did not accept that token. Check it is correct and has not expired.";
  if (input.statusCode === 403 || input.statusCode === 404) {
    return "That token is not allowed to add segments. It needs permission to write to the Open Segments repository.";
  }
  if (input.statusCode === 429 || input.statusCode >= 500) return "Open Segments is busy or having a problem. Please try again in a few minutes.";
  return "The segment couldn't be shared. Please try again.";
}
