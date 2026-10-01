import { StyleSheet, Text, View } from "react-native";
import Svg, { Line, Polyline, Rect, Text as SvgText } from "react-native-svg";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { computeZoneGrades, type ZoneWindow } from "../pacing/computeZoneGrades";
import type { PacingClassification, PacingZone } from "../pacing/buildTargetPowerZones";
import type { SegmentReferencePoint } from "../segments/resamplePolyline";

export interface ElevationProfileChartProps {
  referencePolyline: readonly SegmentReferencePoint[];
  /** The computed pacing plan, when FTP + a goal for this segment are both set. Undefined renders a plain elevation line with quarter-mile ticks and no color. */
  zones?: readonly PacingZone[];
  height?: number;
}

const VIEWBOX_WIDTH = 328;
const MIN_LABEL_BAND_WIDTH = 26;

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
 * separate 25-plus-row table for a climb Diablo's length.
 */
export function ElevationProfileChart({ referencePolyline, zones, height = 150 }: ElevationProfileChartProps) {
  const points = referencePolyline.filter((point) => point.elevationMeters !== undefined);
  if (points.length < 2) return null;

  const zoneWindows: readonly ZoneWindow[] = zones ?? computeZoneGrades(referencePolyline);
  const maxDistance = points[points.length - 1]!.distanceMeters || 1;
  const elevations = points.map((point) => point.elevationMeters!);
  const minElevation = Math.min(...elevations);
  const maxElevation = Math.max(...elevations);
  const elevationRange = maxElevation - minElevation || 1;

  const toX = (distanceMeters: number) => (distanceMeters / maxDistance) * VIEWBOX_WIDTH;
  const toY = (elevationMeters: number) => height - ((elevationMeters - minElevation) / elevationRange) * height;

  const polylinePoints = points
    .map((point) => `${toX(point.distanceMeters)},${toY(point.elevationMeters!)}`)
    .join(" ");
  const boundaries = [0, ...zoneWindows.map((zone) => zone.endDistanceMeters)];

  return (
    <View style={styles.container}>
      <Svg width="100%" height={height} viewBox={`0 0 ${VIEWBOX_WIDTH} ${height}`} preserveAspectRatio="none">
        {zones !== undefined &&
          zones.map((zone, index) => (
            <Rect
              key={index}
              x={toX(zone.startDistanceMeters)}
              y={0}
              width={toX(zone.endDistanceMeters) - toX(zone.startDistanceMeters)}
              height={height}
              fill={CLASSIFICATION_COLORS[zone.classification].fill}
            />
          ))}
        {boundaries.map((distanceMeters, index) => (
          <Line
            key={index}
            x1={toX(distanceMeters)}
            y1={0}
            x2={toX(distanceMeters)}
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
            const bandWidth = toX(zone.endDistanceMeters) - toX(zone.startDistanceMeters);
            if (bandWidth < MIN_LABEL_BAND_WIDTH) return null;
            const centerX = toX(zone.startDistanceMeters) + bandWidth / 2;
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
