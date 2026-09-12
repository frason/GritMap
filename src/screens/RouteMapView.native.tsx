import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  type LngLatBounds,
  type MapRef,
} from "@maplibre/maplibre-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from "react-native";
import type { RideTrackPoint } from "../db/getRideTrack";
import {
  clampRangeEnd,
  clampRangeStart,
  SEGMENT_RANGE_STEP_METERS,
} from "../segments/clampSegmentRange.ts";
import {
  nearestScreenSnapCandidate,
  sampleForHandleSnapping,
  type ScreenPoint,
  type ScreenSnapCandidate,
} from "../segments/screenSnap.ts";
import { colors } from "../theme/colors";
import { formatDistanceMiles } from "./formatRideStats.ts";

export interface RouteMapViewProps {
  points: RideTrackPoint[];
  /** Renders a second, differently-styled line over this point-index sub-range (issue #7). */
  highlightRange?: { startPointIndex: number; endPointIndex: number };
  /** Draggable start/end handles directly on the map, for defining a segment (issue #58). */
  editableRange?: EditableSegmentRange;
}

export interface EditableSegmentRange {
  startDistanceMeters: number;
  endDistanceMeters: number;
  totalDistanceMeters: number;
  startLatLng: { lat: number; lng: number };
  endLatLng: { lat: number; lng: number };
  /** The full track, distance-indexed -- sampled down before projecting (see screenSnap.ts). */
  track: readonly { lat: number; lng: number; distanceMeters: number }[];
  onChange: (range: { startDistanceMeters: number; endDistanceMeters: number }) => void;
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

/**
 * Caps how many track points get projected to screen coordinates (via MapLibre's native
 * project() bridge call) whenever the map viewport settles. Bounded regardless of ride
 * length so a multi-hour ride's thousands of GPS points never mean thousands of native round
 * trips -- see screenSnap.ts's sampleForHandleSnapping doc.
 */
const MAX_SNAP_CANDIDATES = 250;

const HANDLE_SIZE = 28;

export function RouteMapView({ points, highlightRange, editableRange }: RouteMapViewProps) {
  const mapRef = useRef<MapRef>(null);
  // Bumped on every onRegionDidChange so RangeHandles knows when it's safe to re-project its
  // handles' screen positions (see RangeHandles' doc comment).
  const [regionChangeTick, setRegionChangeTick] = useState(0);

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
        // Locked while editing a segment: a rotated/tilted view would still project
        // correctly (project() asks the native map itself, not our own math), but keeping
        // the map north-up and flat makes it much easier to place a precise handle without
        // accidentally rotating out from under your finger.
        touchRotate={editableRange === undefined}
        touchPitch={editableRange === undefined}
        onRegionDidChange={() => setRegionChangeTick((tick) => tick + 1)}
      >
        <Camera initialViewState={{ bounds }} />
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
        <RangeHandles mapRef={mapRef} range={editableRange} regionChangeTick={regionChangeTick} />
      )}
    </View>
  );
}

/**
 * Two draggable handles overlaid on top of the map, for picking a segment's start/end
 * directly at the real-world spot instead of via a linear distance scrubber divorced from
 * the map (issue #58). Dragging is snapped to the actual route: each handle's live drag
 * position is matched, in screen space, against a bounded sample of the track's own
 * projected points (screenSnap.ts) -- entirely in JS once the sample is projected, so a drag
 * gesture never waits on MapLibre's native project()/unproject() bridge mid-frame. That
 * projection only happens when the map viewport settles (onRegionDidChange, surfaced here as
 * regionChangeTick) or the range changes from elsewhere (e.g. this screen's own +/- stepper
 * buttons), not per drag frame.
 */
function RangeHandles({
  mapRef,
  range,
  regionChangeTick,
}: {
  mapRef: React.RefObject<MapRef | null>;
  range: EditableSegmentRange;
  regionChangeTick: number;
}) {
  const [candidates, setCandidates] = useState<ScreenSnapCandidate[]>([]);
  const [startScreen, setStartScreen] = useState<ScreenPoint | undefined>(undefined);
  const [endScreen, setEndScreen] = useState<ScreenPoint | undefined>(undefined);
  const [liveDrag, setLiveDrag] = useState<
    ({ handle: "start" | "end" } & ScreenPoint) | undefined
  >(undefined);

  const snapSample = useMemo(
    () => sampleForHandleSnapping(range.track, MAX_SNAP_CANDIDATES),
    [range.track],
  );

  const reproject = useCallback(async () => {
    const map = mapRef.current;
    if (map === null) return;
    try {
      const [start, end, ...sampled] = await Promise.all([
        map.project([range.startLatLng.lng, range.startLatLng.lat]),
        map.project([range.endLatLng.lng, range.endLatLng.lat]),
        ...snapSample.map((point) => map.project([point.lng, point.lat])),
      ]);
      setStartScreen({ x: start[0], y: start[1] });
      setEndScreen({ x: end[0], y: end[1] });
      setCandidates(
        sampled.map((screen, index) => ({
          x: screen[0],
          y: screen[1],
          distanceMeters: snapSample[index]!.distanceMeters,
        })),
      );
    } catch {
      // The native map isn't ready yet (style/layout still loading) -- the next
      // onRegionDidChange will try again. Leaving the last-known handle positions in place
      // is preferable to clearing them to nothing.
    }
  }, [mapRef, range.startLatLng.lat, range.startLatLng.lng, range.endLatLng.lat, range.endLatLng.lng, snapSample]);

  // Re-projects whenever the map viewport settles (regionChangeTick, bumped by the sibling
  // <Map>'s onRegionDidChange) or the handles' own target lat/lng or candidate sample
  // changes for a reason other than a drag on this component (e.g. the +/- stepper buttons,
  // or the track finishing its DB load).
  useEffect(() => {
    void reproject();
  }, [reproject, regionChangeTick]);

  // Defensive retry burst on mount/range-change: it's not verified against a live device
  // whether the initial programmatic camera-to-bounds fit itself fires onRegionDidChange, so
  // this hedges with a short bounded retry rather than leaving the handles stuck invisible
  // until the user happens to pan or zoom.
  useEffect(() => {
    const timers = [200, 600, 1_200].map((delay) => setTimeout(() => void reproject(), delay));
    return () => timers.forEach(clearTimeout);
  }, [reproject]);

  function screenFor(handle: "start" | "end"): ScreenPoint | undefined {
    if (liveDrag?.handle === handle) return liveDrag;
    return handle === "start" ? startScreen : endScreen;
  }

  function handleDragMove(handle: "start" | "end", point: ScreenPoint) {
    const match = nearestScreenSnapCandidate(candidates, point);
    if (match === undefined) return;
    setLiveDrag({ handle, x: match.x, y: match.y });
    if (handle === "start") {
      range.onChange({
        startDistanceMeters: clampRangeStart(match.distanceMeters, range.endDistanceMeters),
        endDistanceMeters: range.endDistanceMeters,
      });
    } else {
      range.onChange({
        startDistanceMeters: range.startDistanceMeters,
        endDistanceMeters: clampRangeEnd(
          match.distanceMeters,
          range.startDistanceMeters,
          range.totalDistanceMeters,
        ),
      });
    }
  }

  function handleDragEnd(handle: "start" | "end") {
    // Keep the exact screen position the drag already snapped to -- no need to wait for an
    // async re-projection of the same point (avoids a visible flicker/jump on release).
    if (liveDrag?.handle === handle) {
      if (handle === "start") setStartScreen(liveDrag);
      else setEndScreen(liveDrag);
    }
    setLiveDrag(undefined);
  }

  const startPanHandlers = useHandleDragPanResponder(
    () => screenFor("start") ?? { x: 0, y: 0 },
    (point) => handleDragMove("start", point),
    () => handleDragEnd("start"),
  );
  const endPanHandlers = useHandleDragPanResponder(
    () => screenFor("end") ?? { x: 0, y: 0 },
    (point) => handleDragMove("end", point),
    () => handleDragEnd("end"),
  );

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      onLayout={() => void reproject()}
    >
      {screenFor("start") !== undefined && (
        <Handle
          label="Start"
          point={screenFor("start")!}
          panHandlers={startPanHandlers}
          valueText={formatDistanceMiles(range.startDistanceMeters)}
          onIncrement={() =>
            range.onChange({
              startDistanceMeters: clampRangeStart(
                range.startDistanceMeters + SEGMENT_RANGE_STEP_METERS,
                range.endDistanceMeters,
              ),
              endDistanceMeters: range.endDistanceMeters,
            })
          }
          onDecrement={() =>
            range.onChange({
              startDistanceMeters: clampRangeStart(
                range.startDistanceMeters - SEGMENT_RANGE_STEP_METERS,
                range.endDistanceMeters,
              ),
              endDistanceMeters: range.endDistanceMeters,
            })
          }
        />
      )}
      {screenFor("end") !== undefined && (
        <Handle
          label="End"
          point={screenFor("end")!}
          panHandlers={endPanHandlers}
          valueText={formatDistanceMiles(range.endDistanceMeters)}
          onIncrement={() =>
            range.onChange({
              startDistanceMeters: range.startDistanceMeters,
              endDistanceMeters: clampRangeEnd(
                range.endDistanceMeters + SEGMENT_RANGE_STEP_METERS,
                range.startDistanceMeters,
                range.totalDistanceMeters,
              ),
            })
          }
          onDecrement={() =>
            range.onChange({
              startDistanceMeters: range.startDistanceMeters,
              endDistanceMeters: clampRangeEnd(
                range.endDistanceMeters - SEGMENT_RANGE_STEP_METERS,
                range.startDistanceMeters,
                range.totalDistanceMeters,
              ),
            })
          }
        />
      )}
    </View>
  );
}

function Handle({
  label,
  point,
  panHandlers,
  valueText,
  onIncrement,
  onDecrement,
}: {
  label: "Start" | "End";
  point: ScreenPoint;
  panHandlers: ReturnType<typeof PanResponder.create>["panHandlers"];
  valueText: string;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  return (
    <View
      {...panHandlers}
      style={[
        styles.handle,
        { left: point.x - HANDLE_SIZE / 2, top: point.y - HANDLE_SIZE / 2 },
      ]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`${label} of segment range`}
      accessibilityValue={{ text: valueText }}
      accessibilityActions={[
        { name: "increment", label: "Move further" },
        { name: "decrement", label: "Move back" },
      ]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "increment") onIncrement();
        if (event.nativeEvent.actionName === "decrement") onDecrement();
      }}
    />
  );
}

function useHandleDragPanResponder(
  getOrigin: () => ScreenPoint,
  onMove: (point: ScreenPoint) => void,
  onEnd: () => void,
): ReturnType<typeof PanResponder.create>["panHandlers"] {
  // getOrigin/onMove/onEnd close over live state and are fresh every render, but
  // PanResponder.create must be called once and stay stable for the component's lifetime --
  // recreating it mid-drag would drop the in-progress gesture (same pattern as
  // DistanceRangeScrubber.tsx's useDragPanResponder, generalized to 2D).
  const getOriginRef = useRef(getOrigin);
  getOriginRef.current = getOrigin;
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  const dragOrigin = useRef<ScreenPoint>({ x: 0, y: 0 });
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragOrigin.current = getOriginRef.current();
        },
        onPanResponderMove: (
          _event: GestureResponderEvent,
          gestureState: PanResponderGestureState,
        ) => {
          onMoveRef.current({
            x: dragOrigin.current.x + gestureState.dx,
            y: dragOrigin.current.y + gestureState.dy,
          });
        },
        onPanResponderRelease: () => onEndRef.current(),
        onPanResponderTerminate: () => onEndRef.current(),
      }),
    [],
  );
  return responder.panHandlers;
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
    backgroundColor: colors.brand,
    borderWidth: 3,
    borderColor: colors.surface,
  },
});
