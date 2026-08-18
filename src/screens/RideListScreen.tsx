import { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useDatabase } from "../db/DatabaseProvider";
import { listRides, type RideSummary } from "../db/listRides";
import type { RidesStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { Icon } from "../theme/Icon";
import { radius, spacing } from "../theme/spacing";
import { formatDistanceMiles, formatDurationHoursMinutes, formatRideDate } from "./formatRideStats";

type Navigation = NativeStackNavigationProp<RidesStackParamList>;

export function RideListScreen() {
  const database = useDatabase();
  const navigation = useNavigation<Navigation>();
  const [rides, setRides] = useState<RideSummary[]>([]);

  // Re-query on focus (not just mount) so a ride imported and then navigated back from
  // shows up immediately, without needing a separate cross-screen refresh mechanism.
  useFocusEffect(
    useCallback(() => {
      setRides(listRides(database));
    }, [database]),
  );

  if (rides.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Icon name="route" color="textTertiary" size={40} />
        <Text style={styles.emptyTitle}>Import your first ride to get started</Text>
        <TouchableOpacity
          style={styles.emptyButton}
          onPress={() => navigation.navigate("Import")}
        >
          <Text style={styles.emptyButtonLabel}>Import</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={rides}
      keyExtractor={(ride) => ride.rideId}
      renderItem={({ item }) => (
        <RideRow
          ride={item}
          onPress={() => navigation.navigate("RideDetail", { rideId: item.rideId })}
        />
      )}
    />
  );
}

function RideRow({ ride, onPress }: { ride: RideSummary; onPress: () => void }) {
  const title = ride.startTimestampMs !== undefined
    ? formatRideDate(ride.startTimestampMs)
    : ride.originalFilename;
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <View style={styles.routeChip}>
        <Icon name="route" color="brand" size={20} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle} numberOfLines={1}>
          {formatDistanceMiles(ride.totalDistanceMeters)} ·{" "}
          {formatDurationHoursMinutes(ride.durationMs)} · {ride.originalFilename}
        </Text>
      </View>
      <Icon name="chevronRight" color="textSecondary" size={18} />
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
  emptyButton: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: spacing.space12,
    paddingHorizontal: spacing.space24,
  },
  emptyButtonLabel: {
    color: colors.textOnBrand,
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
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  rowSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
