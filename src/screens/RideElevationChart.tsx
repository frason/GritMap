import { StyleSheet, View } from "react-native";
import Svg, { Polyline, Rect } from "react-native-svg";
import { colors } from "../theme/colors";
import { resamplePolyline, type ResamplePoint } from "../segments/resamplePolyline";

export interface RideElevationChartRange {
  startDistanceMeters: number;
  endDistanceMeters: number;
}

export interface RideElevationChartProps {
  /** The ride's full, un-decimated track -- this component resamples it itself. */
  points: readonly ResamplePoint[];
  /** The segment's current start/end selection, shaded on the chart. */
  selectedRange: RideElevationChartRange;
  /** Zooms the chart's x-domain to this sub-range (e.g. driven by the map's own zoom); defaults to the whole ride. */
  visibleRange?: RideElevationChartRange;
  height?: number;
}

const VIEWBOX_WIDTH = 328;
/** Charting only -- independent of the 10m resampling resamplePolyline.ts does again at save time for the actual saved segment. */
const CHART_RESAMPLE_INTERVAL_METERS = 15;

/**
 * The whole ride's elevation profile for the segment-creation screen -- nothing like this
 * existed before (DistanceRangeScrubber only ever showed two point-in-time readouts, never
 * a line). Uses the same haversine-based distance axis as `computeCumulativeTrackDistance`
 * (both ultimately call `haversineDistanceMeters`), so the shaded selection here lines up
 * exactly with `DefineSegmentScreen`'s own start/end state -- confirmed consistent by
 * `cumulativeTrackDistance.ts`'s own doc comment, not assumed.
 */
export function RideElevationChart({ points, selectedRange, visibleRange, height = 140 }: RideElevationChartProps) {
  const resampled = resamplePolyline(points, CHART_RESAMPLE_INTERVAL_METERS).filter(
    (point) => point.elevationMeters !== undefined,
  );
  if (resampled.length < 2) return null;

  const totalDistanceMeters = resampled[resampled.length - 1]!.distanceMeters;
  const domainStart = visibleRange?.startDistanceMeters ?? 0;
  const domainEnd = visibleRange?.endDistanceMeters ?? totalDistanceMeters;
  const domainSpan = domainEnd - domainStart || 1;

  const elevations = resampled.map((point) => point.elevationMeters!);
  const minElevation = Math.min(...elevations);
  const maxElevation = Math.max(...elevations);
  const elevationRange = maxElevation - minElevation || 1;

  const toX = (distanceMeters: number) => ((distanceMeters - domainStart) / domainSpan) * VIEWBOX_WIDTH;
  const toY = (elevationMeters: number) => height - ((elevationMeters - minElevation) / elevationRange) * height;

  const visiblePoints = resampled.filter(
    (point) => point.distanceMeters >= domainStart && point.distanceMeters <= domainEnd,
  );
  const polylinePoints = (visiblePoints.length >= 2 ? visiblePoints : resampled)
    .map((point) => `${toX(point.distanceMeters)},${toY(point.elevationMeters!)}`)
    .join(" ");

  const selectionStartX = toX(Math.max(selectedRange.startDistanceMeters, domainStart));
  const selectionEndX = toX(Math.min(selectedRange.endDistanceMeters, domainEnd));
  const showSelection = selectedRange.endDistanceMeters > domainStart && selectedRange.startDistanceMeters < domainEnd;

  return (
    <View style={styles.container}>
      <Svg width="100%" height={height} viewBox={`0 0 ${VIEWBOX_WIDTH} ${height}`} preserveAspectRatio="none">
        {showSelection && (
          <Rect
            x={selectionStartX}
            y={0}
            width={Math.max(0, selectionEndX - selectionStartX)}
            height={height}
            fill={colors.brandSubtle}
          />
        )}
        <Polyline
          points={polylinePoints}
          fill="none"
          stroke={colors.textPrimary}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
  },
});
