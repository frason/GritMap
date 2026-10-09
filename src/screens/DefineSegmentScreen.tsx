import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import * as Crypto from "expo-crypto";
import { useDatabase } from "../db/DatabaseProvider";
import { getRideTrack, type RideTrackPoint } from "../db/getRideTrack";
import { insertSegment } from "../db/insertSegment";
import { runMatcherForSegment } from "../matcher/runMatcher";
import { computeSegmentFingerprint } from "../segments/segmentFingerprint";
import { resamplePolyline } from "../segments/resamplePolyline";
import { computeCumulativeTrackDistance, nearestByDistance } from "../segments/cumulativeTrackDistance";
import { clampRangeEnd, clampRangeStart } from "../segments/clampSegmentRange";
import { nearestTrackPointByLatLng } from "../segments/nearestTrackPoint";
import { computeVisibleDistanceRange } from "../segments/computeVisibleDistanceRange";
import type { RidesStackParamList, RootTabParamList } from "../navigation/types";
import {
  AppText,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  ScreenScroll,
  SegmentedControl,
  Section,
  TextField,
} from "../theme/components";
import { radius, spacing } from "../theme/spacing";
import { useColors } from "../theme/useColors";
import { formatDistanceMiles } from "./formatRideStats";
import { RouteMapView } from "./RouteMapView";
import { DistanceRangeScrubber } from "./DistanceRangeScrubber";
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
  // Which pin the next map tap moves (issue #58) -- tapping a pin also selects it. Shown as
  // "Start"/"Finish" tabs at the top of the screen; only the active tab's pin responds to a
  // map tap.
  const [activeHandle, setActiveHandle] = useState<"start" | "end">("start");
  // Zooms RideElevationChart to match the map's own zoom -- undefined (full ride) until the
  // user pans/zooms the map at least once.
  const [visibleRange, setVisibleRange] = useState<RideElevationChartRange | undefined>(undefined);

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

  function handleRangeChange(range: { startDistanceMeters: number; endDistanceMeters: number }) {
    setStartDistanceMeters(range.startDistanceMeters);
    setEndDistanceMeters(range.endDistanceMeters);
  }

  function handleViewportChange(bounds: { west: number; south: number; east: number; north: number }) {
    const range = computeVisibleDistanceRange(distanceIndexed, bounds);
    // Panned away from the route entirely -- keep whatever range the chart last showed
    // rather than collapsing it to nothing.
    if (range !== undefined) {
      setVisibleRange({ startDistanceMeters: range.minDistanceMeters, endDistanceMeters: range.maxDistanceMeters });
    }
  }

  function handleMapTap(latLng: { lat: number; lng: number }) {
    const nearest = nearestTrackPointByLatLng(distanceIndexed, latLng);
    if (nearest === undefined) return;
    if (activeHandle === "start") {
      setStartDistanceMeters(clampRangeStart(nearest.distanceMeters, resolvedEndDistanceMeters));
    } else {
      setEndDistanceMeters(clampRangeEnd(nearest.distanceMeters, startDistanceMeters, totalDistanceMeters));
    }
  }

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
        ?.navigate("SegmentsTab", { screen: "SegmentDetail", params: { segmentId } });
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
  const handleLabel = activeHandle === "start" ? "Start" : "Finish";

  return (
    <ScreenScroll>
      <Card>
        <AppText variant="headline">Pick the part of this ride to track</AppText>
        <AppText variant="subheadline" color="textSecondary">
          A segment is a stretch of road you want to ride again, like one climb. Choose where it starts and where it finishes.
          GritMap then looks for it in all your rides and keeps your times.
        </AppText>
      </Card>

      <Section title="1. Choose the Start or the Finish">
        <SegmentedControl
          accessibilityLabel="Which end of the segment to move"
          options={[
            { value: "start", label: "Start", accessibilityLabel: "Move the start" },
            { value: "end", label: "Finish", accessibilityLabel: "Move the finish" },
          ]}
          value={activeHandle}
          onChange={setActiveHandle}
        />
      </Section>

      <Section
        title="2. Tap the map"
        description={`Tap the route on the map to put the ${handleLabel.toLowerCase()} there. You can pinch to zoom in first.`}
      >
        <View
          style={[styles.mapContainer, { backgroundColor: palette.surface, borderColor: palette.border }]}
        >
          <RouteMapView
            points={track}
            highlightRange={highlightRange}
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
            onViewportChange={handleViewportChange}
          />
        </View>
        <RideElevationChart
          points={distanceIndexed}
          selectedRange={{ startDistanceMeters, endDistanceMeters: resolvedEndDistanceMeters }}
          visibleRange={visibleRange}
        />
      </Section>

      <Section title="Or drag the handles" description="Fine-tune the start and finish. The highlighted part of the chart is your segment.">
        <DistanceRangeScrubber
          totalDistanceMeters={totalDistanceMeters}
          startDistanceMeters={startDistanceMeters}
          endDistanceMeters={resolvedEndDistanceMeters}
          onChange={handleRangeChange}
          elevationAtDistance={(distanceMeters) => nearestByDistance(distanceIndexed, distanceMeters)?.elevationMeters}
        />
        <AppText variant="subheadline" accessibilityLiveRegion="polite">
          Segment length: {formatDistanceMiles(selectedLengthMeters)}
        </AppText>
      </Section>

      <Section title="3. Name it and save">
        <TextField
          label="Segment name"
          value={name}
          onChangeText={(value) => {
            setName(value);
            setNameError(undefined);
          }}
          placeholder="For example, Northgate climb"
          hint="Pick something you will recognise in your list."
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
      </Section>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    height: 260,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
});
