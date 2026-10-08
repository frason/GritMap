/** Tries document-provider readers in order; some iOS providers fail only on one Expo API. */
export async function readTextWithFallback(
  readers: readonly (() => Promise<string>)[],
): Promise<string> {
  const errors: string[] = [];
  for (const read of readers) {
    try {
      return await read();
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new Error(`The selected file could not be read. ${errors.filter(Boolean).join(" | ")}`);
}
