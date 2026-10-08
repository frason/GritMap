export type WeightUnit = "kg" | "lb";

export const KG_PER_LB = 0.45359237;

export const FTP_MIN_WATTS = 40;
export const FTP_MAX_WATTS = 700;
const WEIGHT_MIN_KG = 30;
const WEIGHT_MAX_KG = 250;

export type ParsedNumber<T> = { ok: true; value: T } | { ok: false; error: string };

/** Accepts "250", " 250 ", "250 W"; rejects fractions and anything implausible. */
export function parseFtpInput(input: string): ParsedNumber<number> {
  const cleaned = input.trim().replace(/\s*w(atts)?$/i, "");
  if (cleaned.length === 0) return { ok: false, error: "Enter your FTP in watts, for example 250." };
  if (!/^\d+$/.test(cleaned)) return { ok: false, error: "Enter whole watts, like 250." };
  const watts = Number(cleaned);
  if (watts < FTP_MIN_WATTS || watts > FTP_MAX_WATTS) {
    return { ok: false, error: `FTP is usually between ${FTP_MIN_WATTS} and ${FTP_MAX_WATTS} watts. Check the number.` };
  }
  return { ok: true, value: watts };
}

const MAX_HR_MIN_BPM = 100;
const MAX_HR_MAX_BPM = 230;

/** Optional: the caller treats an empty field as "not set" before calling this. */
export function parseMaxHeartRateInput(input: string): ParsedNumber<number> {
  const cleaned = input.trim().replace(/\s*bpm$/i, "");
  if (!/^\d+$/.test(cleaned)) return { ok: false, error: "Enter whole beats per minute, like 185." };
  const bpm = Number(cleaned);
  if (bpm < MAX_HR_MIN_BPM || bpm > MAX_HR_MAX_BPM) {
    return { ok: false, error: `Max heart rate is usually between ${MAX_HR_MIN_BPM} and ${MAX_HR_MAX_BPM} bpm. Check the number.` };
  }
  return { ok: true, value: bpm };
}

/**
 * Accepts "75", "75.5", "75,5" (decimal comma), in the unit the rider chose, and returns kilograms,
 * which is what the rider profile stores.
 */
export function parseWeightInput(input: string, unit: WeightUnit): ParsedNumber<number> {
  const cleaned = input.trim().replace(",", ".");
  if (cleaned.length === 0) return { ok: false, error: `Enter your weight in ${unit === "kg" ? "kilograms" : "pounds"}.` };
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return { ok: false, error: "Enter a number, like 75 or 165.5." };
  const entered = Number(cleaned);
  const kilograms = unit === "kg" ? entered : entered * KG_PER_LB;
  if (kilograms < WEIGHT_MIN_KG || kilograms > WEIGHT_MAX_KG) {
    return { ok: false, error: `That does not look right for ${unit === "kg" ? "kilograms" : "pounds"}. Check the number and unit.` };
  }
  return { ok: true, value: Math.round(kilograms * 100) / 100 };
}

/** The rider's stored kilograms in the unit they are editing in, to one decimal. */
export function kilogramsToDisplay(kilograms: number, unit: WeightUnit): string {
  const value = unit === "kg" ? kilograms : kilograms / KG_PER_LB;
  return String(Math.round(value * 10) / 10);
}

/** Countries that weigh people in pounds. Everywhere else defaults to kilograms. */
const POUND_REGIONS = new Set(["US", "LR", "MM"]);

/** The weight unit to preselect for a locale such as "en-US" or "de_DE"; the rider can always switch. */
export function defaultWeightUnit(locale: string | undefined): WeightUnit {
  const region = locale?.split(/[-_]/)[1]?.toUpperCase();
  return region !== undefined && POUND_REGIONS.has(region) ? "lb" : "kg";
}
