import { getAppSetting, setAppSetting, type AppSettingsDatabase } from "./appSettings.ts";

/** Set when the rider has entered or saved their own FTP in the app (Profile or first-run), as opposed to a default or a placeholder. */
export const FTP_CONFIRMED_KEY = "ftp_confirmed_at_ms";

export function isFtpConfirmed(database: AppSettingsDatabase): boolean {
  return getAppSetting(database, FTP_CONFIRMED_KEY) !== undefined;
}

export function confirmFtp(database: AppSettingsDatabase, nowMs: number): void {
  setAppSetting(database, FTP_CONFIRMED_KEY, String(nowMs), nowMs);
}
