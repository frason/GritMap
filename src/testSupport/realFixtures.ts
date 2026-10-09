import { existsSync } from "node:fs";

/**
 * Some tests read real ride files (fixtures/fit/*.fit, fixtures/gpx/*.gpx). Those are one rider's
 * private GPS recordings, so they are local-only: git-ignored and absent from a fresh clone (see
 * fixtures/fit/README.md). A test that needs them passes `{ skip: skipUnlessPresent(paths) }` so it
 * is reported as skipped, with this message, instead of failing on a missing file.
 */
export function skipUnlessPresent(paths: readonly string[]): string | false {
  const missing = paths.filter((path) => !existsSync(path));
  if (missing.length === 0) return false;
  return `${missing.length} of ${paths.length} real ride fixtures not present (local-only, see fixtures/fit/README.md)`;
}
