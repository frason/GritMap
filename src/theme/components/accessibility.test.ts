import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fieldAccessibilityLabel, rowAccessibilityLabel } from "./accessibility.ts";

describe("rowAccessibilityLabel", () => {
  it("joins the parts that exist", () => {
    assert.equal(rowAccessibilityLabel(["Coco Jumbo", "0.3 mi", "6 efforts"]), "Coco Jumbo, 0.3 mi, 6 efforts");
    assert.equal(rowAccessibilityLabel(["Coco Jumbo", undefined, "  "]), "Coco Jumbo");
    assert.equal(rowAccessibilityLabel([]), "");
  });
});

describe("fieldAccessibilityLabel", () => {
  it("speaks the label and unit, never just the placeholder", () => {
    assert.equal(fieldAccessibilityLabel({ label: "FTP", unit: "watts" }), "FTP, watts");
    assert.equal(fieldAccessibilityLabel({ label: "Karoo address" }), "Karoo address");
  });

  it("adds the current error so it is heard, not only seen", () => {
    assert.equal(
      fieldAccessibilityLabel({ label: "Weight", unit: "kg", error: "Enter a number above 0" }),
      "Weight, kg, Error: Enter a number above 0",
    );
  });
});
