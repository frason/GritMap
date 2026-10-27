import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { nextSetupStep, setupSteps, shouldShowSetupChecklist } from "./setupSteps.ts";

const none = { hasFtp: false, hasSegment: false, hasRide: false, hasSent: false };

describe("setup checklist", () => {
  it("lists four steps in order, none done on a new install", () => {
    const steps = setupSteps(none);
    assert.deepEqual(steps.map((s) => s.key), ["ftp", "segment", "ride", "karoo"]);
    assert.ok(steps.every((s) => !s.done));
    assert.equal(nextSetupStep(steps)?.key, "ftp");
  });
  it("marks steps done from what is in the app and moves the next step on", () => {
    const steps = setupSteps({ ...none, hasFtp: true, hasSegment: true });
    assert.deepEqual(steps.map((s) => s.done), [true, true, false, false]);
    assert.equal(nextSetupStep(steps)?.key, "ride");
  });
  it("shows until there is a segment and a ride", () => {
    assert.equal(shouldShowSetupChecklist(none), true);
    assert.equal(shouldShowSetupChecklist({ ...none, hasSegment: true }), true);
    assert.equal(shouldShowSetupChecklist({ ...none, hasSegment: true, hasRide: true }), false);
  });
  it("completes the Karoo step once a segment has been sent", () => {
    const steps = setupSteps({ ...none, hasSent: true });
    assert.equal(steps.find((s) => s.key === "karoo")?.title, "Connect your Karoo");
    assert.equal(steps.find((s) => s.key === "karoo")?.done, true);
  });
  it("is never done when everything is empty", () => {
    assert.equal(nextSetupStep(setupSteps({ hasFtp: true, hasSegment: true, hasRide: true, hasSent: true })), undefined);
  });
});
