import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildGuidancePackage, segmentFingerprint } from "./build_guidance_package.mjs";

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));

test("fingerprint agrees with the existing validated Relize segment", async () => {
  const transfer = await readJson("../samples/Relize.6m54.guidance-package.json");
  assert.equal(segmentFingerprint(transfer.segment), transfer.segment.fingerprint);
});

test("Diablo plan scales contiguously to the authoritative segment length", async () => {
  const plan = await readJson("../samples/Diablo.Northgate-to-Junction.40m30.plan.json");
  const segment = {
    schemaVersion: 1,
    id: "diablo-test",
    name: "Diablo Northgate to Junction",
    direction: "forward",
    matching: { corridorMeters: 30, requiredCoveragePct: 0.9 },
    referencePolyline: [
      { lat: 37.1, lng: -121.9, distanceMeters: 0, elevationMeters: 300 },
      { lat: 37.2, lng: -121.8, distanceMeters: 10400, elevationMeters: 850 },
    ],
  };
  const result = buildGuidancePackage(segment, plan, 1234);
  const zones = result.baselinePacingPlan.zones;

  assert.equal(result.baselinePacingPlan.targetFinishTimeSeconds, 2430);
  assert.equal(result.riderHistory.profile.ftpWatts, 280);
  assert.equal(result.riderHistory.profile.maxHeartRateBpm, 178);
  assert.equal(zones.length, 26);
  assert.equal(zones[0].startDistanceMeters, 0);
  assert.equal(zones.at(-1).endDistanceMeters, 10400);
  assert.equal(zones.at(-1).targetPowerWatts, 295);
  assert.equal(zones.at(-1).classification, "PUSH");
  zones.slice(1).forEach((zone, index) => {
    assert.equal(zone.startDistanceMeters, zones[index].endDistanceMeters);
  });
});
