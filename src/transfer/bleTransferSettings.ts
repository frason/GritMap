import { getAppSetting, type AppSettingsDatabase } from "../db/appSettings.ts";

/**
 * Hidden kill switch (`app_settings`, no UI): set to "1" to hide Bluetooth sending and show only the Wi-Fi route. Bluetooth is
 * the main way to send in every build (docs/GOALS.md, decided 2026-10-23); this exists only so a bad Bluetooth problem in the field
 * can be worked around on one device without a new build.
 */
export const BLE_TRANSFER_DISABLED_KEY = "ble_transfer_disabled";

/** Whether Bluetooth sending is offered. On unless the hidden kill switch is set. */
export function isBleTransferEnabled(database: AppSettingsDatabase): boolean {
  return getAppSetting(database, BLE_TRANSFER_DISABLED_KEY) !== "1";
}
