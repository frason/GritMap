import { ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Line, Polyline, Rect, Text as SvgText } from "react-native-svg";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { computeAdaptiveZoneGrades, type ZoneWindow } from "../pacing/computeZoneGrades";
import type { PacingClassification, PacingZone } from "../pacing/buildTargetPowerZones";
import type { SegmentReferencePoint } from "../segments/resamplePolyline";

export interface ElevationProfileChartProps {
  referencePolyline: readonly SegmentReferencePoint[];
  /** The computed pacing plan, when FTP + a goal for this segment are both set. Undefined renders a plain elevation line with quarter-mile ticks and no color. */
  zones?: readonly PacingZone[];
  height?: number;
}

/**
 * Fixed width per zone, not a share of the container -- a segment with many zones (a real
 * climb like Diablo has ~26 quarter-mile zones) gets a wider, horizontally-scrollable
 * chart instead of squeezing every band below legibility. At this width a watt label
 * always has room, so `MIN_LABEL_BAND_WIDTH` below is a defensive floor that should never
 * actually trigger, not the primary sizing mechanism it was before.
 */
const ZONE_PIXEL_WIDTH = 36;
const MIN_LABEL_BAND_WIDTH = 26;
const MIN_CHART_WIDTH = 240;

/** Differ in lightness, not just hue (easier to tell apart than red/green at a glance). */
const CLASSIFICATION_COLORS: Record<PacingClassification, { fill: string; accent: string }> = {
  REST: { fill: colors.statusInfoSubtle, accent: colors.statusInfo },
  HOLD: { fill: colors.surface, accent: colors.textSecondary },
  PUSH: { fill: colors.statusWarningSubtle, accent: colors.statusWarning },
};

/**
 * The segment's full elevation profile, broken down by the same quarter-mile zones the
 * pacing plan uses (computeZoneGrades.ts) -- plain ticks with no FTP/goal set, or
 * zone-colored bands with target watts once `zones` (buildTargetPowerZones.ts's output) is
 * passed in, so this chart doubles as the pacing-plan visualization rather than needing a
 * separate 25-plus-row table for a climb Diablo's length. Each zone gets an equal fixed
 * pixel width regardless of its real distance (the last zone is often a shorter remainder)
 * -- trading exact distance-proportionality for every zone being equally legible, which
 * matters more here since the point is reading each quarter-mile's own number.
 */
export function ElevationProfileChart({ referencePolyline, zones, height = 150 }: ElevationProfileChartProps) {
  const points = referencePolyline.filter((point) => point.elevationMeters !== undefined);
  if (points.length < 2) return null;

  const zoneWindows: readonly ZoneWindow[] = zones ?? computeAdaptiveZoneGrades(referencePolyline);
  if (zoneWindows.length === 0) return null;

  const elevations = points.map((point) => point.elevationMeters!);
  const minElevation = Math.min(...elevations);
  const maxElevation = Math.max(...elevations);
  const elevationRange = maxElevation - minElevation || 1;
  const chartWidth = Math.max(MIN_CHART_WIDTH, zoneWindows.length * ZONE_PIXEL_WIDTH);

  const toX = (distanceMeters: number): number => {
    for (let i = 0; i < zoneWindows.length; i += 1) {
      const zone = zoneWindows[i]!;
      const isLastZone = i === zoneWindows.length - 1;
      if (distanceMeters <= zone.endDistanceMeters || isLastZone) {
        const zoneLength = zone.endDistanceMeters - zone.startDistanceMeters || 1;
        const fraction = Math.min(1, Math.max(0, (distanceMeters - zone.startDistanceMeters) / zoneLength));
        return i * ZONE_PIXEL_WIDTH + fraction * ZONE_PIXEL_WIDTH;
      }
    }
    return chartWidth;
  };
  const toY = (elevationMeters: number) => height - ((elevationMeters - minElevation) / elevationRange) * height;

  const polylinePoints = points
    .map((point) => `${toX(point.distanceMeters)},${toY(point.elevationMeters!)}`)
    .join(" ");
  const boundaries = zoneWindows.map((_, index) => index * ZONE_PIXEL_WIDTH);
  boundaries.push(zoneWindows.length * ZONE_PIXEL_WIDTH);

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={zoneWindows.length > 6}>
        <Svg width={chartWidth} height={height} viewBox={`0 0 ${chartWidth} ${height}`}>
          {zones !== undefined &&
            zones.map((zone, index) => (
              <Rect
                key={index}
                x={index * ZONE_PIXEL_WIDTH}
                y={0}
                width={ZONE_PIXEL_WIDTH}
                height={height}
                fill={CLASSIFICATION_COLORS[zone.classification].fill}
              />
            ))}
          {boundaries.map((x, index) => (
            <Line
              key={index}
              x1={x}
              y1={0}
              x2={x}
              y2={height}
              stroke={zones !== undefined ? colors.surface : colors.border}
              strokeWidth={zones !== undefined ? 1.5 : 1}
            />
          ))}
          <Polyline
            points={polylinePoints}
            fill="none"
            stroke={colors.textPrimary}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {zones !== undefined &&
            zones.map((zone, index) => {
              if (ZONE_PIXEL_WIDTH < MIN_LABEL_BAND_WIDTH) return null;
              const centerX = index * ZONE_PIXEL_WIDTH + ZONE_PIXEL_WIDTH / 2;
              return (
                <SvgText
                  key={index}
                  x={centerX}
                  y={height - 6}
                  fontSize={9}
                  fontWeight="700"
                  fill={CLASSIFICATION_COLORS[zone.classification].accent}
                  textAnchor="middle"
                >
                  {zone.targetPowerWatts}W
                </SvgText>
              );
            })}
        </Svg>
      </ScrollView>
      {zones !== undefined && (
        <View style={styles.legend}>
          <LegendDot color={CLASSIFICATION_COLORS.REST.accent} label="Rest" />
          <LegendDot color={CLASSIFICATION_COLORS.HOLD.accent} label="Hold" />
          <LegendDot color={CLASSIFICATION_COLORS.PUSH.accent} label="Push" />
        </View>
      )}
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.space8,
  },
  legend: {
    flexDirection: "row",
    gap: spacing.space16,
    justifyContent: "center",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.space4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
