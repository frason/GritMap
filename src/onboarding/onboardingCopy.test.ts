import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FTP_SOURCE_NOTE,
  KAROO_ADDRESS_EXAMPLE,
  KAROO_BLUETOOTH_WINDOW_MINUTES,
  KAROO_INBOX,
  KAROO_RECEIVE_SCREEN,
  KAROO_RECEIVE_WINDOW_MINUTES,
  KAROO_STEPS,
  KAROO_WIFI_RECEIVE,
  OLDER_KAROO_HINT,
  ONBOARDING_STEPS,
  PHONE_SEND_BUTTON,
  SEGMENT_WAYS,
  WELCOME_POINTS,
  WHAT_YOU_NEED,
  WIFI_FALLBACK_STEPS,
} from "./onboardingCopy.ts";

const everyString = [
  ...WELCOME_POINTS.flatMap((point) => [point.title, point.body]),
  ...SEGMENT_WAYS.flatMap((way) => [way.title, way.body]),
  ...KAROO_STEPS.flatMap((step) => [step.title, step.body]),
  ...WIFI_FALLBACK_STEPS.flatMap((step) => [step.title, step.body]),
  ...WHAT_YOU_NEED.items,
  WHAT_YOU_NEED.body,
  FTP_SOURCE_NOTE,
  OLDER_KAROO_HINT,
];

describe("onboarding copy", () => {
  it("walks welcome, numbers, segments, Karoo in that order", () => {
    assert.deepEqual(ONBOARDING_STEPS.map((step) => step.key), ["welcome", "numbers", "segments", "karoo"]);
  });

  it("names the Karoo screens and the phone button exactly as the apps do (Karoo: GritMap, Inbox, Receive from Phone / Legacy Wi-Fi Receive)", () => {
    assert.equal(KAROO_RECEIVE_SCREEN, "Receive from Phone");
    assert.equal(KAROO_INBOX, "Inbox");
    assert.equal(KAROO_WIFI_RECEIVE, "Legacy Wi-Fi Receive");
    assert.equal(PHONE_SEND_BUTTON, "Send to Karoo");
    const bluetooth = KAROO_STEPS.map((step) => `${step.title} ${step.body}`).join(" ");
    assert.ok(bluetooth.includes(`${KAROO_INBOX}, then tap ${KAROO_RECEIVE_SCREEN}`));
    assert.ok(bluetooth.includes(`tap ${PHONE_SEND_BUTTON}`));
    assert.ok(bluetooth.includes(`${KAROO_BLUETOOTH_WINDOW_MINUTES} minutes`));
    const wifi = WIFI_FALLBACK_STEPS.map((step) => `${step.title} ${step.body}`).join(" ");
    assert.ok(wifi.includes(`tap ${KAROO_WIFI_RECEIVE}`));
    assert.ok(wifi.includes(`${KAROO_RECEIVE_WINDOW_MINUTES} minutes`));
  });

  it("leads with Bluetooth and keeps Wi-Fi as the fallback", () => {
    assert.match(KAROO_STEPS.map((step) => step.body).join(" "), /Bluetooth/);
    assert.doesNotMatch(KAROO_STEPS.map((step) => `${step.title} ${step.body}`).join(" "), /Wi-Fi|address/);
    assert.match(OLDER_KAROO_HINT, /older/);
    assert.match(OLDER_KAROO_HINT, /Wi-Fi/);
  });

  it("says plainly what a rider needs: Karoo 3, power meter, heart-rate monitor", () => {
    const items = WHAT_YOU_NEED.items.join(" ");
    assert.match(items, /Karoo 3/);
    assert.match(items, /power meter/);
    assert.match(items, /heart-rate monitor/);
    assert.equal(WHAT_YOU_NEED.intro, "GritMap needs:");
    assert.match(WHAT_YOU_NEED.body, /without a power meter/);
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
