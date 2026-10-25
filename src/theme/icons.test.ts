import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";

import { iconGlyphFor, iconGlyphs } from "./icons.ts";

const require = createRequire(import.meta.url);
const ionicons = require("@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json") as Record<string, number>;

describe("icon names", () => {
  it("every semantic name maps to a glyph that exists in the icon font", () => {
    for (const [name, glyph] of Object.entries(iconGlyphs)) assert.ok(glyph in ionicons, `${name} -> ${glyph}`);
  });

  it("looks a glyph up by name", () => {
    assert.equal(iconGlyphFor("chevronRight"), "chevron-forward");
    assert.equal(iconGlyphFor("bolt"), "flash-outline");
  });

  it("covers the icons the tab bar, header icon bars and plan screens use", () => {
    for (const name of ["home", "route", "mapPin", "plus", "search", "settings", "filter", "bluetooth", "bolt", "heart", "trophy", "swap", "info", "close", "check"]) {
      assert.ok(name in iconGlyphs, name);
    }
  });
});
