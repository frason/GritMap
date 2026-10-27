import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FTP_HINT_SHORT,
  KAROO_ADDRESS_EXAMPLE,
  KAROO_SEND_SCREEN_STEPS,
  KAROO_BLUETOOTH_WINDOW_MINUTES,
  KAROO_INBOX,
  KAROO_MIN_VERSION_CODE,
  KAROO_MIN_VERSION_NAME,
  KAROO_RECEIVE_SCREEN,
  KAROO_RECEIVE_WINDOW_MINUTES,
  KAROO_STEPS,
  KAROO_WIFI_RECEIVE,
  OLDER_KAROO_HINT,
  KAROO_APK_URL,
  KAROO_SIDELOAD_GUIDE_URL,
  KAROO_UPDATE_LINKS,
  onboardingStepLabel,
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
  FTP_HINT_SHORT,
  OLDER_KAROO_HINT,
];

describe("onboarding copy", () => {
  it("walks welcome, numbers, segments in that order; the Karoo is a Home checklist item, not a step", () => {
    assert.deepEqual(ONBOARDING_STEPS.map((step) => step.key), ["welcome", "numbers", "segments"]);
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
    // Wi-Fi is only a pointer to the fallback in the first step, never part of the Bluetooth steps themselves.
    assert.doesNotMatch(KAROO_STEPS.slice(1).map((step) => `${step.title} ${step.body}`).join(" "), /Wi-Fi|address/);
    assert.doesNotMatch(KAROO_STEPS[0]!.title, /Wi-Fi|address/);
    assert.match(OLDER_KAROO_HINT, /Wi-Fi/);
  });

  it("names the first Karoo build that can receive over Bluetooth (0.10.45, version code 73) in the steps and the hint", () => {
    assert.equal(KAROO_MIN_VERSION_NAME, "0.10.45");
    assert.equal(KAROO_MIN_VERSION_CODE, 73);
    const steps = KAROO_STEPS.map((step) => step.title).join(" ");
    assert.ok(steps.includes(`${KAROO_MIN_VERSION_NAME} (version code ${KAROO_MIN_VERSION_CODE}) or newer`));
    assert.ok(OLDER_KAROO_HINT.includes(`${KAROO_MIN_VERSION_NAME} (version code ${KAROO_MIN_VERSION_CODE}) or newer`));
  });

  it("on the Send to Karoo screen the third step does not tell the rider to open a segment (they are already there)", () => {
    assert.equal(KAROO_SEND_SCREEN_STEPS.length, KAROO_STEPS.length);
    assert.equal(KAROO_SEND_SCREEN_STEPS[2]!.title, "On your phone, tap Start Bluetooth send");
    assert.doesNotMatch(KAROO_SEND_SCREEN_STEPS.map((step) => step.title).join(" "), /open a segment/);
    assert.equal(KAROO_SEND_SCREEN_STEPS[0], KAROO_STEPS[0]);
  });

  it("keeps the FTP hint to one short sentence pair and the Wi-Fi address step free of 'box below'", () => {
    assert.ok(FTP_HINT_SHORT.length <= 100, String(FTP_HINT_SHORT.length));
    assert.doesNotMatch(WIFI_FALLBACK_STEPS.map((step) => `${step.title} ${step.body}`).join(" "), /box below/);
  });

  it("says plainly what a rider needs: Karoo 3, power meter, heart-rate monitor", () => {
    const items = WHAT_YOU_NEED.items.join(" ");
    assert.match(items, /Karoo 3/);
    assert.match(items, /power meter/);
    assert.match(items, /heart-rate monitor/);
    assert.ok(!("intro" in WHAT_YOU_NEED), "the card heading already says what it is; no second lead-in line");
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

describe("onboardingStepLabel", () => {
  it("counts from 1 and always uses the real number of steps", () => {
    assert.equal(ONBOARDING_STEPS.length, 3);
    assert.equal(onboardingStepLabel(0), "Step 1 of 3");
    assert.equal(onboardingStepLabel(2), "Step 3 of 3");
  });
});

describe("Karoo update links", () => {
  it("point at the latest APK and Hammerhead's sideloading guide, and sit under the first step", () => {
    assert.equal(KAROO_APK_URL, "https://github.com/frason/GritMap/releases/latest/download/gritmap-karoo.apk");
    assert.equal(KAROO_SIDELOAD_GUIDE_URL, "https://support.hammerhead.io/hc/en-us/articles/31576497036827-Companion-App-Sideloading");
    assert.deepEqual(KAROO_STEPS[0]!.links, KAROO_UPDATE_LINKS);
    assert.deepEqual(KAROO_UPDATE_LINKS.map((link) => link.url), [KAROO_APK_URL, KAROO_SIDELOAD_GUIDE_URL]);
  });

  it("says the APK goes onto the Karoo through the Hammerhead Companion app, not the iPhone", () => {
    assert.match(KAROO_STEPS[0]!.body, /Hammerhead Companion app, not on this iPhone/);
  });
});
