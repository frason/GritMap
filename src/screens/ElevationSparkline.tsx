import { View } from "react-native";
import Svg, { Polyline } from "react-native-svg";
import { colors } from "../theme/colors";
import type { SegmentReferencePoint } from "../segments/resamplePolyline";

export interface ElevationSparklineProps {
  referencePolyline: readonly SegmentReferencePoint[];
  width?: number;
  height?: number;
}

/**
 * A small, axis-free elevation-profile line for the segment title row -- a quick-glance
 * shape, not a data display (see ElevationProfileChart.tsx for the full, quarter-mile
 * breakdown). Renders nothing when the segment has fewer than two elevation samples.
 */
export function ElevationSparkline({ referencePolyline, width = 64, height = 28 }: ElevationSparklineProps) {
  const points = referencePolyline.filter((point) => point.elevationMeters !== undefined);
  if (points.length < 2) return null;

  const maxDistance = points[points.length - 1]!.distanceMeters || 1;
  const elevations = points.map((point) => point.elevationMeters!);
  const minElevation = Math.min(...elevations);
  const maxElevation = Math.max(...elevations);
  const elevationRange = maxElevation - minElevation || 1;

  const toX = (distanceMeters: number) => (distanceMeters / maxDistance) * width;
  const toY = (elevationMeters: number) => height - ((elevationMeters - minElevation) / elevationRange) * height;

  const polylinePoints = points
    .map((point) => `${toX(point.distanceMeters)},${toY(point.elevationMeters!)}`)
    .join(" ");

  return (
    <View>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Polyline
          points={polylinePoints}
          fill="none"
          stroke={colors.brand}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}
