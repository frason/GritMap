import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { describeSendResult } from "./describeSendResult.ts";

describe("describeSendResult", () => {
  it("says a 200 means received, not imported", () => {
    assert.match(describeSendResult({ ok: true, statusCode: 200 }, "1.2.3.4:8734"), /confirm it imported/);
  });

  it("explains an unreachable Karoo in terms of the likely causes, naming the address tried", () => {
    const text = describeSendResult(
      { ok: false, unreachable: true, message: "Network request failed" },
      " 192.168.7.50:8734 ",
    );
    assert.match(text, /Couldn't reach 192\.168\.7\.50:8734/);
    assert.match(text, /Receive from Phone/);
    assert.match(text, /address may have changed/);
    assert.doesNotMatch(text, /Network request failed/);
  });

  it("shows HTTP statuses and validation messages as they are", () => {
    assert.equal(describeSendResult({ ok: false, statusCode: 413 }, "x"), "Send failed (HTTP 413)");
    assert.equal(
      describeSendResult({ ok: false, message: "Invalid Karoo address" }, "x"),
      "Send failed: Invalid Karoo address",
    );
  });
});
