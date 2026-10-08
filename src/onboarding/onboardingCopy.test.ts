import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  KAROO_ADDRESS_EXAMPLE,
  KAROO_RECEIVE_SCREEN,
  KAROO_RECEIVE_WINDOW_MINUTES,
  KAROO_STEPS,
  ONBOARDING_STEPS,
  PHONE_SEND_BUTTON,
  SEGMENT_WAYS,
  WELCOME_POINTS,
} from "./onboardingCopy.ts";

const everyString = [
  ...WELCOME_POINTS.flatMap((point) => [point.title, point.body]),
  ...SEGMENT_WAYS.flatMap((way) => [way.title, way.body]),
  ...KAROO_STEPS.flatMap((step) => [step.title, step.body]),
];

describe("onboarding copy", () => {
  it("walks welcome, numbers, segments, Karoo in that order", () => {
    assert.deepEqual(ONBOARDING_STEPS.map((step) => step.key), ["welcome", "numbers", "segments", "karoo"]);
  });

  it("names the Karoo screen and the phone button exactly as the apps do", () => {
    assert.equal(KAROO_RECEIVE_SCREEN, "Receive from Phone");
    assert.equal(PHONE_SEND_BUTTON, "Send plan to Karoo");
    const joined = KAROO_STEPS.map((step) => `${step.title} ${step.body}`).join(" ");
    assert.ok(joined.includes(`tap ${KAROO_RECEIVE_SCREEN}`));
    assert.ok(joined.includes(`tap ${PHONE_SEND_BUTTON}`));
    assert.ok(joined.includes(`${KAROO_RECEIVE_WINDOW_MINUTES} minutes`));
  });

  it("shows an address example that is a private-network IP with the Karoo's port", () => {
    assert.match(KAROO_ADDRESS_EXAMPLE, /^192\.168\.\d{1,3}\.\d{1,3}:8734$/);
  });

  it("uses no internal or algorithm terms, and nothing about the author's own data", () => {
    const forbidden = /corridor|fingerprint|coverage|matcher|polyline|schema|\bJSON blob\b|diablo|relize|realize|coco|jason|frason/i;
    for (const text of everyString) assert.doesNotMatch(text, forbidden, text);
  });

  it("keeps every step short enough to read on a phone", () => {
    for (const text of everyString) assert.ok(text.length <= 230, `${text.length}: ${text}`);
  });
});
