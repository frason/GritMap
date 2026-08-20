import { Camera, GeoJSONSource, Layer, Map, type LngLatBounds } from "@maplibre/maplibre-react-native";
import { StyleSheet } from "react-native";
import type { RideTrackPoint } from "../db/getRideTrack";
import { colors } from "../theme/colors";

export interface RouteMapViewProps {
  points: RideTrackPoint[];
  /** Renders a second, differently-styled line over this point-index sub-range (issue #7). */
  highlightRange?: { startPointIndex: number; endPointIndex: number };
}

/**
 * A single `LineString` across a real GPS gap (e.g. a tunnel) would draw a false straight
 * line through it. This threshold matches docs/MVP.md's matcher rule ("Allow GPS gaps up to
 * 30 seconds") -- points more than this far apart in time start a new line segment.
 */
const GPS_GAP_THRESHOLD_MS = 30_000;

export function RouteMapView({ points, highlightRange }: RouteMapViewProps) {
  if (points.length === 0) {
    return <Map style={styles.map} mapStyle="https://demotiles.maplibre.org/style.json" />;
  }

  const bounds = computeBounds(points);
  const trackGeoJson = toMultiLineString(points);
  const highlightGeoJson =
    highlightRange !== undefined
      ? toMultiLineString(
          points.filter(
            (point) =>
              point.pointIndex >= highlightRange.startPointIndex &&
              point.pointIndex <= highlightRange.endPointIndex,
          ),
        )
      : undefined;

  return (
    <Map style={styles.map} mapStyle="https://demotiles.maplibre.org/style.json">
      <Camera initialViewState={{ bounds }} />
      <GeoJSONSource id="route-track" data={trackGeoJson}>
        <Layer
          type="line"
          layout={{ "line-cap": "round", "line-join": "round" }}
          paint={{ "line-color": colors.textTertiary, "line-width": 3 }}
        />
      </GeoJSONSource>
      {highlightGeoJson !== undefined && (
        <GeoJSONSource id="route-highlight" data={highlightGeoJson}>
          <Layer
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{ "line-color": colors.brand, "line-width": 4 }}
          />
        </GeoJSONSource>
      )}
    </Map>
  );
}

function computeBounds(points: readonly RideTrackPoint[]): LngLatBounds {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const point of points) {
    west = Math.min(west, point.lng);
    east = Math.max(east, point.lng);
    south = Math.min(south, point.lat);
    north = Math.max(north, point.lat);
  }
  return [west, south, east, north];
}

function toMultiLineString(
  points: readonly RideTrackPoint[],
): GeoJSON.Feature<GeoJSON.MultiLineString> {
  const lines: [number, number][][] = [];
  let current: [number, number][] = [];

  points.forEach((point, index) => {
    const previous = points[index - 1];
    if (previous !== undefined && point.timestampMs - previous.timestampMs > GPS_GAP_THRESHOLD_MS) {
      if (current.length > 1) lines.push(current);
      current = [];
    }
    current.push([point.lng, point.lat]);
  });
  if (current.length > 1) lines.push(current);

  return {
    type: "Feature",
    properties: {},
    geometry: { type: "MultiLineString", coordinates: lines },
  };
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
