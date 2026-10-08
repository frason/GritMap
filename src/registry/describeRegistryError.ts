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
