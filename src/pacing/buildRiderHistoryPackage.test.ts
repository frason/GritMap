import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildRiderHistoryPackage } from "./buildRiderHistoryPackage.ts";

describe("buildRiderHistoryPackage", () => {
  it("emits exactly the key set apps/karoo's RiderHistoryJsonParser.parse() expects", () => {
    const pkg = buildRiderHistoryPackage({ ftpWatts: 280, weightKg: 75.5 }) as Record<string, unknown>;
    assert.deepEqual(new Set(Object.keys(pkg)), new Set(["schemaVersion", "profile", "trainingLoads", "samples"]));
    assert.deepEqual(new Set(Object.keys(pkg.profile as object)), new Set(["ftpWatts", "weightKg"]));
    assert.deepEqual(pkg.trainingLoads, []);
    assert.deepEqual(pkg.samples, []);
  });

  it("includes maxHeartRateBpm when given, omits it when not", () => {
    const withHr = buildRiderHistoryPackage({ ftpWatts: 280, weightKg: 75.5, maxHeartRateBpm: 178 }) as {
      profile: Record<string, unknown>;
    };
    assert.equal(withHr.profile.maxHeartRateBpm, 178);

    const withoutHr = buildRiderHistoryPackage({ ftpWatts: 280, weightKg: 75.5 }) as {
      profile: Record<string, unknown>;
    };
    assert.ok(!("maxHeartRateBpm" in withoutHr.profile));
  });

  it("rounds ftpWatts and maxHeartRateBpm to whole numbers", () => {
    const pkg = buildRiderHistoryPackage({ ftpWatts: 279.6, weightKg: 75.5, maxHeartRateBpm: 177.8 }) as {
      profile: { ftpWatts: number; maxHeartRateBpm: number };
    };
    assert.ok(Number.isInteger(pkg.profile.ftpWatts));
    assert.ok(Number.isInteger(pkg.profile.maxHeartRateBpm));
  });

  it("preserves a fractional weightKg exactly", () => {
    const pkg = buildRiderHistoryPackage({ ftpWatts: 280, weightKg: 75.5 }) as { profile: { weightKg: number } };
    assert.equal(pkg.profile.weightKg, 75.5);
  });

  it("throws for a non-positive or non-finite ftpWatts or weightKg", () => {
    assert.throws(() => buildRiderHistoryPackage({ ftpWatts: 0, weightKg: 75.5 }), RangeError);
    assert.throws(() => buildRiderHistoryPackage({ ftpWatts: 280, weightKg: 0 }), RangeError);
    assert.throws(() => buildRiderHistoryPackage({ ftpWatts: 280, weightKg: -5 }), RangeError);
    assert.throws(() => buildRiderHistoryPackage({ ftpWatts: 280, weightKg: Number.NaN }), RangeError);
  });
});
