import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { karooTransferEndpoint } from "./karooTransferEndpoint.ts";

describe("karooTransferEndpoint", () => {
  it("accepts an IP and supplies the transfer port and path", () => {
    assert.equal(karooTransferEndpoint("192.168.7.32"), "http://192.168.7.32:8734/transfer");
  });

  it("accepts an IP and explicit port", () => {
    assert.equal(karooTransferEndpoint("192.168.7.32:8734"), "http://192.168.7.32:8734/transfer");
  });

  it("accepts the complete URL displayed by the Karoo without duplicating it", () => {
    assert.equal(
      karooTransferEndpoint(" http://192.168.7.32:8734/transfer "),
      "http://192.168.7.32:8734/transfer",
    );
  });

  it("replaces an unrelated path with the transfer endpoint", () => {
    assert.equal(karooTransferEndpoint("http://192.168.7.32:8734/foo"), "http://192.168.7.32:8734/transfer");
  });

  it("rejects an empty or non-http address", () => {
    assert.throws(() => karooTransferEndpoint(""), /Enter the Karoo address/);
    assert.throws(() => karooTransferEndpoint("https://192.168.7.32"), /must use http/);
  });
});
