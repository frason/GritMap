import { useCallback, useRef, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Crypto from "expo-crypto";
import { useDatabase } from "../db/DatabaseProvider";
import { importRegistrySegment } from "../db/importRegistrySegment";
import { defaultRegistryConfig } from "../registry/registryConfig";
import { describeRegistryError } from "../registry/describeRegistryError";
import { fetchRegistrySegment, listRegistrySegments, type RegistryEntry } from "../registry/registryClient";
import { summarizeRegistrySegment, type RegistrySegmentSummary } from "../registry/summarizeRegistrySegment";
import type { SegmentsStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { AppText, Button, EmptyState, ErrorState, LoadingState } from "../theme/components";
import { MIN_TOUCH_TARGET, SCREEN_PADDING } from "../theme/layout";
import { spacing } from "../theme/spacing";
import { formatDistanceMiles } from "./formatRideStats";

type Navigation = NativeStackNavigationProp<SegmentsStackParamList>;

const generateId = () => Crypto.randomUUID();

/** Segment files are fetched to read their names; cap it so a very large registry cannot flood the phone. */
const MAX_DETAILS_TO_LOAD = 60;

type RowStatus = { kind: "idle" } | { kind: "importing" } | { kind: "done"; message: string } | { kind: "error"; message: string };

/**
 * Open Segments: segments other riders have shared, free for anyone. The registry itself is just a
 * folder of files named by fingerprint, so each file is read to show its real name and length;
 * a rider never sees the fingerprint.
 */
export function RegistryBrowseScreen() {
  const database = useDatabase();
  const navigation = useNavigation<Navigation>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);
  const [entries, setEntries] = useState<RegistryEntry[]>([]);
  const [summaries, setSummaries] = useState<Record<string, RegistrySegmentSummary | "unreadable">>({});
  const [rowStatus, setRowStatus] = useState<Record<string, RowStatus>>({});
  // The fetched segment files, kept so adding one does not download it a second time.
  const fetchedRaw = useRef<Record<string, unknown>>({});

  const refresh = useCallback(() => {
    setLoading(true);
    setLoadError(undefined);
    listRegistrySegments(defaultRegistryConfig()).then((result) => {
      setLoading(false);
      if (!result.ok) {
        setLoadError(
          describeRegistryError({
            ...(result.statusCode === undefined ? {} : { statusCode: result.statusCode }),
            ...(result.message === undefined ? {} : { message: result.message }),
          }),
        );
        return;
      }
      setEntries(result.entries);
      for (const entry of result.entries.slice(0, MAX_DETAILS_TO_LOAD)) {
        fetchRegistrySegment(defaultRegistryConfig(), entry.fingerprint).then((fetched) => {
          const summary = fetched.ok ? summarizeRegistrySegment(fetched.segment) : undefined;
          if (fetched.ok) fetchedRaw.current[entry.fingerprint] = fetched.segment;
          setSummaries((current) => ({ ...current, [entry.fingerprint]: summary ?? "unreadable" }));
        });
      }
    });
  }, []);

  useFocusEffect(refresh);

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

    setRowStatus((current) => ({
      ...current,
      [entry.fingerprint]: { kind: "done", message: result.status === "already-imported" ? "Already in your segments" : "Added" },
    }));
    navigation.navigate("SegmentDetail", { segmentId: result.segmentId });
  }

  if (loading) return <LoadingState label="Loading Open Segments…" />;

  if (loadError !== undefined) {
    return <ErrorState title="Couldn't load Open Segments" message={loadError} onRetry={refresh} />;
  }

  // Files that turned out not to be readable segments are left out rather than shown as blank rows.
  const visible = entries.filter((entry) => summaries[entry.fingerprint] !== "unreadable");

  if (entries.length === 0 || (visible.length === 0 && Object.keys(summaries).length >= Math.min(entries.length, MAX_DETAILS_TO_LOAD))) {
    return (
      <EmptyState
        icon="mapPin"
        title="No Open Segments yet"
        body="Segments that riders share will appear here. Open one of your own segments and publish it from the menu to be the first."
      />
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.list}
      data={visible}
      keyExtractor={(entry) => entry.fingerprint}
      renderItem={({ item }) => {
        const summary = summaries[item.fingerprint];
        const known = summary !== undefined && summary !== "unreadable" ? summary : undefined;
        const status = rowStatus[item.fingerprint] ?? { kind: "idle" };
        const name = known?.name ?? "Loading…";
        return (
          <View style={styles.row}>
            <View style={styles.rowText}>
              <AppText variant="headline">{name}</AppText>
              <AppText variant="subheadline" color="textSecondary">
                {known?.distanceMeters === undefined ? "Shared by another rider" : `${formatDistanceMiles(known.distanceMeters)} · shared by another rider`}
              </AppText>
              {status.kind === "done" ? <AppText variant="footnote" color="statusSuccess">{status.message}</AppText> : null}
              {status.kind === "error" ? (
                <AppText variant="footnote" color="statusDanger" accessibilityRole="alert">
                  {status.message}
                </AppText>
              ) : null}
            </View>
            <Button
              label={status.kind === "done" ? "Added" : "Add"}
              variant="secondary"
              fullWidth={false}
              loading={status.kind === "importing"}
              disabled={known === undefined || status.kind === "done"}
              onPress={() => handleAdd(item)}
              accessibilityHint={`Adds ${name} to your segments`}
            />
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: SCREEN_PADDING },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.space12,
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: spacing.space12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowText: { flex: 1, gap: spacing.space2 },
});
