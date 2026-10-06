import { getAppSetting, setAppSetting, type AppSettingsDatabase } from "../db/appSettings.ts";
import { karooTransferEndpoint } from "./karooTransferEndpoint.ts";

const KAROO_ADDRESS_KEY = "karoo_address";

/** The last Karoo address that accepted a transfer, in the short "host:port" form, or undefined. */
export function getSavedKarooAddress(database: AppSettingsDatabase): string | undefined {
  return getAppSetting(database, KAROO_ADDRESS_KEY);
}

/**
 * Remembers an address after a transfer to it succeeded (never before -- a typo must not
 * overwrite a good one). Whatever the rider typed (IP, IP:port, or the full URL the Karoo
 * shows) is reduced to the canonical "host:port" through the same parser the send uses.
 * Returns the stored form.
 */
export function saveKarooAddress(database: AppSettingsDatabase, input: string, nowMs: number): string {
  const hostAndPort = new URL(karooTransferEndpoint(input)).host;
  setAppSetting(database, KAROO_ADDRESS_KEY, hostAndPort, nowMs);
  return hostAndPort;
}
