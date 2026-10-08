import { getAppSetting, setAppSetting, type AppSettingsDatabase } from "../db/appSettings.ts";

const ONBOARDING_COMPLETED_KEY = "onboarding_completed_at_ms";

export interface OnboardingDatabase extends AppSettingsDatabase {
  prepare(sql: string): {
    get(...parameters: unknown[]): unknown;
    run(...parameters: unknown[]): unknown;
  };
}

export function isOnboardingComplete(database: OnboardingDatabase): boolean {
  return getAppSetting(database, ONBOARDING_COMPLETED_KEY) !== undefined;
}

export function markOnboardingComplete(database: OnboardingDatabase, nowMs: number): void {
  setAppSetting(database, ONBOARDING_COMPLETED_KEY, String(nowMs), nowMs);
}

/**
 * Whether to show first-run onboarding on launch. Only an install with nothing in it gets it: a
 * flag from a previous run, or any ride, segment or saved FTP, means this is an existing install
 * (every user from before onboarding existed), who is marked complete and never shown a tour of an
 * app they already use.
 */
export function resolveOnboarding(database: OnboardingDatabase, nowMs: number): "show" | "skip" {
  if (isOnboardingComplete(database)) return "skip";
  if (hasAnyData(database)) {
    markOnboardingComplete(database, nowMs);
    return "skip";
  }
  return "show";
}

function hasAnyData(database: OnboardingDatabase): boolean {
  for (const sql of [
    "SELECT 1 AS present FROM rides LIMIT 1",
    "SELECT 1 AS present FROM segments LIMIT 1",
    "SELECT 1 AS present FROM athlete_profile WHERE ftp_watts IS NOT NULL LIMIT 1",
  ]) {
    const row = database.prepare(sql).get();
    // expo-sqlite returns null for no row; node:sqlite returns undefined.
    if (row !== undefined && row !== null) return true;
  }
  return false;
}
