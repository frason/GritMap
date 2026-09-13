#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

export function segmentFingerprint(segment) {
  const matching = segment.matching;
  const lines = [
    "segment-fingerprint-v1",
    `direction=${segment.direction}`,
    `corridorMeters=${matching.corridorMeters}`,
    `requiredCoveragePct=${kotlinDouble(matching.requiredCoveragePct)}`,
    ...segment.referencePolyline.map((point) =>
      [point.lat, point.lng, point.distanceMeters, point.elevationMeters]
        .map((value) => (value == null ? "null" : kotlinDouble(value)))
        .join(","),
    ),
    "",
  ];
  return createHash("sha256").update(lines.join("\n"), "utf8").digest("hex");
}

export function buildGuidancePackage(segment, sourcePlan, createdAtMs = Date.now()) {
  validateSegment(segment);
  validateSourcePlan(sourcePlan);

  const segmentLengthMeters = segment.referencePolyline.at(-1).distanceMeters;
  const fingerprint = segmentFingerprint(segment);
  if (segment.fingerprint && segment.fingerprint.toLowerCase() !== fingerprint) {
    throw new Error("Segment fingerprint does not match its immutable geography");
  }

  const scale = segmentLengthMeters / sourcePlan.sourceDistanceMiles;
  const zones = sourcePlan.zones.map((zone, index) => ({
    startDistanceMeters: index === 0 ? 0 : round(zone.startMiles * scale),
    endDistanceMeters:
      index === sourcePlan.zones.length - 1
        ? segmentLengthMeters
        : round(zone.endMiles * scale),
    targetPowerWatts: zone.targetPowerWatts,
    classification: zone.classification,
    icon: zone.classification,
    instruction: titleCase(zone.classification),
  }));

  return {
    schemaVersion: 1,
    packageType: "gritmap-transfer",
    packageId: `${sourcePlan.planId}-${createdAtMs}`,
    createdAtMs,
    segment: { ...segment, fingerprint },
    riderHistory: {
      schemaVersion: 1,
      profile: {
        ftpWatts: sourcePlan.ftpWatts,
        weightKg: sourcePlan.weightKg,
        maxHeartRateBpm: sourcePlan.maxHeartRateBpm,
      },
      trainingLoads: [],
      samples: [],
    },
    baselinePacingPlan: {
      schemaVersion: 1,
      id: sourcePlan.planId,
      segmentFingerprint: fingerprint,
      createdAtMs,
      generator: {
        type: sourcePlan.source,
        modelVersion: sourcePlan.modelVersion,
      },
      ftpWatts: sourcePlan.ftpWatts,
      targetFinishTimeSeconds: sourcePlan.targetFinishTimeSeconds,
      zones,
    },
  };
}

function validateSegment(segment) {
  if (segment?.schemaVersion !== 1 || segment.direction !== "forward") {
    throw new Error("Expected a forward GritMap segment with schemaVersion 1");
  }
  if (!Array.isArray(segment.referencePolyline) || segment.referencePolyline.length < 2) {
    throw new Error("Segment must contain at least two reference points");
  }
  if (segment.referencePolyline[0].distanceMeters !== 0) {
    throw new Error("Segment reference distance must begin at zero");
  }
  for (let index = 1; index < segment.referencePolyline.length; index += 1) {
    if (
      segment.referencePolyline[index].distanceMeters <=
      segment.referencePolyline[index - 1].distanceMeters
    ) {
      throw new Error("Segment reference distances must increase strictly");
    }
  }
}

function validateSourcePlan(plan) {
  if (plan?.schemaVersion !== 1 || !Array.isArray(plan.zones) || plan.zones.length === 0) {
    throw new Error("Expected a non-empty source plan with schemaVersion 1");
  }
  if (!(plan.ftpWatts > 0) || !(plan.sourceDistanceMiles > 0)) {
    throw new Error("Plan FTP and source distance must be positive");
  }
  const allowed = new Set(["RECOVER", "HOLD", "PUSH"]);
  plan.zones.forEach((zone, index) => {
    const expectedStart = index === 0 ? 0 : plan.zones[index - 1].endMiles;
    if (zone.startMiles !== expectedStart || !(zone.endMiles > zone.startMiles)) {
      throw new Error(`Plan zone ${index} is not contiguous`);
    }
    if (!allowed.has(zone.classification)) {
      throw new Error(`Plan zone ${index} has an unknown classification`);
    }
    if (!(zone.targetPowerWatts >= 0 && zone.targetPowerWatts <= plan.ftpWatts * 1.5)) {
      throw new Error(`Plan zone ${index} has an unsafe target`);
    }
  });
  if (plan.zones.at(-1).endMiles !== plan.sourceDistanceMiles) {
    throw new Error("Plan zones must cover the complete source distance");
  }
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

// Kotlin's Double.toString() retains a decimal suffix for whole-number doubles.
function kotlinDouble(value) {
  return Number.isInteger(value) ? value.toFixed(1) : String(value);
}

function titleCase(value) {
  return value[0] + value.slice(1).toLowerCase();
}

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((value, index, all) =>
      value.startsWith("--") ? [value.slice(2), all[index + 1]] : ["", ""],
    ),
  );
  if (!args.segment || !args.plan || !args.output) {
    throw new Error(
      "Usage: build_guidance_package.mjs --segment segment.json --plan plan.json --output package.json",
    );
  }
  const [segment, plan] = await Promise.all(
    [args.segment, args.plan].map(async (path) => JSON.parse(await readFile(path, "utf8"))),
  );
  const output = buildGuidancePackage(segment, plan);
  await writeFile(args.output, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(
    `Wrote ${args.output}: ${output.baselinePacingPlan.zones.length} zones, ` +
      `${output.baselinePacingPlan.targetFinishTimeSeconds}s target`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
