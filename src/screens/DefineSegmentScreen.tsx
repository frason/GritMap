import { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Crypto from "expo-crypto";
import { useDatabase } from "../db/DatabaseProvider";
import { getRideTrack, type RideTrackPoint } from "../db/getRideTrack";
import { insertSegment } from "../db/insertSegment";
import { computeSegmentFingerprint } from "../segments/segmentFingerprint";
import { resamplePolyline } from "../segments/resamplePolyline";
import { computeCumulativeTrackDistance, nearestByDistance } from "../segments/cumulativeTrackDistance";
import type { RidesStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { radius, spacing } from "../theme/spacing";
import { RouteMapView } from "./RouteMapView";
import { DistanceRangeScrubber } from "./DistanceRangeScrubber";

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

      insertSegment(database, generateId, {
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

      navigation.popToTop();
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
        <View style={styles.mapContainer}>
          <RouteMapView points={track} highlightRange={highlightRange} />
        </View>

        {totalDistanceMeters > 0 && (
          <DistanceRangeScrubber
            totalDistanceMeters={totalDistanceMeters}
            startDistanceMeters={startDistanceMeters}
            endDistanceMeters={resolvedEndDistanceMeters}
            onChange={(range) => {
              setStartDistanceMeters(range.startDistanceMeters);
              setEndDistanceMeters(range.endDistanceMeters);
            }}
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
