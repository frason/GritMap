import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { classifyHeartRateZone, classifyPowerZone } from "./classifyZone.ts";

describe("classifyPowerZone", () => {
  const FTP = 250;

  it("returns undefined when no FTP is set", () => {
    assert.equal(classifyPowerZone(200, undefined), undefined);
  });

  it("classifies each zone at a representative %FTP", () => {
    assert.equal(classifyPowerZone(FTP * 0.5, FTP), 1); // 50% -> Active Recovery
    assert.equal(classifyPowerZone(FTP * 0.65, FTP), 2); // 65% -> Endurance
    assert.equal(classifyPowerZone(FTP * 0.85, FTP), 3); // 85% -> Tempo
    assert.equal(classifyPowerZone(FTP * 1.0, FTP), 4); // 100% -> Lactate Threshold
    assert.equal(classifyPowerZone(FTP * 1.15, FTP), 5); // 115% -> VO2max
    assert.equal(classifyPowerZone(FTP * 1.4, FTP), 6); // 140% -> Anaerobic Capacity
    assert.equal(classifyPowerZone(FTP * 1.6, FTP), 7); // 160% -> Neuromuscular
  });

  it("treats zone boundaries as lower-bound inclusive", () => {
    assert.equal(classifyPowerZone(FTP * 0.55, FTP), 2);
    assert.equal(classifyPowerZone(FTP * 0.5499, FTP), 1);
  });

  it("returns undefined for a non-positive or non-finite FTP", () => {
    assert.equal(classifyPowerZone(200, 0), undefined);
    assert.equal(classifyPowerZone(200, -50), undefined);
    assert.equal(classifyPowerZone(200, Number.NaN), undefined);
  });
});

describe("classifyHeartRateZone", () => {
  const MAX_HR = 190;

  it("returns undefined when no max heart rate is set", () => {
    assert.equal(classifyHeartRateZone(150, undefined), undefined);
  });

  it("classifies each zone at a representative %max-HR", () => {
    assert.equal(classifyHeartRateZone(MAX_HR * 0.55, MAX_HR), 1);
    assert.equal(classifyHeartRateZone(MAX_HR * 0.65, MAX_HR), 2);
    assert.equal(classifyHeartRateZone(MAX_HR * 0.75, MAX_HR), 3);
    assert.equal(classifyHeartRateZone(MAX_HR * 0.85, MAX_HR), 4);
    assert.equal(classifyHeartRateZone(MAX_HR * 0.95, MAX_HR), 5);
  });

  it("treats zone boundaries as lower-bound inclusive", () => {
    assert.equal(classifyHeartRateZone(MAX_HR * 0.6, MAX_HR), 2);
    assert.equal(classifyHeartRateZone(MAX_HR * 0.5999, MAX_HR), 1);
  });

  it("returns undefined for a non-positive or non-finite max heart rate", () => {
    assert.equal(classifyHeartRateZone(150, 0), undefined);
    assert.equal(classifyHeartRateZone(150, Number.NaN), undefined);
  });
});
