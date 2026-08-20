/**
 * Formats a number to match Kotlin's `Double.toString()` on the JVM, which
 * apps/karoo's SegmentFingerprint.compute() calls directly. JS's `Number.toString()`
 * agrees on digit sequences for non-whole numbers, but drops the trailing `.0` Java always
 * keeps for whole-number doubles (`(37.0).toString()` -> `"37"` in JS, `"37.0"` in Java) --
 * verified by running both side by side, not assumed. `-0` is normalized to `0` first:
 * `Number.isInteger(-0)` is `true` in JS and `${-0}` stringifies to `"0"`, but Java's
 * `Double.toString(-0.0)` gives `"-0.0"` -- this guard keeps that asymmetry from ever
 * surfacing.
 */
export function toJavaDoubleString(value: number): string {
  const normalized = value === 0 ? 0 : value;
  return Number.isInteger(normalized) ? `${normalized}.0` : normalized.toString();
}
