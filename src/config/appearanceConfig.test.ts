import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * The app has a committed ios/ project (bare workflow), so EAS builds read ios/GritMap/Info.plist and ignore
 * app.json's userInterfaceStyle. If the two disagree, a build ships light-only even though the app has a dark theme.
 */
describe("appearance config", () => {
  const appJson = JSON.parse(readFileSync(new URL("../../app.json", import.meta.url), "utf8")) as { expo: { userInterfaceStyle?: string } };
  const plist = readFileSync(new URL("../../ios/GritMap/Info.plist", import.meta.url), "utf8");
  const plistStyle = /<key>UIUserInterfaceStyle<\/key>\s*<string>([^<]*)<\/string>/.exec(plist)?.[1];

  it("lets the app follow the phone's light or dark setting", () => {
    assert.equal(appJson.expo.userInterfaceStyle, "automatic");
  });

  it("the iOS Info.plist agrees with app.json (Automatic, or no key)", () => {
    assert.ok(plistStyle === undefined || plistStyle === "Automatic", `Info.plist UIUserInterfaceStyle is ${plistStyle}, app.json is automatic`);
  });
});
