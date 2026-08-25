import { StyleSheet, Text, View } from "react-native";
import Svg, { Polygon, Polyline } from "react-native-svg";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

export interface ChannelSeriesPoint {
  distanceMeters: number;
  primary: number | null;
  comparison: number | null;
}

export interface ChannelChartProps {
  title: string;
  unit: string;
  series: readonly ChannelSeriesPoint[];
  /** Primary line color; comparison always renders in colors.textTertiary. */
  primaryColor?: keyof typeof colors;
  height?: number;
}

const VIEWBOX_WIDTH = 300;

/**
 * Hand-rolled SVG line chart (no charting library dependency) for docs/MVP.md's "Attempt
 * comparison" contract: two distance-aligned lines per channel with a shaded difference
 * band between them, and a real visual break wherever either line has a null (gap) sample
 * -- never a straight line drawn across missing data. No display smoothing is applied; the
 * series passed in is exactly compareAttempts.ts's resampled output.
 */
export function ChannelChart({
  title,
  unit,
  series,
  primaryColor = "brand",
  height = 140,
}: ChannelChartProps) {
  if (series.length === 0) {
    return null;
  }

  const maxDistance = series[series.length - 1]!.distanceMeters || 1;
  const allValues = series.flatMap((point) =>
    [point.primary, point.comparison].filter((value): value is number => value !== null),
  );
  const minValue = allValues.length > 0 ? Math.min(...allValues, 0) : 0;
  const maxValue = allValues.length > 0 ? Math.max(...allValues, 0) : 1;
  const valueRange = maxValue - minValue || 1;

  const toX = (distanceMeters: number) => (distanceMeters / maxDistance) * VIEWBOX_WIDTH;
  const toY = (value: number) => height - ((value - minValue) / valueRange) * height;

  const bandPolygons = buildBandPolygons(series, toX, toY);
  const primaryPolylines = buildPolylines(series, (point) => point.primary, toX, toY);
  const comparisonPolylines = buildPolylines(series, (point) => point.comparison, toX, toY);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.legend}>
          <LegendDot color={primaryColor} label="This attempt" />
          <LegendDot color="textTertiary" label="Comparison" />
        </View>
      </View>
      <Text style={styles.axisLabel}>
        {formatValue(maxValue)} {unit}
      </Text>
      <Svg width="100%" height={height} viewBox={`0 0 ${VIEWBOX_WIDTH} ${height}`} preserveAspectRatio="none">
        {bandPolygons.map((points, index) => (
          <Polygon key={index} points={points} fill={colors.brandSubtle} opacity={0.7} />
        ))}
        {comparisonPolylines.map((points, index) => (
          <Polyline
            key={index}
            points={points}
            fill="none"
            stroke={colors.textTertiary}
            strokeWidth={2}
          />
        ))}
        {primaryPolylines.map((points, index) => (
          <Polyline
            key={index}
            points={points}
            fill="none"
            stroke={colors[primaryColor]}
            strokeWidth={2}
          />
        ))}
      </Svg>
      <Text style={styles.axisLabel}>
        {formatValue(minValue)} {unit}
      </Text>
    </View>
  );
}

function LegendDot({ color, label }: { color: keyof typeof colors; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: colors[color] }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

/** Builds one polyline-points string per contiguous run of non-null values (a gap breaks the line). */
function buildPolylines(
  series: readonly ChannelSeriesPoint[],
  pick: (point: ChannelSeriesPoint) => number | null,
  toX: (distanceMeters: number) => number,
  toY: (value: number) => number,
): string[] {
  const polylines: string[] = [];
  let current: string[] = [];

  for (const point of series) {
    const value = pick(point);
    if (value === null) {
      if (current.length > 1) polylines.push(current.join(" "));
      current = [];
      continue;
    }
    current.push(`${toX(point.distanceMeters)},${toY(value)}`);
  }
  if (current.length > 1) polylines.push(current.join(" "));
  return polylines;
}

/** Builds one filled band per contiguous run where both primary and comparison are present. */
function buildBandPolygons(
  series: readonly ChannelSeriesPoint[],
  toX: (distanceMeters: number) => number,
  toY: (value: number) => number,
): string[] {
  const polygons: string[] = [];
  let top: string[] = [];
  let bottom: string[] = [];

  function flush() {
    if (top.length > 1) {
      polygons.push([...top, ...bottom.reverse()].join(" "));
    }
    top = [];
    bottom = [];
  }

  for (const point of series) {
    if (point.primary === null || point.comparison === null) {
      flush();
      continue;
    }
    const x = toX(point.distanceMeters);
    top.push(`${x},${toY(point.primary)}`);
    bottom.push(`${x},${toY(point.comparison)}`);
  }
  flush();
  return polygons;
}

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.space4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  legend: {
    flexDirection: "row",
    gap: spacing.space12,
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
    fontSize: 11,
    color: colors.textSecondary,
  },
  axisLabel: {
    fontSize: 11,
    color: colors.textTertiary,
  },
});
