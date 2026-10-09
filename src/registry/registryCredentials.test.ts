import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";

const store = new Map<string, string>();
mock.module("expo-secure-store", {
  namedExports: {
    getItemAsync: async (key: string) => store.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => void store.set(key, value),
    deleteItemAsync: async (key: string) => void store.delete(key),
  },
});

const { clearRegistryToken, getRegistryToken, setRegistryToken } = await import("./registryCredentials.ts");

describe("registry token storage", () => {
  beforeEach(() => store.clear());

  it("has no token until one is saved", async () => {
    assert.equal(await getRegistryToken(), undefined);
  });

  it("saves a token and reads it back", async () => {
    await setRegistryToken("tok_abc");
    assert.equal(await getRegistryToken(), "tok_abc");
  });

  it("removes a saved token, returning to the no-token state, and removing again is harmless", async () => {
    await setRegistryToken("tok_abc");
    await clearRegistryToken();
    assert.equal(await getRegistryToken(), undefined);
    assert.equal(store.size, 0);
    await clearRegistryToken();
    assert.equal(await getRegistryToken(), undefined);
  });
});
