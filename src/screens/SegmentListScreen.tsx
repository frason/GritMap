import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useDatabase } from "../db/DatabaseProvider";
import { listSegments, type SegmentSummary } from "../db/listSegments";
import { deleteSegment } from "../db/deleteSegment";
import type { RootTabParamList, SegmentsStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { Icon } from "../theme/Icon";
import { MIN_TOUCH_TARGET } from "../theme/layout";
import { spacing } from "../theme/spacing";
import { EmptyState, ListRow } from "../theme/components";
import { describeSegmentRow } from "./describeSegmentRow";

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

  function openImport() {
    // Import lives in the Rides stack; reach it through the tab navigator.
    navigation.getParent<BottomTabNavigationProp<RootTabParamList>>()?.navigate("RidesTab", { screen: "Import" });
  }

  function handleDelete(segment: SegmentSummary) {
    Alert.alert("Delete segment?", `"${segment.name}" and the efforts found on it will be removed. Your rides are not affected.`, [
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
      <View style={styles.container}>
        <EmptyState
          icon="mapPin"
          title="No segments yet"
          body="A segment is a stretch of road you want to get faster on. Add one to set a goal, get a pacing plan and track your times."
          actions={[
            {
              label: "Browse Open Segments",
              onPress: () => navigation.navigate("RegistryBrowse"),
              icon: "search",
              accessibilityHint: "Free segments shared by other riders",
            },
            { label: "Make one from a ride", onPress: openImport, variant: "secondary", icon: "route" },
            { label: "Import a segment file", onPress: openImport, variant: "tertiary" },
          ]}
        />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.list}
      data={segments}
      keyExtractor={(segment) => segment.segmentId}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.rowMain}>
            <ListRow
              icon="mapPin"
              title={item.name}
              subtitle={describeSegmentRow(item)}
              onPress={() => navigation.navigate("SegmentDetail", { segmentId: item.segmentId })}
            />
          </View>
          <Pressable
            onPress={() => handleDelete(item)}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${item.name}`}
            style={styles.deleteButton}
          >
            <Icon name="trash" color="statusDanger" size={20} />
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: { paddingHorizontal: spacing.space20 },
  row: { flexDirection: "row", alignItems: "center" },
  rowMain: { flex: 1 },
  deleteButton: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: "center",
    justifyContent: "center",
  },
});
