import { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
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
import { colors } from "../theme/colors";
import { radius, spacing } from "../theme/spacing";
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

  const [track, setTrack] = useState<RideTrackPoint[]>([]);
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

  useEffect(() => {
    setTrack(getRideTrack(database, route.params.rideId));
  }, [database, route.params.rideId]);

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
    if (name.trim().length === 0) {
      Alert.alert("Name required", "Give this segment a name before saving.");
      return;
    }
    if (startPoint === undefined || endPoint === undefined || startPoint.pointIndex >= endPoint.pointIndex) {
      Alert.alert("Invalid range", "The selected range is too short to save as a segment.");
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
      Alert.alert("Couldn't save segment", error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {totalDistanceMeters > 0 && (
          <View style={styles.tabRow}>
            <HandleTab
              label="Start"
              active={activeHandle === "start"}
              onPress={() => setActiveHandle("start")}
            />
            <HandleTab
              label="Finish"
              active={activeHandle === "end"}
              onPress={() => setActiveHandle("end")}
            />
          </View>
        )}
        {totalDistanceMeters > 0 && (
          <Text style={styles.mapHint}>
            Tap the map to move the {activeHandle === "start" ? "start" : "finish"} point --
            only {activeHandle === "start" ? "start" : "finish"} can be changed on this tab.
          </Text>
        )}

        <View style={styles.mapContainer}>
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

        {totalDistanceMeters > 0 && (
          <RideElevationChart
            points={distanceIndexed}
            selectedRange={{ startDistanceMeters, endDistanceMeters: resolvedEndDistanceMeters }}
            visibleRange={visibleRange}
          />
        )}

        {totalDistanceMeters > 0 && (
          <DistanceRangeScrubber
            totalDistanceMeters={totalDistanceMeters}
            startDistanceMeters={startDistanceMeters}
            endDistanceMeters={resolvedEndDistanceMeters}
            onChange={handleRangeChange}
            elevationAtDistance={(distanceMeters) =>
              nearestByDistance(distanceIndexed, distanceMeters)?.elevationMeters
            }
          />
        )}

        <TextInput
          style={styles.nameInput}
          placeholder="Segment name"
          placeholderTextColor={colors.textTertiary}
          value={name}
          onChangeText={setName}
        />

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonLabel}>{saving ? "Saving…" : "Save Segment"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function HandleTab({
  label,
  active,
  onPress,
}: {
  label: "Start" | "Finish";
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.tab, active && styles.tabActive]}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={`Edit ${label}`}
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.space20,
    gap: spacing.space20,
  },
  mapContainer: {
    height: 260,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.space4,
    gap: spacing.space4,
  },
  tab: {
    flex: 1,
    borderRadius: radius.md - 2,
    paddingVertical: spacing.space8 + 2,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: colors.brand,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  tabLabelActive: {
    color: colors.textOnBrand,
  },
  mapHint: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  nameInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.space16,
    paddingVertical: spacing.space12,
    fontSize: 15,
    color: colors.textPrimary,
  },
  saveButton: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: spacing.space12,
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonLabel: {
    color: colors.textOnBrand,
    fontSize: 15,
    fontWeight: "600",
  },
});
