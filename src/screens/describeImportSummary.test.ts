import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeImportProgress, describeImportSummary } from "./describeImportSummary.ts";

describe("describeImportProgress", () => {
  it("counts the file being worked on, never past the total", () => {
    assert.equal(describeImportProgress(0, 5), "Importing file 1 of 5…");
    assert.equal(describeImportProgress(4, 5), "Importing file 5 of 5…");
    assert.equal(describeImportProgress(5, 5), "Importing file 5 of 5…");
  });
});

describe("describeImportSummary", () => {
  it("reports a clean import as a success that says segments were checked", () => {
    const summary = describeImportSummary({ imported: 3, replaced: 0, duplicate: 0, failed: 0 });
    assert.equal(summary.tone, "success");
    assert.match(summary.text, /3 added/);
    assert.match(summary.text, /checked them against your segments/);
  });

  it("is a warning when some files failed, and says how many", () => {
    const summary = describeImportSummary({ imported: 2, replaced: 0, duplicate: 1, failed: 1 });
    assert.equal(summary.tone, "warning");
    assert.match(summary.text, /4 files handled/);
    assert.match(summary.text, /1 couldn't be read/);
  });

  it("is an error that explains the accepted formats when nothing could be read", () => {
    const one = describeImportSummary({ imported: 0, replaced: 0, duplicate: 0, failed: 1 });
    assert.equal(one.tone, "error");
    assert.match(one.text, /That file couldn't be imported/);
    const many = describeImportSummary({ imported: 0, replaced: 0, duplicate: 0, failed: 3 });
    assert.match(many.text, /None of those 3 files/);
    assert.match(many.text, /FIT and GPX/);
  });

  it("is a calm success when every file was already there", () => {
    const summary = describeImportSummary({ imported: 0, replaced: 0, duplicate: 2, failed: 0 });
    assert.equal(summary.tone, "success");
    assert.match(summary.text, /Nothing new to add: 2 already in GritMap/);
  });
});
