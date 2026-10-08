import { ScrollView, StyleSheet, View } from "react-native";
import Svg, { Line, Polyline, Rect, Text as SvgText } from "react-native-svg";
import type { ColorPalette } from "../theme/colors";
import { AppText } from "../theme/components";
import { spacing } from "../theme/spacing";
import { typography } from "../theme/typography";
import { useColors } from "../theme/useColors";
import { computeAdaptiveZoneGrades } from "../pacing/computeZoneGrades";
import type { PacingClassification } from "../pacing/buildTargetPowerZones";
import type { SegmentReferencePoint } from "../segments/resamplePolyline";

/** What the chart needs of a plan zone -- satisfied by generated zones and imported rider/coach zones alike. */
export interface ChartPlanZone {
  startDistanceMeters: number;
  endDistanceMeters: number;
  targetPowerWatts: number;
  classification: PacingClassification;
}

export interface ElevationProfileChartProps {
  referencePolyline: readonly SegmentReferencePoint[];
  /** The pacing plan to draw -- generated (FTP + goal set) or imported. Undefined renders a plain elevation line with zone ticks and no color. */
  zones?: readonly ChartPlanZone[];
  height?: number;
}

/**
 * Fixed width per zone, not a share of the container -- a segment with many zones (a real
 * long climb can have 25 or more quarter-mile zones) gets a wider, horizontally-scrollable
 * chart instead of squeezing every band below legibility. At this width a watt label
 * always has room, so `MIN_LABEL_BAND_WIDTH` below is a defensive floor that should never
 * actually trigger, not the primary sizing mechanism it was before.
 */
const ZONE_PIXEL_WIDTH = 36;
const MIN_CHART_WIDTH = 240;
/** Watt labels sit in their own strip above the plot so they never collide with the elevation line. */
const LABEL_STRIP_HEIGHT = 20;
const LABEL_FONT_SIZE = typography.caption1.fontSize;
/** Wider than this and the chart scrolls sideways on a phone. */
const SCROLL_HINT_MIN_WIDTH = 340;

/** Differ in lightness, not just hue (easier to tell apart than red/green at a glance). */
function classificationColors(palette: ColorPalette): Record<PacingClassification, { fill: string; accent: string }> {
  return {
    REST: { fill: palette.statusInfoSubtle, accent: palette.statusInfo },
    // The page background, not the card's white, so a Hold band is still visibly a band.
    HOLD: { fill: palette.background, accent: palette.textSecondary },
    PUSH: { fill: palette.statusWarningSubtle, accent: palette.statusWarning },
  };
}

/**
 * The segment's full elevation profile, broken down by the same quarter-mile zones the
 * pacing plan uses (computeZoneGrades.ts) -- plain ticks with no FTP/goal set, or
 * zone-colored bands with target watts once `zones` (buildTargetPowerZones.ts's output) is
 * passed in, so this chart doubles as the pacing-plan visualization rather than needing a
 * separate 25-plus-row table for a long climb. Each zone gets an equal fixed
 * pixel width regardless of its real distance (the last zone is often a shorter remainder)
 * -- trading exact distance-proportionality for every zone being equally legible, which
 * matters more here since the point is reading each quarter-mile's own number.
 */
export function ElevationProfileChart({ referencePolyline, zones, height = 150 }: ElevationProfileChartProps) {
  const palette = useColors();
  const CLASSIFICATION_COLORS = classificationColors(palette);
  const points = referencePolyline.filter((point) => point.elevationMeters !== undefined);
  if (points.length < 2) return null;

  const zoneWindows: readonly { startDistanceMeters: number; endDistanceMeters: number }[] =
    zones ?? computeAdaptiveZoneGrades(referencePolyline);
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
  const plotTop = zones === undefined ? 0 : LABEL_STRIP_HEIGHT;
  const plotHeight = height - plotTop;
  const toY = (elevationMeters: number) => plotTop + plotHeight - ((elevationMeters - minElevation) / elevationRange) * plotHeight;

  const polylinePoints = points
    .map((point) => `${toX(point.distanceMeters)},${toY(point.elevationMeters!)}`)
    .join(" ");
  const boundaries = zoneWindows.map((_, index) => index * ZONE_PIXEL_WIDTH);
  boundaries.push(zoneWindows.length * ZONE_PIXEL_WIDTH);

  const wattTargets = zones?.map((zone) => zone.targetPowerWatts) ?? [];
  const summary =
    zones === undefined
      ? `Elevation profile, ${Math.round(minElevation)} to ${Math.round(maxElevation)} metres, ${zoneWindows.length} sections.`
      : `Pacing plan chart over the elevation profile: ${zones.length} sections, target power from ${Math.min(...wattTargets)} to ${Math.max(...wattTargets)} watts.`;

  return (
    <View style={styles.container} accessible accessibilityLabel={summary}>
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
              stroke={zones !== undefined ? palette.surface : palette.border}
              strokeWidth={zones !== undefined ? 1.5 : 1}
            />
          ))}
          <Polyline
            points={polylinePoints}
            fill="none"
            stroke={palette.textPrimary}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {zones !== undefined &&
            zones.map((zone, index) => {
              const centerX = index * ZONE_PIXEL_WIDTH + ZONE_PIXEL_WIDTH / 2;
              return (
                <SvgText
                  key={index}
                  x={centerX}
                  y={LABEL_STRIP_HEIGHT - 6}
                  fontSize={LABEL_FONT_SIZE}
                  fontWeight="700"
                  fill={CLASSIFICATION_COLORS[zone.classification].accent}
                  textAnchor="middle"
                >
                  {zone.targetPowerWatts}
                </SvgText>
              );
            })}
        </Svg>
      </ScrollView>
      {zones !== undefined && (
        <>
          <View style={styles.legend}>
            <LegendDot color={CLASSIFICATION_COLORS.REST.accent} label="Rest: ease off" />
            <LegendDot color={CLASSIFICATION_COLORS.HOLD.accent} label="Hold: steady" />
            <LegendDot color={CLASSIFICATION_COLORS.PUSH.accent} label="Push: ride harder" />
          </View>
          <AppText variant="caption1" color="textSecondary">
            The number above each column is that section's target power in watts.
            {chartWidth > SCROLL_HINT_MIN_WIDTH ? " Scroll sideways to see the whole segment." : ""}
          </AppText>
        </>
      )}
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <AppText variant="caption1" color="textSecondary">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.space8,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
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
});
