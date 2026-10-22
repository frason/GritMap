import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { describeStagedGoal, suggestNextGoalMs } from "./describeStagedGoal.ts";

const ms = (minutes: number, seconds = 0) => (minutes * 60 + seconds) * 1_000;

describe("suggestNextGoalMs", () => {
  it("beats the best by about 1%, rounded down to 5 seconds", () => {
    assert.equal(suggestNextGoalMs(ms(40, 27)), ms(40, 0));
    assert.equal(suggestNextGoalMs(ms(40, 52)), ms(40, 25));
    assert.equal(suggestNextGoalMs(ms(10, 0)), ms(9, 50));
  });

  it("is always at least 5 seconds faster than the best, even for a very short effort", () => {
    assert.equal(suggestNextGoalMs(ms(0, 30)), ms(0, 25));
    assert.ok(suggestNextGoalMs(ms(0, 6)) < ms(0, 6));
  });
});

describe("describeStagedGoal", () => {
  it("says nothing without a best effort (a rider with no history sees a single goal)", () => {
    assert.deepEqual(describeStagedGoal({ nextGoalMs: ms(40), longTermMs: ms(38) }), {});
  });

  it("gives a progress line to the long-term goal", () => {
    const lines = describeStagedGoal({ bestMs: ms(40, 27), nextGoalMs: ms(40), longTermMs: ms(38) });
    assert.equal(lines.progress, "2:27 to go to your 38:00 goal. Your best is 40:27.");
    assert.equal(lines.reached, undefined);
  });

  it("has no progress line without a long-term goal", () => {
    assert.equal(describeStagedGoal({ bestMs: ms(40, 27), nextGoalMs: ms(40) }).progress, undefined);
  });

  it("notes when the next goal is reached and offers the next step", () => {
    const lines = describeStagedGoal({ bestMs: ms(40, 52), nextGoalMs: ms(41, 10), longTermMs: ms(38) });
    assert.equal(lines.reached, "You reached your 41:10 goal with a 40:52.");
    assert.equal(lines.suggestedNextGoalMs, ms(40, 25));
  });

  it("offers the long-term goal itself when the next step would be faster than it", () => {
    const lines = describeStagedGoal({ bestMs: ms(39, 20), nextGoalMs: ms(39, 30), longTermMs: ms(39, 15) });
    assert.equal(lines.suggestedNextGoalMs, ms(39, 15));
  });

  it("congratulates and offers nothing more once the long-term goal is reached", () => {
    const lines = describeStagedGoal({ bestMs: ms(37, 50), nextGoalMs: ms(38), longTermMs: ms(38) });
    assert.match(lines.progress ?? "", /reached your long-term goal of 38:00/);
    assert.equal(lines.suggestedNextGoalMs, undefined);
  });

  it("works for a single goal that has been reached (no long-term goal)", () => {
    const lines = describeStagedGoal({ bestMs: ms(39, 50), nextGoalMs: ms(40) });
    assert.equal(lines.reached, "You reached your 40:00 goal with a 39:50.");
    assert.equal(lines.suggestedNextGoalMs, ms(39, 25));
  });
});
