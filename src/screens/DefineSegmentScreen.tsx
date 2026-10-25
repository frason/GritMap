import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import * as Crypto from "expo-crypto";
import { SEGMENT_PAGE_ENABLED } from "../plans/featureFlag";
import { useDatabase } from "../db/DatabaseProvider";
import { getRideTrack, type RideTrackPoint } from "../db/getRideTrack";
import { insertSegment } from "../db/insertSegment";
import { runMatcherForSegment } from "../matcher/runMatcher";
import { computeSegmentFingerprint } from "../segments/segmentFingerprint";
import { resamplePolyline } from "../segments/resamplePolyline";
import { computeCumulativeTrackDistance, nearestByDistance } from "../segments/cumulativeTrackDistance";
import { nudgePin, placePin, xToDistance, zoomWindow, ZOOM_RETURN_MS, type EditMode } from "../segments/segmentEditView";
import { nearestTrackPointByLatLng } from "../segments/nearestTrackPoint";
import type { RidesStackParamList, RootTabParamList } from "../navigation/types";
import {
  AppText,
  Button,
  ScreenScroll,
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  SegmentedControl,
  TextField,
} from "../theme/components";
import { radius, spacing } from "../theme/spacing";
import { useColors } from "../theme/useColors";
import { formatDistanceMiles } from "./formatRideStats";
import { RouteMapView } from "./RouteMapView";
import { Icon } from "../theme/Icon";
import { RideElevationChart, type RideElevationChartRange } from "./RideElevationChart";

/** Fixed per docs/MVP.md's "Segment definition" contract -- not yet user-configurable. */
const RESAMPLE_INTERVAL_METERS = 10;
const CORRIDOR_METERS = 30;
const REQUIRED_COVERAGE_PCT = 0.9;
const SCHEMA_VERSION = 1;

const generateId = () => Crypto.randomUUID();

type DefineSegmentRoute = RouteProp<RidesStackParamList, "DefineSegment">;
type DefineSegmentNavigation = NativeStackNavigationProp<RidesStackParamList, "DefineSegment">;

export function DefineSegmentScreen() {
  const database = useDatabase();
  const route = useRoute<DefineSegmentRoute>();
  const navigation = useNavigation<DefineSegmentNavigation>();

  const palette = useColors();
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [track, setTrack] = useState<RideTrackPoint[]>([]);
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [saveError, setSaveError] = useState<string | undefined>(undefined);
  const [name, setName] = useState("");
  const [startDistanceMeters, setStartDistanceMeters] = useState(0);
  const [endDistanceMeters, setEndDistanceMeters] = useState<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  // Start and Finish are modes: only the open mode shows its distance and arrows, and a map tap or an
  // elevation touch moves that mode's pin. The other mode folds to one line.
  const [activeHandle, setActiveHandle] = useState<EditMode>("start");
  // While the rider drags or steps a pin the elevation chart zooms to it; three seconds after the last touch it
  // returns to the whole ride.
  const [zoomCenterMeters, setZoomCenterMeters] = useState<number | undefined>(undefined);
  const zoomTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Bumped by the locate button so the map recentres on the open pin.
  const [recenterSignal, setRecenterSignal] = useState(0);
  const [chartWidth, setChartWidth] = useState(0);

  const loadTrack = useCallback(() => {
    try {
      setTrack(getRideTrack(database, route.params.rideId));
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, [database, route.params.rideId]);

  useEffect(loadTrack, [loadTrack]);

  const distanceIndexed = useMemo(() => computeCumulativeTrackDistance(track), [track]);
  const totalDistanceMeters = distanceIndexed.at(-1)?.distanceMeters ?? 0;

  useEffect(() => {
    if (totalDistanceMeters > 0 && endDistanceMeters === undefined) {
      setEndDistanceMeters(totalDistanceMeters);
    }
  }, [totalDistanceMeters, endDistanceMeters]);

  const resolvedEndDistanceMeters = endDistanceMeters ?? totalDistanceMeters;
  const startPoint = nearestByDistance(distanceIndexed, startDistanceMeters);
  const endPoint = nearestByDistance(distanceIndexed, resolvedEndDistanceMeters);
  const highlightRange =
    startPoint !== undefined && endPoint !== undefined
      ? { startPointIndex: startPoint.pointIndex, endPointIndex: endPoint.pointIndex }
      : undefined;

  useEffect(() => () => clearTimeout(zoomTimer.current), []);

  function applyRange(range: { startDistanceMeters: number; endDistanceMeters: number }, mode: EditMode) {
    setStartDistanceMeters(range.startDistanceMeters);
    setEndDistanceMeters(range.endDistanceMeters);
    setZoomCenterMeters(mode === "start" ? range.startDistanceMeters : range.endDistanceMeters);
    clearTimeout(zoomTimer.current);
    zoomTimer.current = setTimeout(() => setZoomCenterMeters(undefined), ZOOM_RETURN_MS);
  }

  const currentRange = { startDistanceMeters, endDistanceMeters: resolvedEndDistanceMeters };
  const zoomed = zoomCenterMeters === undefined ? undefined : zoomWindow(zoomCenterMeters, totalDistanceMeters);
  const chartDomain = zoomed ?? { startDistanceMeters: 0, endDistanceMeters: totalDistanceMeters };

  function handleMapTap(latLng: { lat: number; lng: number }) {
    const nearest = nearestTrackPointByLatLng(distanceIndexed, latLng);
    if (nearest === undefined) return;
    applyRange(placePin(activeHandle, nearest.distanceMeters, currentRange, totalDistanceMeters), activeHandle);
  }

  // Touching or dragging the elevation chart puts the open pin under the finger.
  const chartPan = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => touchChart(event.nativeEvent.locationX),
    onPanResponderMove: (event) => touchChart(event.nativeEvent.locationX),
  });
  const touchChartRef = useRef<(x: number) => void>(() => {});
  function touchChart(x: number) {
    touchChartRef.current(x);
  }
  touchChartRef.current = (x: number) => {
    applyRange(placePin(activeHandle, xToDistance(x, chartWidth, chartDomain), currentRange, totalDistanceMeters), activeHandle);
  };

  async function handleSave() {
    setSaveError(undefined);
    if (name.trim().length === 0) {
      setNameError("Give this segment a name before saving.");
      return;
    }
    if (startPoint === undefined || endPoint === undefined || startPoint.pointIndex >= endPoint.pointIndex) {
      setSaveError("The stretch you picked is too short to be a segment. Move the Start and Finish further apart.");
      return;
    }

    setSaving(true);
    try {
      const selectedPoints = distanceIndexed.filter(
        (point) => point.pointIndex >= startPoint.pointIndex && point.pointIndex <= endPoint.pointIndex,
      );
      const referencePolyline = resamplePolyline(selectedPoints, RESAMPLE_INTERVAL_METERS);
      const fingerprint = await computeSegmentFingerprint({
        corridorMeters: CORRIDOR_METERS,
        requiredCoveragePct: REQUIRED_COVERAGE_PCT,
        referencePolyline,
      });

      const { segmentId } = insertSegment(database, generateId, {
        name: name.trim(),
        corridorMeters: CORRIDOR_METERS,
        requiredCoveragePct: REQUIRED_COVERAGE_PCT,
        schemaVersion: SCHEMA_VERSION,
        fingerprint,
        referencePolyline,
        sourceRideId: route.params.rideId,
        sourceStartPointIndex: startPoint.pointIndex,
        sourceEndPointIndex: endPoint.pointIndex,
        nowMs: Date.now(),
      });

      runMatcherForSegment(database, generateId, segmentId, Date.now());

      // Cross-stack: DefineSegment lives in the Rides stack, SegmentDetail in the Segments
      // stack -- a same-stack navigation.navigate("SegmentDetail") wouldn't type-check (it
      // isn't a route in RidesStackParamList) and wouldn't work at runtime either. Reach the
      // root tab navigator via getParent() and navigate through it instead.
      navigation.popToTop();
      navigation
        .getParent<BottomTabNavigationProp<RootTabParamList>>()
        ?.navigate("SegmentsTab", { screen: SEGMENT_PAGE_ENABLED ? "SegmentPage" : "SegmentDetail", initial: false, params: { segmentId } });
    } catch (error) {
      setSaveError(`GritMap couldn't save this segment. ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSaving(false);
    }
  }

  if (loadState === "loading") {
    return (
      <ScreenScroll>
        <LoadingState label="Loading your ride…" />
      </ScreenScroll>
    );
  }
  if (loadState === "error") {
    return <ErrorState message="GritMap couldn't read this ride. Go back and try again." onRetry={loadTrack} />;
  }
  if (totalDistanceMeters <= 0) {
    return (
      <EmptyState
        icon="mapPin"
        title="This ride can't make a segment"
        body="A segment needs a GPS track, and this ride doesn't have one. Pick a ride that was recorded with GPS."
      />
    );
  }

  const selectedLengthMeters = resolvedEndDistanceMeters - startDistanceMeters;
  const miles = (meters: number) => formatDistanceMiles(meters);

  return (
    <ScreenScroll padded={false}>
      <View style={[styles.mapContainer, { backgroundColor: palette.surface }]}>
        <RouteMapView
          points={track}
          highlightRange={highlightRange}
          recenterSignal={recenterSignal}
          editableRange={
            startPoint !== undefined && endPoint !== undefined
              ? {
                  startLatLng: startPoint,
                  endLatLng: endPoint,
                  activeHandle,
                  onSelectHandle: setActiveHandle,
                  onMapTap: handleMapTap,
                }
              : undefined
          }
        />
        <Pressable
          onPress={() => setRecenterSignal((n) => n + 1)}
          accessibilityRole="button"
          accessibilityLabel={`Centre the map on the ${activeHandle === "start" ? "start" : "finish"}`}
          style={[styles.locate, { backgroundColor: palette.surface, borderColor: palette.border }]}
        >
          <Icon name="mapPin" color="ctaText" size={22} />
        </Pressable>
      </View>

      <View style={styles.panel}>
        <SegmentedControl
          accessibilityLabel="Which end of the segment to move"
          options={[
            { value: "start", label: "Start", accessibilityLabel: "Move the start" },
            { value: "end", label: "Finish", accessibilityLabel: "Move the finish" },
          ]}
          value={activeHandle}
          onChange={setActiveHandle}
        />

        <View
          style={styles.chartBox}
          onLayout={(event: LayoutChangeEvent) => setChartWidth(event.nativeEvent.layout.width)}
          {...chartPan.panHandlers}
          accessible={false}
        >
          <RideElevationChart points={distanceIndexed} selectedRange={currentRange} visibleRange={zoomed} />
        </View>

        {activeHandle === "start" ? (
          <PinRow
            label="Start"
            valueLabel={miles(startDistanceMeters)}
            showArrows
            onNudge={(direction) => applyRange(nudgePin("start", direction, currentRange, totalDistanceMeters), "start")}
          />
        ) : (
          <PinRow label="Start" valueLabel={miles(startDistanceMeters)} onOpen={() => setActiveHandle("start")} />
        )}
        {activeHandle === "end" ? (
          <PinRow
            label="Finish"
            valueLabel={miles(resolvedEndDistanceMeters)}
            showArrows
            onNudge={(direction) => applyRange(nudgePin("end", direction, currentRange, totalDistanceMeters), "end")}
          />
        ) : (
          <PinRow label="Finish" valueLabel={miles(resolvedEndDistanceMeters)} onOpen={() => setActiveHandle("end")} />
        )}
        <AppText variant="subheadline" color="textSecondary" accessibilityLiveRegion="polite">
          Segment length: {formatDistanceMiles(selectedLengthMeters)}
        </AppText>

        <TextField
          label="Segment name"
          value={name}
          onChangeText={(value) => {
            setName(value);
            setNameError(undefined);
          }}
          placeholder="For example, Northgate climb"
          autoCapitalize="words"
          autoCorrect
          returnKeyType="done"
          {...(nameError === undefined ? {} : { error: nameError })}
        />
        {saveError === undefined ? null : (
          <Notice tone="error" live>
            {saveError}
          </Notice>
        )}
        <Button label="Save segment" onPress={handleSave} loading={saving} />
      </View>
    </ScreenScroll>
  );
}

/**
 * One end of the segment on one line. The open one shows its distance with earlier / later arrows; the other
 * folds to a single tappable line with no arrows.
 */
function PinRow({
  label,
  valueLabel,
  showArrows = false,
  onNudge,
  onOpen,
}: {
  label: string;
  valueLabel: string;
  showArrows?: boolean;
  onNudge?: (direction: -1 | 1) => void;
  onOpen?: () => void;
}) {
  const palette = useColors();
  const content = (
    <View style={[styles.pinRow, { borderColor: showArrows ? palette.ctaText : palette.border, backgroundColor: palette.surface }]}>
      <AppText variant={showArrows ? "headline" : "subheadline"} style={styles.pinLabel}>
        {label}
      </AppText>
      <AppText variant={showArrows ? "headline" : "subheadline"} color={showArrows ? "textPrimary" : "textSecondary"}>
        {valueLabel}
      </AppText>
      {showArrows ? (
        <View style={styles.arrows}>
          <Pressable onPress={() => onNudge?.(-1)} accessibilityRole="button" accessibilityLabel={`Move ${label.toLowerCase()} earlier`} style={styles.arrow}>
            <Icon name="chevronLeft" color="ctaText" size={22} />
          </Pressable>
          <Pressable onPress={() => onNudge?.(1)} accessibilityRole="button" accessibilityLabel={`Move ${label.toLowerCase()} later`} style={styles.arrow}>
            <Icon name="chevronRight" color="ctaText" size={22} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
  if (showArrows || onOpen === undefined) return content;
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${label} at ${valueLabel}. Edit ${label.toLowerCase()}.`}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mapContainer: { height: 340 },
  locate: { position: "absolute", top: spacing.space12, right: spacing.space12, width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  panel: { padding: spacing.space16, gap: spacing.space12 },
  chartBox: { minHeight: 140 },
  pinRow: { flexDirection: "row", alignItems: "center", gap: spacing.space12, minHeight: 44, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.space12 },
  pinLabel: { flex: 1 },
  arrows: { flexDirection: "row" },
  arrow: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
