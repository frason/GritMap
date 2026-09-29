import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Crypto from "expo-crypto";
import { useDatabase } from "../db/DatabaseProvider";
import { importRegistrySegment } from "../db/importRegistrySegment";
import { defaultRegistryConfig } from "../registry/registryConfig";
import { fetchRegistrySegment, listRegistrySegments, type RegistryEntry } from "../registry/registryClient";
import type { SegmentsStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { Icon } from "../theme/Icon";
import { radius, spacing } from "../theme/spacing";

type Navigation = NativeStackNavigationProp<SegmentsStackParamList>;

const generateId = () => Crypto.randomUUID();

type RowStatus = { kind: "idle" } | { kind: "importing" } | { kind: "done"; message: string } | { kind: "error"; message: string };

export function RegistryBrowseScreen() {
  const database = useDatabase();
  const navigation = useNavigation<Navigation>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);
  const [entries, setEntries] = useState<RegistryEntry[]>([]);
  const [rowStatus, setRowStatus] = useState<Record<string, RowStatus>>({});

  const refresh = useCallback(() => {
    setLoading(true);
    setLoadError(undefined);
    listRegistrySegments(defaultRegistryConfig()).then((result) => {
      setLoading(false);
      if (!result.ok) {
        setLoadError(result.message ?? `Could not load the registry (HTTP ${result.statusCode ?? "?"})`);
        return;
      }
      setEntries(result.entries);
    });
  }, []);

  useFocusEffect(refresh);

  async function handleImport(entry: RegistryEntry) {
    setRowStatus((current) => ({ ...current, [entry.fingerprint]: { kind: "importing" } }));

    const fetched = await fetchRegistrySegment(defaultRegistryConfig(), entry.fingerprint);
    if (!fetched.ok) {
      setRowStatus((current) => ({
        ...current,
        [entry.fingerprint]: { kind: "error", message: fetched.message ?? `Fetch failed (HTTP ${fetched.statusCode ?? "?"})` },
      }));
      return;
    }

    const result = await importRegistrySegment(database, generateId, fetched.segment, Date.now());
    if (result.status === "invalid") {
      setRowStatus((current) => ({ ...current, [entry.fingerprint]: { kind: "error", message: result.error } }));
      return;
    }

    setRowStatus((current) => ({
      ...current,
      [entry.fingerprint]: {
        kind: "done",
        message: result.status === "already-imported" ? "Already in your library" : "Imported",
      },
    }));
    navigation.navigate("SegmentDetail", { segmentId: result.segmentId });
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (loadError !== undefined) {
    return (
      <View style={styles.centered}>
        <Icon name="alertTriangle" color="statusWarning" size={32} />
        <Text style={styles.emptyText}>{loadError}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refresh}>
          <Text style={styles.retryButtonLabel}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (entries.length === 0) {
    return (
      <View style={styles.centered}>
        <Icon name="mapPin" color="textTertiary" size={40} />
        <Text style={styles.emptyText}>
          Nothing published to the registry yet. Publish a segment from its detail screen.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={entries}
      keyExtractor={(entry) => entry.fingerprint}
      renderItem={({ item }) => (
        <RegistryRow entry={item} status={rowStatus[item.fingerprint] ?? { kind: "idle" }} onImport={() => handleImport(item)} />
      )}
    />
  );
}

function RegistryRow({
  entry,
  status,
  onImport,
}: {
  entry: RegistryEntry;
  status: RowStatus;
  onImport: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.routeChip}>
        <Icon name="mapPin" color="brand" size={20} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {entry.fingerprint}
        </Text>
        {status.kind === "done" && <Text style={styles.rowStatusDone}>{status.message}</Text>}
        {status.kind === "error" && <Text style={styles.rowStatusError}>{status.message}</Text>}
      </View>
      {status.kind === "importing" ? (
        <ActivityIndicator color={colors.brand} />
      ) : (
        <TouchableOpacity style={styles.importButton} onPress={onImport} disabled={status.kind === "done"}>
          <Text style={styles.importButtonLabel}>{status.kind === "done" ? "Imported" : "Import"}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.space16,
    paddingHorizontal: spacing.space24,
    backgroundColor: colors.background,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: colors.brandSubtle,
    borderRadius: radius.md,
    paddingHorizontal: spacing.space20,
    paddingVertical: spacing.space12,
  },
  retryButtonLabel: {
    color: colors.brand,
    fontSize: 15,
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.space12,
    paddingVertical: spacing.space16,
    paddingHorizontal: spacing.space20,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  routeChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    gap: spacing.space4 - 2,
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
    fontFamily: "monospace",
  },
  rowStatusDone: {
    fontSize: 12,
    color: colors.statusSuccess,
  },
  rowStatusError: {
    fontSize: 12,
    color: colors.statusDanger,
  },
  importButton: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingHorizontal: spacing.space16,
    paddingVertical: spacing.space8,
  },
  importButtonLabel: {
    color: colors.textOnBrand,
    fontSize: 13,
    fontWeight: "600",
  },
});
