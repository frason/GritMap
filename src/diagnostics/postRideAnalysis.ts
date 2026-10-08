import type { ParsedRide } from "../fit/parseFitFile.ts";

const RR_MAGIC = "GMRR";
const RR_V1_HEADER_BYTES = 16;
const RR_V1_RECORD_BYTES = 14;

export interface DecodedRrObservation {
  elapsedMs: number;
  rrIntervalMs: number;
  rrInterval1024: number;
  valid: boolean;
  reasonCode: number;
}

export interface DecodedRrArtifact {
  schemaVersion: number;
  captureStartTimestampMs: number;
  observations: DecodedRrObservation[];
  ignoredTrailingBytes: number;
}

export interface DiagnosticEvent {
  timestampMs: number;
  event: string;
  details: string;
}

export interface RrArtifactAnalysis {
  schemaVersion: number;
  sampleCount: number;
  validSampleCount: number;
  validPct: number;
  gapCount: number;
  durationSeconds: number;
  rrHeartRateBpm?: number;
  fitHeartRateBpm?: number;
  heartRateDifferenceBpm?: number;
  ignoredTrailingBytes: number;
}

export interface ApproachAnalysis {
  segmentId?: string;
  requestedAtMs: number;
  connectedAfterMs?: number;
  captureStartedAfterMs?: number;
  attemptStartedAfterMs?: number;
  retries: number;
  fallback: boolean;
}

export interface PostRideAnalysis {
  ride: {
    pointCount: number;
    startTimestampMs?: number;
    endTimestampMs?: number;
    durationSeconds?: number;
  };
  approaches: ApproachAnalysis[];
  rrArtifacts: RrArtifactAnalysis[];
  diagnosticErrors: DiagnosticEvent[];
  warnings: string[];
}

export function decodeRrArtifact(bytes: Uint8Array): DecodedRrArtifact {
  if (bytes.byteLength < RR_V1_HEADER_BYTES) throw new Error("RR artifact header is incomplete");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = String.fromCharCode(...bytes.subarray(0, 4));
  if (magic !== RR_MAGIC) throw new Error("Invalid RR artifact magic");
  const schemaVersion = view.getInt32(4, false);
  if (schemaVersion !== 1 && schemaVersion !== 2) {
    throw new Error(`Unsupported RR artifact schema ${schemaVersion}`);
  }
  const captureStartTimestampMs = Number(view.getBigInt64(8, false));
  const payloadBytes = bytes.byteLength - RR_V1_HEADER_BYTES;
  const recordCount = Math.floor(payloadBytes / RR_V1_RECORD_BYTES);
  const observations: DecodedRrObservation[] = [];
  for (let index = 0; index < recordCount; index += 1) {
    const offset = RR_V1_HEADER_BYTES + index * RR_V1_RECORD_BYTES;
    const storedInterval = view.getInt32(offset + 8, false);
    observations.push({
      elapsedMs: Number(view.getBigInt64(offset, false)),
      rrIntervalMs: schemaVersion >= 2 ? Math.round(storedInterval * 1_000 / 1_024) : storedInterval,
      rrInterval1024: schemaVersion >= 2 ? storedInterval : Math.round(storedInterval * 1_024 / 1_000),
      valid: view.getUint8(offset + 12) !== 0,
      reasonCode: view.getInt8(offset + 13),
    });
  }
  return {
    schemaVersion,
    captureStartTimestampMs,
    observations,
    ignoredTrailingBytes: payloadBytes % RR_V1_RECORD_BYTES,
  };
}

export function parseDiagnosticLog(text: string): DiagnosticEvent[] {
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [timestamp, event, ...details] = line.split("\t");
      const timestampMs = Number(timestamp);
      if (!Number.isFinite(timestampMs) || !event) throw new Error(`Invalid diagnostic line: ${line}`);
      return { timestampMs, event, details: details.join("\t") };
    });
}

export function analyzePostRide(
  ride: ParsedRide,
  artifacts: readonly DecodedRrArtifact[],
  events: readonly DiagnosticEvent[],
): PostRideAnalysis {
  const timestamps = ride.points.map((point) => point.timestampMs).filter(Number.isFinite);
  const startTimestampMs = timestamps.at(0);
  const endTimestampMs = timestamps.at(-1);
  const diagnosticErrors = events.filter((entry) =>
    /(?:failed|error|rejected|fallback)$/.test(entry.event),
  );
  const warnings: string[] = [];
  const approaches = analyzeApproaches(events);
  if (approaches.length === 0) warnings.push("No H10 approach request was recorded");
  for (const approach of approaches) {
    if (approach.captureStartedAfterMs === undefined) {
      warnings.push(`Approach ${approach.segmentId ?? "unknown"} did not start RR capture`);
    }
    if (approach.attemptStartedAfterMs !== undefined &&
      approach.captureStartedAfterMs !== undefined &&
      approach.captureStartedAfterMs > approach.attemptStartedAfterMs
    ) {
      warnings.push(`RR capture started after attempt entry for ${approach.segmentId ?? "unknown"}`);
    }
  }
  const rrArtifacts = artifacts.map((artifact) => analyzeArtifact(ride, artifact));
  if (rrArtifacts.some((artifact) => artifact.ignoredTrailingBytes > 0)) {
    warnings.push("At least one RR artifact ends with an incomplete record");
  }
  return {
    ride: {
      pointCount: ride.points.length,
      startTimestampMs,
      endTimestampMs,
      durationSeconds: startTimestampMs !== undefined && endTimestampMs !== undefined
        ? (endTimestampMs - startTimestampMs) / 1_000
        : undefined,
    },
    approaches,
    rrArtifacts,
    diagnosticErrors,
    warnings,
  };
}

export function formatPostRideAnalysis(analysis: PostRideAnalysis): string {
  const lines = [
    "# GritMap post-ride analysis",
    "",
    `- FIT points: ${analysis.ride.pointCount}`,
    `- Approaches: ${analysis.approaches.length}`,
    `- RR artifacts: ${analysis.rrArtifacts.length}`,
    `- Diagnostic errors/fallbacks: ${analysis.diagnosticErrors.length}`,
  ];
  analysis.approaches.forEach((approach, index) => {
    lines.push(
      "",
      `## Approach ${index + 1}: ${approach.segmentId ?? "unknown segment"}`,
      `- Connected: ${formatLatency(approach.connectedAfterMs)}`,
      `- Capture started: ${formatLatency(approach.captureStartedAfterMs)}`,
      `- Attempt started: ${formatLatency(approach.attemptStartedAfterMs)}`,
      `- Retries: ${approach.retries}; fallback: ${approach.fallback ? "yes" : "no"}`,
    );
  });
  analysis.rrArtifacts.forEach((artifact, index) => {
    lines.push(
      "",
      `## RR artifact ${index + 1}`,
      `- Samples: ${artifact.sampleCount}; valid: ${artifact.validPct.toFixed(1)}%; gaps: ${artifact.gapCount}`,
      `- Duration: ${artifact.durationSeconds.toFixed(1)} s`,
      `- RR HR: ${formatNumber(artifact.rrHeartRateBpm)} bpm; FIT HR: ${formatNumber(artifact.fitHeartRateBpm)} bpm; difference: ${formatNumber(artifact.heartRateDifferenceBpm)} bpm`,
      `- Trailing bytes ignored: ${artifact.ignoredTrailingBytes}`,
    );
  });
  if (analysis.warnings.length > 0) {
    lines.push("", "## Warnings", ...analysis.warnings.map((warning) => `- ${warning}`));
  }
  return lines.join("\n");
}

function analyzeApproaches(events: readonly DiagnosticEvent[]): ApproachAnalysis[] {
  const starts = events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => event.event === "h10_approach_requested");
  return starts.map(({ event: start, index }, approachIndex) => {
    const endIndex = starts[approachIndex + 1]?.index ?? events.length;
    const scope = events.slice(index + 1, endIndex);
    const connected = scope.find((event) =>
      event.event === "h10_auto_state" && /(?:^|\s)state=CONNECTED(?:\s|$)/.test(event.details),
    );
    const capture = scope.find((event) => event.event === "h10_auto_capture_started");
    const attempt = scope.find((event) => event.event === "attempt_started");
    return {
      segmentId: detailValue(start.details, "segment"),
      requestedAtMs: start.timestampMs,
      connectedAfterMs: connected ? connected.timestampMs - start.timestampMs : undefined,
      captureStartedAfterMs: capture ? capture.timestampMs - start.timestampMs : undefined,
      attemptStartedAfterMs: attempt ? attempt.timestampMs - start.timestampMs : undefined,
      retries: scope.filter((event) => event.event === "h10_auto_retry_started").length,
      fallback: scope.some((event) => event.event === "h10_auto_fallback"),
    };
  });
}

function analyzeArtifact(ride: ParsedRide, artifact: DecodedRrArtifact): RrArtifactAnalysis {
  const valid = artifact.observations.filter((observation) => observation.valid);
  const meanRr = average(valid.map((observation) => observation.rrIntervalMs));
  const endElapsedMs = artifact.observations.at(-1)?.elapsedMs ?? 0;
  const fitHr = ride.points
    .filter((point) =>
      point.timestampMs >= artifact.captureStartTimestampMs &&
      point.timestampMs <= artifact.captureStartTimestampMs + endElapsedMs &&
      point.heartRate !== undefined,
    )
    .map((point) => point.heartRate!);
  const rrHeartRateBpm = meanRr === undefined ? undefined : 60_000 / meanRr;
  const fitHeartRateBpm = average(fitHr);
  return {
    schemaVersion: artifact.schemaVersion,
    sampleCount: artifact.observations.length,
    validSampleCount: valid.length,
    validPct: artifact.observations.length === 0 ? 0 : valid.length * 100 / artifact.observations.length,
    gapCount: artifact.observations.filter((observation) => observation.reasonCode === 4).length,
    durationSeconds: endElapsedMs / 1_000,
    rrHeartRateBpm,
    fitHeartRateBpm,
    heartRateDifferenceBpm: rrHeartRateBpm !== undefined && fitHeartRateBpm !== undefined
      ? rrHeartRateBpm - fitHeartRateBpm
      : undefined,
    ignoredTrailingBytes: artifact.ignoredTrailingBytes,
  };
}

function detailValue(details: string, key: string): string | undefined {
  return details.match(new RegExp(`(?:^|\\s)${key}=([^\\s]+)`))?.[1];
}

function average(values: readonly number[]): number | undefined {
  return values.length === 0 ? undefined : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatLatency(value: number | undefined): string {
  return value === undefined ? "not observed" : `${(value / 1_000).toFixed(1)} s after approach`;
}

function formatNumber(value: number | undefined): string {
  return value === undefined ? "n/a" : value.toFixed(1);
}
