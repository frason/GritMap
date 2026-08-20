import { useCallback, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useDatabase } from "../db/DatabaseProvider";
import { listSegments, type SegmentSummary } from "../db/listSegments";
import { deleteSegment } from "../db/deleteSegment";
import type { SegmentsStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { Icon } from "../theme/Icon";
import { radius, spacing } from "../theme/spacing";

type Navigation = NativeStackNavigationProp<SegmentsStackParamList>;

export function SegmentListScreen() {
  const database = useDatabase();
  const navigation = useNavigation<Navigation>();
  const [segments, setSegments] = useState<SegmentSummary[]>([]);

  const refresh = useCallback(() => {
    setSegments(listSegments(database));
  }, [database]);

  // Re-query on focus so a segment saved (or deleted) elsewhere shows up immediately.
  useFocusEffect(refresh);

  function handleDelete(segment: SegmentSummary) {
    Alert.alert("Delete segment?", `"${segment.name}" and its detected attempts will be removed. Rides are not affected.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteSegment(database, segment.segmentId);
          refresh();
        },
      },
    ]);
  }

  if (segments.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Icon name="mapPin" color="textTertiary" size={40} />
        <Text style={styles.emptyTitle}>
          No segments yet. Create one from a ride's detail screen.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={segments}
      keyExtractor={(segment) => segment.segmentId}
      renderItem={({ item }) => (
        <SegmentRow
          segment={item}
          onPress={() => navigation.navigate("SegmentDetail", { segmentId: item.segmentId })}
          onDelete={() => handleDelete(item)}
        />
      )}
    />
  );
}

function SegmentRow({
  segment,
  onPress,
  onDelete,
}: {
  segment: SegmentSummary;
  onPress: () => void;
  onDelete: () => void;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <View style={styles.routeChip}>
        <Icon name="mapPin" color="brand" size={20} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{segment.name}</Text>
        <Text style={styles.rowSubtitle}>{segment.corridorMeters}m corridor</Text>
      </View>
      <TouchableOpacity onPress={onDelete} hitSlop={8} style={styles.deleteButton}>
        <Icon name="trash" color="statusDanger" size={18} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.space16,
    paddingHorizontal: spacing.space24,
    backgroundColor: colors.background,
  },
  emptyTitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "center",
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
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  rowSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  deleteButton: {
    padding: spacing.space4,
  },
});
