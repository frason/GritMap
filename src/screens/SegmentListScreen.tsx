import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { SEGMENT_PAGE_ENABLED } from "../plans/featureFlag";
import { useCallback, useMemo, useState } from "react";
import { ActionSheetIOS, Alert, FlatList, Platform, Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useDatabase } from "../db/DatabaseProvider";
import { loadSegmentCards, type SegmentCardData } from "../plans/loadSegmentCards";
import { SegmentCard } from "../plans/SegmentCard";
import { DEFAULT_SEGMENT_SORT, SEGMENT_SORTS, sortSegments, type SegmentSort } from "../plans/segmentListView";
import type { RootTabParamList, SegmentsStackParamList } from "../navigation/types";
import { Icon } from "../theme/Icon";
import { MIN_TOUCH_TARGET } from "../theme/layout";
import { spacing } from "../theme/spacing";
import { useColors } from "../theme/useColors";
import { AppText, EmptyState } from "../theme/components";

type Navigation = NativeStackNavigationProp<SegmentsStackParamList>;

export function SegmentListScreen() {
  const database = useDatabase();
  const navigation = useNavigation<Navigation>();
  const colors = useColors();
  const [cards, setCards] = useState<SegmentCardData[]>([]);
  const [sort, setSort] = useState<SegmentSort>(DEFAULT_SEGMENT_SORT);
  const sorted = useMemo(() => sortSegments(cards.map((card) => ({ ...card.summary, card })), sort).map((row) => row.card), [cards, sort]);
  const sortLabel = SEGMENT_SORTS.find((option) => option.value === sort)?.label ?? "";

  const refresh = useCallback(() => {
    setCards(loadSegmentCards(database));
  }, [database]);

  // Re-query on focus so a segment saved (or deleted) elsewhere shows up immediately.
  useFocusEffect(refresh);

  function openImport() {
    // Import lives in the Rides stack; reach it through the tab navigator.
    navigation.getParent<BottomTabNavigationProp<RootTabParamList>>()?.navigate("RidesTab", { screen: "Import", initial: false });
  }

  function chooseSort() {
    const labels = SEGMENT_SORTS.map((option) => option.label);
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions({ title: "Sort segments by", options: [...labels, "Cancel"], cancelButtonIndex: labels.length }, (index) => {
        const option = SEGMENT_SORTS[index];
        if (option !== undefined) setSort(option.value);
      });
      return;
    }
    Alert.alert("Sort segments by", undefined, [...SEGMENT_SORTS.map((option) => ({ text: option.label, onPress: () => setSort(option.value) })), { text: "Cancel", style: "cancel" as const }]);
  }

  if (cards.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
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
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.list}
      data={sorted}
      keyExtractor={(card) => card.summary.segmentId}
      ListHeaderComponent={
        <Pressable
          onPress={chooseSort}
          accessibilityRole="button"
          accessibilityLabel={`Sort by ${sortLabel}`}
          accessibilityHint="Choose how segments are ordered"
          style={styles.sortButton}
        >
          <AppText variant="subheadline" color="textSecondary">
            {`Sort: ${sortLabel}`}
          </AppText>
          <Icon name="chevronDown" size={16} color="textSecondary" />
        </Pressable>
      }
      renderItem={({ item: card }) => (
        <SegmentCard
          data={card}
          onPress={() => navigation.navigate(SEGMENT_PAGE_ENABLED ? "SegmentPage" : "SegmentDetail", { segmentId: card.summary.segmentId })}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: { paddingHorizontal: spacing.space16, paddingVertical: spacing.space12, gap: spacing.space12 },
  sortButton: { minHeight: MIN_TOUCH_TARGET, flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: spacing.space4 },
});
