import { View } from "react-native";
import Svg, { Polyline } from "react-native-svg";
import { useColors } from "../theme/useColors";
import type { RidePreviewPoint } from "../db/listRides";

export interface RidePreviewThumbnailProps {
  points: readonly RidePreviewPoint[];
  size?: number;
  /** A wide or tall box instead of a square; the route is fitted inside and centred. */
  width?: number;
  height?: number;
  strokeWidth?: number;
}

/**
 * A tiny top-down route-shape thumbnail for a rides-list row -- a bare SVG polyline over
 * the ride's own small decimated preview (see persistImportedRide.ts's
 * computePreviewPolylineJson), not a real map (rendering an interactive MapLibre instance
 * per list row would mean dozens of live tile fetches on every scroll -- this codebase
 * only ever uses RouteMapView one at a time, on a single-ride screen).
 *
 * Unlike ElevationSparkline (which intentionally stretches X and Y independently to fill
 * its box), this fits a single uniform scale to both axes and centers the result -- an
 * independently-stretched lat/lng box would visibly distort the route's actual shape. A
 * cos(meanLatitude) correction narrows the longitude span first, since a degree of
 * longitude covers less real distance than a degree of latitude away from the equator.
 */
export function RidePreviewThumbnail({ points, size = 40, width = size, height = size, strokeWidth = 1.5 }: RidePreviewThumbnailProps) {
  const palette = useColors();
  if (points.length < 2) return null;

  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const meanLatRadians = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const lngCorrection = Math.cos(meanLatRadians) || 1;
  const latSpan = maxLat - minLat || 1e-6;
  const lngSpan = (maxLng - minLng) * lngCorrection || 1e-6;

  const padding = Math.min(width, height) * 0.12;
  const scale = Math.min((width - padding * 2) / lngSpan, (height - padding * 2) / latSpan);
  const drawnWidth = lngSpan * scale;
  const drawnHeight = latSpan * scale;
  const offsetX = (width - drawnWidth) / 2;
  const offsetY = (height - drawnHeight) / 2;

  const toX = (lng: number) => offsetX + (lng - minLng) * lngCorrection * scale;
  const toY = (lat: number) => height - (offsetY + (lat - minLat) * scale);

  const polylinePoints = points.map((point) => `${toX(point.lng)},${toY(point.lat)}`).join(" ");

  return (
    <View>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Polyline
          points={polylinePoints}
          fill="none"
          stroke={palette.ctaText}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}
