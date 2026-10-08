import { readFile } from "node:fs/promises";

import {
  analyzePostRide,
  decodeRrArtifact,
  formatPostRideAnalysis,
  parseDiagnosticLog,
} from "../src/diagnostics/postRideAnalysis.ts";
import { parseFitFile } from "../src/fit/parseFitFile.ts";

const args = process.argv.slice(2);
const fitPath = valueAfter("--fit");
const logPath = valueAfter("--log");
const rrPaths = valuesAfter("--rr");
if (!fitPath || !logPath || rrPaths.length === 0) {
  throw new Error("Usage: npm run analyze:karoo-ride -- --fit ride.fit --log live-segment.log --rr capture.rr [more.rr]");
}

const [fitBytes, logText, ...rrBytes] = await Promise.all([
  readFile(fitPath),
  readFile(logPath, "utf8"),
  ...rrPaths.map((path) => readFile(path)),
]);
const analysis = analyzePostRide(
  parseFitFile(fitBytes),
  rrBytes.map((bytes) => decodeRrArtifact(bytes)),
  parseDiagnosticLog(logText),
);
console.log(formatPostRideAnalysis(analysis));
console.log("\n## Machine-readable JSON\n");
console.log(JSON.stringify(analysis, null, 2));

function valueAfter(flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index < 0 ? undefined : args[index + 1];
}

function valuesAfter(flag: string): string[] {
  const index = args.indexOf(flag);
  if (index < 0) return [];
  const values: string[] = [];
  for (let cursor = index + 1; cursor < args.length && !args[cursor]!.startsWith("--"); cursor += 1) {
    values.push(args[cursor]!);
  }
  return values;
}
