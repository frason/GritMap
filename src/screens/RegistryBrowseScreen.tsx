import { useCallback, useRef, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Crypto from "expo-crypto";
import { useDatabase } from "../db/DatabaseProvider";
import { importRegistrySegment } from "../db/importRegistrySegment";
import { defaultRegistryConfig } from "../registry/registryConfig";
import { describeRegistryError, registryErrorKind } from "../registry/describeRegistryError";
import { fetchRegistrySegment, listRegistrySegments, type RegistryEntry } from "../registry/registryClient";
import { summarizeRegistrySegment, type RegistrySegmentSummary } from "../registry/summarizeRegistrySegment";
import type { SegmentsStackParamList } from "../navigation/types";
import { AppText, Button, Card, EmptyState, ErrorState, LoadingState, Notice, ScreenScroll } from "../theme/components";
import { spacing } from "../theme/spacing";
import { useColors } from "../theme/useColors";
import { formatDistanceMiles, formatElevationFeet } from "./formatRideStats";

type Navigation = NativeStackNavigationProp<SegmentsStackParamList>;

const generateId = () => Crypto.randomUUID();

/** Segment files are fetched to read their names; cap it so a very large registry cannot flood the phone. */
const MAX_DETAILS_TO_LOAD = 60;

type RowStatus = { kind: "idle" } | { kind: "importing" } | { kind: "error"; message: string };
type SummaryState = RegistrySegmentSummary | "unreadable" | "unavailable";

/**
 * Open Segments: segments other riders have shared, free for anyone. The registry itself is just a
 * folder of files named by fingerprint, so each file is read to show its real name, length and
 * climbing; a rider never sees the fingerprint.
 */
export function RegistryBrowseScreen() {
  const database = useDatabase();
  const navigation = useNavigation<Navigation>();
  const palette = useColors();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<{ message: string; kind: ReturnType<typeof registryErrorKind> } | undefined>(undefined);
  const [entries, setEntries] = useState<RegistryEntry[]>([]);
  const [summaries, setSummaries] = useState<Record<string, SummaryState>>({});
  const [owned, setOwned] = useState<Record<string, string>>({});
  const [rowStatus, setRowStatus] = useState<Record<string, RowStatus>>({});
  // The fetched segment files, kept so adding one does not download it a second time.
  const fetchedRaw = useRef<Record<string, unknown>>({});

  const refresh = useCallback(
    (pulled = false) => {
      if (pulled) setRefreshing(true);
      else setLoading(true);
      setLoadError(undefined);
      try {
        const rows = database.prepare("SELECT id, fingerprint FROM segments").all() as { id: string; fingerprint: string }[];
        setOwned(Object.fromEntries(rows.map((row) => [row.fingerprint, row.id])));
      } catch {
        setOwned({});
      }
      listRegistrySegments(defaultRegistryConfig()).then((result) => {
        setLoading(false);
        setRefreshing(false);
        if (!result.ok) {
          const failure = { ...(result.statusCode === undefined ? {} : { statusCode: result.statusCode }), ...(result.message === undefined ? {} : { message: result.message }) };
          setLoadError({ message: describeRegistryError(failure), kind: registryErrorKind(failure) });
          return;
        }
        setEntries(result.entries);
        setSummaries({});
        for (const entry of result.entries.slice(0, MAX_DETAILS_TO_LOAD)) {
          fetchRegistrySegment(defaultRegistryConfig(), entry.fingerprint).then((fetched) => {
            if (fetched.ok) fetchedRaw.current[entry.fingerprint] = fetched.segment;
            const state: SummaryState = !fetched.ok ? "unavailable" : (summarizeRegistrySegment(fetched.segment) ?? "unreadable");
            setSummaries((current) => ({ ...current, [entry.fingerprint]: state }));
          });
        }
      });
    },
    [database],
  );

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  function fail(entry: RegistryEntry, statusCode: number | undefined, message: string | undefined) {
    setRowStatus((current) => ({
      ...current,
      [entry.fingerprint]: {
        kind: "error",
        message: describeRegistryError({
          ...(statusCode === undefined ? {} : { statusCode }),
          ...(message === undefined ? {} : { message }),
        }),
      },
    }));
  }

  async function handleAdd(entry: RegistryEntry) {
    setRowStatus((current) => ({ ...current, [entry.fingerprint]: { kind: "importing" } }));

    let raw = fetchedRaw.current[entry.fingerprint];
    if (raw === undefined) {
      const fetched = await fetchRegistrySegment(defaultRegistryConfig(), entry.fingerprint);
      if (!fetched.ok) {
        fail(entry, fetched.statusCode, fetched.message);
        return;
      }
      raw = fetched.segment;
    }

    const result = await importRegistrySegment(database, generateId, raw, Date.now());
    if (result.status === "invalid") {
      setRowStatus((current) => ({
        ...current,
        [entry.fingerprint]: { kind: "error", message: "This segment's file is damaged, so it can't be added." },
      }));
      return;
    }

    setRowStatus((current) => ({ ...current, [entry.fingerprint]: { kind: "idle" } }));
    setOwned((current) => ({ ...current, [entry.fingerprint]: result.segmentId }));
    navigation.navigate("SegmentDetail", { segmentId: result.segmentId });
  }

  if (loading) {
    return (
      <ScreenScroll>
        <LoadingState label="Loading Open Segments…" />
      </ScreenScroll>
    );
  }

  if (loadError !== undefined) {
    const offline = loadError.kind === "offline";
    return (
      <ErrorState
        title={offline ? "You're offline" : loadError.kind === "busy" ? "Open Segments is busy" : "Couldn't load Open Segments"}
        message={loadError.message}
        onRetry={() => refresh()}
      />
    );
  }

  // Files that turned out not to be readable segments are left out rather than shown as blank rows.
  const visible = entries.filter((entry) => summaries[entry.fingerprint] !== "unreadable" && summaries[entry.fingerprint] !== "unavailable");
  const checked = Object.keys(summaries).length;
  const unavailable = entries.filter((entry) => summaries[entry.fingerprint] === "unavailable").length;
  const stillLoading = checked < Math.min(entries.length, MAX_DETAILS_TO_LOAD);

  if (entries.length === 0 || (visible.length === 0 && !stillLoading && unavailable === 0)) {
    return (
      <EmptyState
        icon="mapPin"
        title="No Open Segments yet"
        body="Segments that riders share will appear here. Open one of your own segments and choose Share to Open Segments to be the first."
      />
    );
  }

  const sorted = [...visible].sort((a, b) => {
    const left = summaries[a.fingerprint];
    const right = summaries[b.fingerprint];
    const leftName = typeof left === "object" ? left.name : undefined;
    const rightName = typeof right === "object" ? right.name : undefined;
    if (leftName === undefined || rightName === undefined) return leftName === undefined ? 1 : -1;
    return leftName.localeCompare(rightName);
  });

  return (
    <ScreenScroll refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => refresh(true)} tintColor={palette.brand} />}>
      <AppText variant="subheadline" color="textSecondary">
        Segments shared by other riders, free for anyone. Add one to your Segments to get a pacing plan for it and see your times on it.
      </AppText>

      {unavailable > 0 ? (
        <Card>
          <Notice tone="warning">
            {`${unavailable} ${unavailable === 1 ? "segment" : "segments"} couldn't be loaded. Check your connection and try again.`}
          </Notice>
          <Button label="Try again" variant="secondary" icon="refresh" onPress={() => refresh()} />
        </Card>
      ) : null}

      {sorted.map((entry) => {
        const summary = summaries[entry.fingerprint];
        const known = typeof summary === "object" ? summary : undefined;
        const status = rowStatus[entry.fingerprint] ?? { kind: "idle" };
        const segmentId = owned[entry.fingerprint];
        const name = known?.name ?? "Loading…";
        const facts = [
          known?.distanceMeters === undefined ? undefined : formatDistanceMiles(known.distanceMeters),
          known?.elevationGainMeters === undefined ? undefined : `${formatElevationFeet(known.elevationGainMeters)} climbing`,
        ].filter((part): part is string => part !== undefined);
        return (
          <Card key={entry.fingerprint}>
            <View style={styles.text} accessible accessibilityLabel={[name, ...facts, segmentId === undefined ? undefined : "Already in your segments"].filter(Boolean).join(", ")}>
              <AppText variant="headline">{name}</AppText>
              <AppText variant="subheadline" color="textSecondary">
                {facts.length === 0 ? "Shared by another rider" : `${facts.join(" · ")} · shared by another rider`}
              </AppText>
            </View>
            {status.kind === "error" ? <Notice tone="error" live>{status.message}</Notice> : null}
            {segmentId === undefined ? (
              <Button
                label="Add to my segments"
                variant="secondary"
                loading={status.kind === "importing"}
                disabled={known === undefined}
                onPress={() => handleAdd(entry)}
                accessibilityHint={`Adds ${name} to your segments`}
              />
            ) : (
              <Button
                label="Already added. Open it"
                variant="tertiary"
                onPress={() => navigation.navigate("SegmentDetail", { segmentId })}
                accessibilityHint={`Opens ${name}`}
              />
            )}
          </Card>
        );
      })}

      {stillLoading ? (
        <AppText variant="footnote" color="textSecondary" accessibilityLiveRegion="polite">
          Reading segment details…
        </AppText>
      ) : null}
      {entries.length > MAX_DETAILS_TO_LOAD ? (
        <AppText variant="footnote" color="textSecondary">
          {`Showing the first ${MAX_DETAILS_TO_LOAD} of ${entries.length} segments.`}
        </AppText>
      ) : null}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  text: { gap: spacing.space2 },
});
