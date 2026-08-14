import { Decoder, Stream } from "@garmin/fitsdk";

export const PARSER_VERSION = 1;
export const FIT_SDK_PACKAGE = "@garmin/fitsdk";
export const VALIDATED_FIT_SDK_VERSION = "21.213.0";

const SEMICIRCLES_TO_DEGREES = 180 / 2 ** 31;

export interface ParsedPoint {
  timestampMs: number;
  lat?: number;
  lng?: number;
  distanceMeters?: number;
  elevationMeters?: number;
  power?: number;
  heartRate?: number;
  cadence?: number;
  speedMetersPerSec?: number;
  temperatureCelsius?: number;
}

export interface ParsedRide {
  points: ParsedPoint[];
  deviceMetadata: Record<string, unknown>;
  originalTimezoneOffsetMinutes?: number;
}

type FitMessage = Record<string, unknown>;

interface FitMessages {
  recordMesgs?: FitMessage[];
  fileIdMesgs?: FitMessage[];
  deviceInfoMesgs?: FitMessage[];
  sessionMesgs?: FitMessage[];
  activityMesgs?: FitMessage[];
  [messageType: string]: FitMessage[] | undefined;
}

/**
 * Parses FIT bytes without performing file I/O. Garmin's SDK applies FIT profile scales
 * and offsets, yielding meters, meters/second, Celsius, and Date timestamps. Optional
 * sensor values are copied only when present so a real zero remains distinct from absent.
 */
export function parseFitFile(buffer: ArrayBuffer | Uint8Array): ParsedRide {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const exactBuffer = bytes.slice().buffer;
  const stream = Stream.fromArrayBuffer(exactBuffer);

  if (!Decoder.isFIT(stream)) {
    throw new Error("Input is not a FIT file");
  }

  const decoder = new Decoder(stream);
  if (!decoder.checkIntegrity()) {
    throw new Error("FIT file failed size or CRC integrity validation");
  }

  const { messages, errors } = decoder.read({
    applyScaleAndOffset: true,
    convertDateTimesToDates: true,
    convertTypesToStrings: true,
    expandComponents: true,
    expandSubFields: true,
    includeUnknownData: true,
    mergeHeartRates: true,
  }) as { messages: FitMessages; errors: unknown[] };

  if (errors.length > 0) {
    throw new Error(`FIT decoding failed: ${errors.map(String).join("; ")}`);
  }

  const records = messages.recordMesgs ?? [];
  const points = records.map(parseRecord);

  return {
    points,
    deviceMetadata: {
      fitSdkPackage: FIT_SDK_PACKAGE,
      fitSdkVersion: VALIDATED_FIT_SDK_VERSION,
      parserVersion: PARSER_VERSION,
      fileId: messages.fileIdMesgs?.[0],
      devices: messages.deviceInfoMesgs ?? [],
      sessions: messages.sessionMesgs ?? [],
      activities: messages.activityMesgs ?? [],
    },
    ...optional("originalTimezoneOffsetMinutes", extractTimezoneOffsetMinutes(messages)),
  };
}

function parseRecord(record: FitMessage): ParsedPoint {
  const timestampMs = toTimestampMs(record.timestamp);
  if (timestampMs === undefined) {
    throw new Error("FIT record is missing a valid timestamp");
  }

  return {
    timestampMs,
    ...optional("lat", semicirclesToDegrees(record.positionLat)),
    ...optional("lng", semicirclesToDegrees(record.positionLong)),
    ...optional("distanceMeters", finiteNumber(record.distance)),
    // Enhanced fields have greater precision and supersede their legacy equivalents.
    ...optional(
      "elevationMeters",
      finiteNumber(record.enhancedAltitude) ?? finiteNumber(record.altitude),
    ),
    ...optional("power", finiteNumber(record.power)),
    ...optional("heartRate", finiteNumber(record.heartRate)),
    ...optional("cadence", finiteNumber(record.cadence)),
    ...optional(
      "speedMetersPerSec",
      finiteNumber(record.enhancedSpeed) ?? finiteNumber(record.speed),
    ),
    ...optional("temperatureCelsius", finiteNumber(record.temperature)),
  };
}

function extractTimezoneOffsetMinutes(messages: FitMessages): number | undefined {
  for (const messageList of Object.values(messages)) {
    for (const message of messageList ?? []) {
      const utcMs = toTimestampMs(message.timestamp ?? message.utcTimestamp);
      const localMs = toTimestampMs(message.localTimestamp);
      if (utcMs !== undefined && localMs !== undefined) {
        return (localMs - utcMs) / 60_000;
      }
    }
  }
  return undefined;
}

function semicirclesToDegrees(value: unknown): number | undefined {
  const semicircles = finiteNumber(value);
  return semicircles === undefined ? undefined : semicircles * SEMICIRCLES_TO_DEGREES;
}

function toTimestampMs(value: unknown): number | undefined {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : undefined;
  }
  return undefined;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function optional<Key extends string, Value>(
  key: Key,
  value: Value | undefined,
): { [Property in Key]?: Value } {
  return value === undefined ? {} : ({ [key]: value } as { [Property in Key]: Value });
}
