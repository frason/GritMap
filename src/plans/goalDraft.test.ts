import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { durationToInputs, validateGoalDraft } from "./goalDraft.ts";

const empty = { minutes: "", seconds: "", longTermMinutes: "", longTermSeconds: "", removeLongTerm: false };

describe("validateGoalDraft", () => {
  it("needs a time", () => {
    assert.equal(validateGoalDraft(empty).ok, false);
  });
  it("accepts a goal alone", () => {
    assert.deepEqual(validateGoalDraft({ ...empty, minutes: "40", seconds: "0" }), { ok: true, targetDurationMs: 2_400_000 });
  });
  it("requires the long-term goal to be faster", () => {
    assert.equal(validateGoalDraft({ ...empty, minutes: "40", seconds: "0", longTermMinutes: "41", longTermSeconds: "0" }).ok, false);
    assert.deepEqual(validateGoalDraft({ ...empty, minutes: "40", seconds: "0", longTermMinutes: "39", longTermSeconds: "0" }), { ok: true, targetDurationMs: 2_400_000, longTermDurationMs: 2_340_000 });
  });
  it("removes the long-term goal only when asked and the boxes are empty", () => {
    assert.deepEqual(validateGoalDraft({ ...empty, minutes: "40", seconds: "0", removeLongTerm: true }), { ok: true, targetDurationMs: 2_400_000, longTermDurationMs: null });
  });
  it("splits a duration into box text", () => {
    assert.deepEqual(durationToInputs(2_405_000), { minutes: "40", seconds: "5" });
  });
});
