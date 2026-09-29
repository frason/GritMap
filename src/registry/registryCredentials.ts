import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "gritmap.registryToken";

/**
 * A GitHub personal access token (repo scope) the user pastes in once, to publish
 * segments via registryClient.ts. Never sent anywhere but api.github.com, and only on an
 * explicit publish action -- discovery/import never needs it. Thin pass-through to
 * SecureStore, deliberately untested here for the same reason other native-module
 * wrappers in this app aren't (see e.g. expo-sqlite's bootstrap) -- there's no logic to
 * verify beyond "calls the right SecureStore function."
 */
export async function getRegistryToken(): Promise<string | undefined> {
  const value = await SecureStore.getItemAsync(TOKEN_KEY);
  return value ?? undefined;
}

export async function setRegistryToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearRegistryToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
