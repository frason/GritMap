import { getAppSetting, type AppSettingsDatabase } from "../db/appSettings.ts";

/** Development-only switch, stored on the device (`app_settings`); there is no UI to set it. */
export const DEV_BLE_TRANSFER_KEY = "dev_ble_transfer";

/**
 * Whether the "Send over Bluetooth (beta)" option is shown. Off for every rider: it is on in a
 * development client (`__DEV__`), in a local build made with EXPO_PUBLIC_GRITMAP_BLE_TRANSFER=1, or when
 * the `dev_ble_transfer` setting is "1". An EAS/TestFlight build has none of these.
 */
export function isBleTransferEnabled(database: AppSettingsDatabase, isDevBuild: boolean, buildFlag?: string): boolean {
  if (isDevBuild) return true;
  // Inlined at bundle time by Expo; must stay a literal `process.env.EXPO_PUBLIC_*`.
  if ((buildFlag ?? process.env.EXPO_PUBLIC_GRITMAP_BLE_TRANSFER) === "1") return true;
  return getAppSetting(database, DEV_BLE_TRANSFER_KEY) === "1";
}
