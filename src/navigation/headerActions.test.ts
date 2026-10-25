import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EXPLORE_TARGET, HEADER_LABELS, HOME_ADD_ACTIONS, IMPORT_RIDES_TARGET, SEGMENTS_ADD_ACTIONS, SETTINGS_TARGET, type MenuAction } from "./headerActions.ts";
import { navigateToTarget } from "./navigateToTarget.ts";
import { navigationColors } from "./navigationTheme.ts";
import { AI_DOCK_BUTTON_SIZE, AI_DOCK_ENABLED, AI_DOCK_TAB_BAR_CLEARANCE } from "./aiDock.ts";
import { darkColors, lightColors } from "../theme/colors.ts";

const MENUS: [string, readonly MenuAction[]][] = [
  ["home", HOME_ADD_ACTIONS],
  ["segments", SEGMENTS_ADD_ACTIONS],
];

describe("header menus", () => {
  for (const [name, actions] of MENUS) {
    it(`${name}: every action has a unique id and plain-language label`, () => {
      assert.equal(new Set(actions.map((action) => action.id)).size, actions.length);
      for (const action of actions) {
        assert.ok(action.label.trim().length > 0);
        assert.ok(action.label.length <= 28, `${action.label} is long for an action sheet`);
        assert.doesNotMatch(action.label, /fingerprint|corridor|coverage|json/i);
      }
    });
  }

  it("lets a rider make a segment from a ride from either plus", () => {
    for (const [, actions] of MENUS) assert.ok(actions.some((action) => action.id === "new-segment-from-ride"));
  });

  it("names the header buttons for VoiceOver", () => {
    for (const label of Object.values(HEADER_LABELS)) assert.ok(label.length > 0);
  });
});

describe("navigateToTarget", () => {
  const calls: unknown[][] = [];
  const nav = { navigate: (...args: unknown[]) => void calls.push(args) };

  it("goes to a tab when no screen is named", () => {
    calls.length = 0;
    navigateToTarget(nav as never, { tab: "HomeTab" });
    assert.deepEqual(calls, [["HomeTab"]]);
  });

  it("goes to a screen inside a tab, keeping the tab's own root underneath", () => {
    calls.length = 0;
    navigateToTarget(nav as never, EXPLORE_TARGET);
    navigateToTarget(nav as never, IMPORT_RIDES_TARGET);
    navigateToTarget(nav as never, SETTINGS_TARGET);
    assert.deepEqual(calls, [
      ["SegmentsTab", { screen: "RegistryBrowse", initial: false }],
      ["RidesTab", { screen: "Import", initial: false }],
      ["SegmentsTab", { screen: "ZonesSettings", initial: false }],
    ]);
  });
});

describe("navigationColors", () => {
  it("draws the tab bar, headers and back buttons from the tokens, in both palettes", () => {
    for (const palette of [lightColors, darkColors]) {
      const colors = navigationColors(palette);
      assert.equal(colors.primary, palette.ctaText);
      assert.equal(colors.background, palette.background);
      assert.equal(colors.card, palette.surface);
      assert.equal(colors.text, palette.textPrimary);
      assert.equal(colors.border, palette.border);
    }
  });
});

describe("AI dock reservation", () => {
  it("is not built yet, but its tab-bar button is a 44 pt target with room around it", () => {
    assert.equal(AI_DOCK_ENABLED, false);
    assert.ok(AI_DOCK_BUTTON_SIZE >= 44);
    assert.ok(AI_DOCK_TAB_BAR_CLEARANCE > AI_DOCK_BUTTON_SIZE);
  });
});
