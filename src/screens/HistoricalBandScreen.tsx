import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { SegmentAttempt } from "../comparison/compareAttempts";
import { computeHistoricalBand, type HistoricalBandSample } from "../comparison/computeHistoricalBand";
import { useDatabase } from "../db/DatabaseProvider";
import { getAttemptDetail } from "../db/getAttemptDetail";
import { getAttemptTrack } from "../db/getAttemptTrack";
import { listAttemptsForSegment } from "../db/listAttemptsForSegment";
import type { RootTabParamList, SegmentsStackParamList } from "../navigation/types";
import { AppText, Card, EmptyState, ErrorState, LoadingState, Notice, ScreenScroll } from "../theme/components";
import { ChannelChart, type ChannelSeriesPoint } from "./ChannelChart";

type HistoricalBandRoute = RouteProp<SegmentsStackParamList, "HistoricalBand">;
type Navigation = NativeStackNavigationProp<SegmentsStackParamList, "HistoricalBand">;

/** A band needs at least this many efforts to say anything about a range. */
const MIN_EFFORTS_FOR_BAND = 3;

/**
 * Progress over time on one segment: for power, heart rate and elevation, the shaded band is the
 * range (lowest to highest) across all of the rider's efforts at each point along the segment, and
 * the dark line is the effort they came from. Needs three efforts before a range means anything.
 */
export function HistoricalBandScreen() {
  const database = useDatabase();
  const route = useRoute<HistoricalBandRoute>();
  const navigation = useNavigation<Navigation>();
  const [attempts, setAttempts] = useState<SegmentAttempt[] | "error" | undefined>(undefined);

  const load = useCallback(() => {
    try {
      const summaries = listAttemptsForSegment(database, route.params.segmentId).filter(
        (attempt) => attempt.decision === "accept" || attempt.manuallyApproved,
      );
      const loaded = summaries.flatMap((summary): SegmentAttempt[] => {
        const detail = getAttemptDetail(database, summary.attemptId);
        if (detail === undefined) return [];
        return [
          {
            id: detail.attemptId,
            segmentId: detail.segmentId,
            rideId: detail.rideId,
            startTimestampMs: detail.startTimestampMs,
            endTimestampMs: detail.endTimestampMs,
            points: getAttemptTrack(database, detail.rideId, detail.startPointIndex, detail.endPointIndex),
          },
        ];
      });
      setAttempts(loaded);
    } catch {
      setAttempts("error");
    }
  }, [database, route.params.segmentId]);

  useEffect(load, [load]);

  const bands = useMemo(
    () =>
      attempts === undefined || attempts === "error" || attempts.length < MIN_EFFORTS_FOR_BAND
        ? undefined
        : {
            power: computeHistoricalBand(attempts, route.params.currentAttemptId, "power"),
            heartRate: computeHistoricalBand(attempts, route.params.currentAttemptId, "heartRate"),
            elevation: computeHistoricalBand(attempts, route.params.currentAttemptId, "elevationMeters"),
          },
    [attempts, route.params.currentAttemptId],
  );

  if (attempts === undefined) {
    return (
      <ScreenScroll>
        <LoadingState label="Loading your efforts…" />
      </ScreenScroll>
    );
  }

  if (attempts === "error") {
    return (
      <ErrorState
        title="Couldn't load your efforts"
        message="GritMap couldn't read the rides for this segment. Go back and try again."
        onRetry={load}
      />
    );
  }

  if (bands === undefined) {
    return (
      <EmptyState
        icon="pulse"
        title="Not enough efforts yet"
        body={`Progress over time needs at least ${MIN_EFFORTS_FOR_BAND} efforts on this segment. You have ${attempts.length} so far. Import more rides that go over it and this screen fills in.`}
        actions={[
          {
            label: "Import a ride",
            icon: "download",
            onPress: () =>
              navigation.getParent<BottomTabNavigationProp<RootTabParamList>>()?.navigate("RidesTab", { screen: "Import" }),
          },
        ]}
      />
    );
  }

  return (
    <ScreenScroll>
      <AppText variant="subheadline" color="textSecondary">
        The shaded band shows the range across all {attempts.length} of your efforts on this segment: the highest and lowest
        at each point. The dark line is the effort you opened this from.
      </AppText>
      <BandSection title="Power" unit="W" band={bands.power} />
      <BandSection title="Heart rate" unit="bpm" band={bands.heartRate} />
      <BandSection title="Elevation" unit="m" band={bands.elevation} />
    </ScreenScroll>
  );
}

function BandSection({ title, unit, band }: { title: string; unit: string; band: HistoricalBandSample[] }) {
  const hasAnyData = band.some((sample) => sample.min !== null || sample.current !== null);
  const series: ChannelSeriesPoint[] = band.map((sample) => ({
    distanceMeters: sample.distanceMeters,
    primary: sample.max,
    comparison: sample.min,
    current: sample.current,
  }));

  if (!hasAnyData) return <Notice tone="info">{`${title}: no data was recorded in these efforts.`}</Notice>;

  return (
    <Card>
      <ChannelChart
        title={title}
        unit={unit}
        series={series}
        primaryLabel="Highest"
        comparisonLabel="Lowest"
        currentLabel="This effort"
      />
    </Card>
  );
}
