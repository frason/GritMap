import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  type CameraRef,
  type LngLatBounds,
  type MapRef,
} from "@maplibre/maplibre-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import type { RideTrackPoint } from "../db/getRideTrack";
import { colors } from "../theme/colors";

export interface RouteMapViewProps {
  points: RideTrackPoint[];
  /** Renders a second, differently-styled line over this point-index sub-range (issue #7). */
  highlightRange?: { startPointIndex: number; endPointIndex: number };
  /** Tap-to-place start/end pins directly on the map, for defining a segment (issue #58). */
  editableRange?: EditableSegmentRange;
}

export interface EditableSegmentRange {
  startLatLng: { lat: number; lng: number };
  endLatLng: { lat: number; lng: number };
  /** Which pin the next map tap moves; tapping a pin also selects it. */
  activeHandle: "start" | "end";
  onSelectHandle: (handle: "start" | "end") => void;
  /** Fires with the tapped map coordinate; the caller snaps it onto the real track. */
  onMapTap: (latLng: { lat: number; lng: number }) => void;
}

/**
 * Real OpenStreetMap-based vector tiles (roads, terrain shading, place labels) -- not
 * MapLibre's own bare `demotiles.maplibre.org` demo style (land/country outlines only),
 * which is all this rendered before issue #57. OpenFreeMap (openfreemap.org) is free, needs
 * no API key, has no rate limit, and serves standard MapLibre style-JSON directly, matching
 * docs/Grip-Map-app-spec.md's "Map & Elevation Data Stack" free/open-source requirement
 * without the account/key friction of the doc's named alternatives (Stadia Maps, MapTiler).
 * "Liberty" is OpenFreeMap's general-purpose style; see docs/DEV_SETUP.md for the other
 * styles they publish if a different look is ever wanted.
 */
const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

/**
 * A single `LineString` across a real GPS gap (e.g. a tunnel) would draw a false straight
 * line through it. This threshold matches docs/MVP.md's matcher rule ("Allow GPS gaps up to
 * 30 seconds") -- points more than this far apart in time start a new line segment.
 */
const GPS_GAP_THRESHOLD_MS = 30_000;

const HANDLE_SIZE = 28;

/**
 * Zoom level a tap-to-place eases the camera to -- close enough to place a pin precisely
 * against a 30m corridor without the user needing to manually pinch-zoom first.
 */
const EDIT_ZOOM_LEVEL = 17;

export function RouteMapView({ points, highlightRange, editableRange }: RouteMapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const cameraRef = useRef<CameraRef>(null);
  // Bumped on every onRegionDidChange (settled) and, throttled, on onRegionIsChanging (live
  // pan/zoom) so EditableHandles knows when it's safe to re-project its pins' screen
  // positions (see EditableHandles' doc comment).
  const [regionChangeTick, setRegionChangeTick] = useState(0);
  const lastLiveReprojectAtRef = useRef(0);

  // Eases the camera to whichever pin just became active -- covers both the Start/End
  // toggle buttons and tapping a pin directly to select it (both just change
  // editableRange.activeHandle). Deliberately skips the very first time editableRange
  // appears, so loading this screen doesn't immediately zoom away from the initial
  // whole-route view before the user has done anything.
  const previousActiveHandleRef = useRef<"start" | "end" | undefined>(undefined);
  useEffect(() => {
    if (editableRange === undefined) {
      previousActiveHandleRef.current = undefined;
      return;
    }
    if (
      previousActiveHandleRef.current !== undefined &&
      previousActiveHandleRef.current !== editableRange.activeHandle
    ) {
      const target =
        editableRange.activeHandle === "start" ? editableRange.startLatLng : editableRange.endLatLng;
      cameraRef.current?.easeTo({ center: [target.lng, target.lat], zoom: EDIT_ZOOM_LEVEL, duration: 350 });
    }
    previousActiveHandleRef.current = editableRange.activeHandle;
  }, [
    editableRange?.activeHandle,
    editableRange?.startLatLng.lat,
    editableRange?.startLatLng.lng,
    editableRange?.endLatLng.lat,
    editableRange?.endLatLng.lng,
  ]);

  if (points.length === 0) {
    return <Map ref={mapRef} style={styles.map} mapStyle={MAP_STYLE_URL} />;
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
    <View style={styles.map}>
      <Map
        ref={mapRef}
        style={styles.map}
        mapStyle={MAP_STYLE_URL}
        // Locked while editing a segment: keeping the map north-up and flat makes it much
        // easier to judge where a tap will land relative to the route.
        touchRotate={editableRange === undefined}
        touchPitch={editableRange === undefined}
        onRegionDidChange={() => setRegionChangeTick((tick) => tick + 1)}
        // Without this, a pin stays frozen at its old screen position for the whole
        // duration of a manual pan/zoom and only jumps to the correct spot once the
        // gesture settles (onRegionDidChange alone). Throttled to ~10/sec so a fast pan
        // doesn't flood MapLibre's native project() bridge call with a request per frame.
        onRegionIsChanging={() => {
          const now = Date.now();
          if (now - lastLiveReprojectAtRef.current < 100) return;
          lastLiveReprojectAtRef.current = now;
          setRegionChangeTick((tick) => tick + 1);
        }}
        onPress={
          editableRange === undefined
            ? undefined
            : (event) => {
                const [lng, lat] = event.nativeEvent.lngLat;
                cameraRef.current?.easeTo({ center: [lng, lat], zoom: EDIT_ZOOM_LEVEL, duration: 350 });
                editableRange.onMapTap({ lat, lng });
              }
        }
      >
        <Camera ref={cameraRef} initialViewState={{ bounds }} />
        <GeoJSONSource id="route-track" data={trackGeoJson}>
          {/* A white casing beneath the line keeps it legible over the basemap's own varied
              colors (roads, water, parks) -- unnecessary on the old flat demo-tile background,
              but the real OSM style this replaced (issue #57) needed it. */}
          <Layer
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{ "line-color": colors.surface, "line-width": 6 }}
          />
          <Layer
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{ "line-color": colors.textPrimary, "line-width": 3 }}
          />
        </GeoJSONSource>
        {highlightGeoJson !== undefined && (
          <GeoJSONSource id="route-highlight" data={highlightGeoJson}>
            <Layer
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{ "line-color": colors.surface, "line-width": 7 }}
            />
            <Layer
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{ "line-color": colors.brand, "line-width": 4 }}
            />
          </GeoJSONSource>
        )}
      </Map>
      {editableRange !== undefined && (
        <EditableHandles mapRef={mapRef} range={editableRange} regionChangeTick={regionChangeTick} />
      )}
    </View>
  );
}

interface ScreenPoint {
  x: number;
  y: number;
}

/**
 * Two tappable pins overlaid on top of the map for picking a segment's start/end (issue
 * #58) -- replacing an earlier continuous-drag design that turned out to be unreliable
 * nested inside DefineSegmentScreen's ScrollView (the ScrollView's native scroll gesture
 * would sometimes win the touch mid-drag). A tap is a much simpler, more robust gesture in
 * that context, and pairs naturally with an auto-zoom (see RouteMapView's onPress) for
 * precise placement, plus DistanceRangeScrubber's existing +/- steppers for fine-tuning.
 *
 * Pin screen positions are projected via MapLibre's native project() bridge call, refreshed
 * whenever the map viewport settles (onRegionDidChange, surfaced as regionChangeTick) or the
 * target lat/lng changes -- cheap here since it's two calls, not the whole-track batch a
 * continuous drag would have needed.
 */
function EditableHandles({
  mapRef,
  range,
  regionChangeTick,
}: {
  mapRef: React.RefObject<MapRef | null>;
  range: EditableSegmentRange;
  regionChangeTick: number;
}) {
  const [startScreen, setStartScreen] = useState<ScreenPoint | undefined>(undefined);
  const [endScreen, setEndScreen] = useState<ScreenPoint | undefined>(undefined);

  const reproject = useCallback(async () => {
    const map = mapRef.current;
    if (map === null) return;
    try {
      const [start, end] = await Promise.all([
        map.project([range.startLatLng.lng, range.startLatLng.lat]),
        map.project([range.endLatLng.lng, range.endLatLng.lat]),
      ]);
      setStartScreen({ x: start[0], y: start[1] });
      setEndScreen({ x: end[0], y: end[1] });
    } catch {
      // The native map isn't ready yet (style/layout still loading) -- the next
      // onRegionDidChange (or the retry burst below) will try again. Leaving the last-known
      // pin positions in place is preferable to clearing them to nothing.
    }
  }, [mapRef, range.startLatLng.lat, range.startLatLng.lng, range.endLatLng.lat, range.endLatLng.lng]);

  useEffect(() => {
    void reproject();
  }, [reproject, regionChangeTick]);

  // Defensive retry burst on mount/range-change: it's not verified against a live device
  // whether the initial programmatic camera-to-bounds fit itself fires onRegionDidChange, so
  // this hedges with a short bounded retry rather than leaving the pins stuck invisible
  // until the user happens to pan or zoom.
  useEffect(() => {
    const timers = [200, 600, 1_200].map((delay) => setTimeout(() => void reproject(), delay));
    return () => timers.forEach(clearTimeout);
  }, [reproject]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" onLayout={() => void reproject()}>
      {startScreen !== undefined && (
        <Pin
          label="Start"
          point={startScreen}
          active={range.activeHandle === "start"}
          onPress={() => range.onSelectHandle("start")}
        />
      )}
      {endScreen !== undefined && (
        <Pin
          label="End"
          point={endScreen}
          active={range.activeHandle === "end"}
          onPress={() => range.onSelectHandle("end")}
        />
      )}
    </View>
  );
}

function Pin({
  label,
  point,
  active,
  onPress,
}: {
  label: "Start" | "End";
  point: ScreenPoint;
  active: boolean;
  onPress: () => void;
}) {
  const size = active ? HANDLE_SIZE + 6 : HANDLE_SIZE;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.handle,
        active && styles.handleActive,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          left: point.x - size / 2,
          top: point.y - size / 2,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${label} of segment range${active ? ", selected" : ""}`}
      accessibilityHint="Tap elsewhere on the map to move it here"
    />
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
  handle: {
    position: "absolute",
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    borderRadius: HANDLE_SIZE / 2,
    backgroundColor: colors.brandSubtle,
    borderWidth: 3,
    borderColor: colors.surface,
  },
  handleActive: {
    backgroundColor: colors.brand,
  },
});
