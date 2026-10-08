import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useDatabase } from "../db/DatabaseProvider";
import { getRideDetail, type RideDetail } from "../db/getRideDetail";
import { getRideTrack, type RideTrackPoint } from "../db/getRideTrack";
import { listAttemptsForRide, type RideAttemptSummary } from "../db/listAttemptsForRide";
import type { RidesStackParamList, RootTabParamList } from "../navigation/types";
import { AppText, Button, Card, ErrorState, ListRow, LoadingState, ScreenScroll, Section, StatRow, StatTile } from "../theme/components";
import { radius, spacing } from "../theme/spacing";
import { useColors } from "../theme/useColors";
import { RouteMapView } from "./RouteMapView";
import {
  formatDistanceMiles,
  formatDurationHoursMinutes,
  formatElevationFeet,
  formatRideDate,
} from "./formatRideStats";

type DetailRoute = RouteProp<RidesStackParamList, "RideDetail">;
type DetailNavigation = NativeStackNavigationProp<RidesStackParamList, "RideDetail">;

type LoadState = "loading" | "ready" | "missing" | "error";

export function RideDetailScreen() {
  const database = useDatabase();
  const route = useRoute<DetailRoute>();
  const navigation = useNavigation<DetailNavigation>();
  const palette = useColors();
  const [state, setState] = useState<LoadState>("loading");
  const [ride, setRide] = useState<RideDetail | undefined>(undefined);
  const [track, setTrack] = useState<RideTrackPoint[]>([]);
  const [attempts, setAttempts] = useState<RideAttemptSummary[]>([]);

  const load = useCallback(() => {
    try {
      const detail = getRideDetail(database, route.params.rideId);
      setRide(detail);
      if (detail === undefined) {
        setState("missing");
        return;
      }
      setTrack(getRideTrack(database, route.params.rideId));
      setAttempts(listAttemptsForRide(database, route.params.rideId));
      setState("ready");
    } catch {
      setState("error");
    }
  }, [database, route.params.rideId]);

  useFocusEffect(load);

  function openAttemptReview(attemptId: string) {
    navigation
      .getParent<BottomTabNavigationProp<RootTabParamList>>()
      ?.navigate("SegmentsTab", { screen: "AttemptReview", params: { attemptId } });
  }

  if (state === "loading") {
    return (
      <ScreenScroll>
        <LoadingState label="Loading ride…" />
      </ScreenScroll>
    );
  }
  if (state === "error") {
    return <ErrorState title="Couldn't open this ride" message="GritMap couldn't read this ride. Go back and try again." onRetry={load} />;
  }
  if (state === "missing" || ride === undefined) {
    return <ErrorState title="This ride is no longer available" message="It may have been removed. Go back to your rides and pick another." />;
  }

  const canCreateSegment = track.length >= 2;

  return (
    <ScreenScroll>
      <View style={styles.heading}>
        <AppText variant="title2" accessibilityRole="header">
          {ride.startTimestampMs !== undefined ? formatRideDate(ride.startTimestampMs) : "Ride"}
        </AppText>
        <AppText variant="subheadline" color="textSecondary">
          Imported from {ride.originalFilename}
        </AppText>
      </View>

      <StatRow>
        <StatTile value={formatDistanceMiles(ride.totalDistanceMeters)} label="Distance" />
        <StatTile value={formatDurationHoursMinutes(ride.durationMs)} label="Duration" />
        <StatTile value={formatElevationFeet(ride.totalAscentMeters)} label="Elevation" />
      </StatRow>

      <Section title="Route">
        <View
          accessible
          accessibilityLabel="Map of this ride's route"
          style={[styles.routeMap, { backgroundColor: palette.surface, borderColor: palette.border }]}
        >
          <RouteMapView points={track} />
        </View>
      </Section>

      <Section
        title="Segments found in this ride"
        description="A segment is a stretch of road you want to ride again and track. GritMap looks for your segments in every ride you import."
      >
        {attempts.length === 0 ? (
          <Card>
            <AppText variant="headline">No segments found yet</AppText>
            <AppText variant="subheadline" color="textSecondary">
              None of your segments overlap this ride. Create one from this ride below, or open Open Segments on the Segments tab
              to add one that others have shared.
            </AppText>
          </Card>
        ) : (
          <View>
            {attempts.map((attempt) => {
              const confirmed = attempt.manuallyApproved || attempt.decision === "accept";
              return (
                <ListRow
                  key={attempt.attemptId}
                  icon={confirmed ? "checkCircle" : "alertTriangle"}
                  title={attempt.segmentName}
                  subtitle={`${formatDurationHoursMinutes(attempt.endTimestampMs - attempt.startTimestampMs)} · ${
                    confirmed ? (attempt.manuallyApproved ? "Approved by you" : "Matched") : "Needs your review"
                  } · ${Math.round(attempt.confidenceScore * 100)}% match`}
                  onPress={() => openAttemptReview(attempt.attemptId)}
                  accessibilityHint="Opens the details of this effort"
                />
              );
            })}
          </View>
        )}
      </Section>

      <Button
        label="Create a segment from this ride"
        onPress={() => navigation.navigate("DefineSegment", { rideId: route.params.rideId })}
        disabled={!canCreateSegment}
        {...(canCreateSegment ? {} : { accessibilityHint: "Not available: this ride has no usable GPS data" })}
      />
      {canCreateSegment ? null : (
        <AppText variant="footnote" color="textSecondary" align="center">
          This ride has no usable GPS data, so a segment can't be created from it.
        </AppText>
      )}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  heading: { gap: spacing.space4 },
  routeMap: { height: 220, borderRadius: radius.lg, borderWidth: 1, overflow: "hidden" },
});
