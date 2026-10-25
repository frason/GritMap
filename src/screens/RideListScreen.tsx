import { useCallback, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useDatabase } from "../db/DatabaseProvider";
import { listPlanSendMarks } from "../db/listPlanSendMarks";
import { listRides, type RideSummary } from "../db/listRides";
import type { RidesStackParamList } from "../navigation/types";
import type { RideSegmentHighlight } from "../plans/karooMarks";
import { loadRideHighlights } from "../plans/loadRideHighlights";
import { RideMapCard } from "../plans/RideMapCard";
import { spacing } from "../theme/spacing";
import { useColors } from "../theme/useColors";
import { EmptyState } from "../theme/components";

type Navigation = NativeStackNavigationProp<RidesStackParamList>;

type RideCard = { ride: RideSummary; highlights: RideSegmentHighlight[] };

export function RideListScreen() {
  const database = useDatabase();
  const navigation = useNavigation<Navigation>();
  const colors = useColors();
  const [cards, setCards] = useState<RideCard[]>([]);

  // Re-query on focus (not just mount) so a ride imported and then navigated back from
  // shows up immediately, without needing a separate cross-screen refresh mechanism.
  useFocusEffect(
    useCallback(() => {
      const sent = new Set(listPlanSendMarks(database).map((mark) => mark.segmentId));
      setCards(listRides(database).map((ride) => ({ ride, highlights: loadRideHighlights(database, ride.rideId, sent) })));
    }, [database]),
  );

  if (cards.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <EmptyState
          icon="route"
          title="No rides yet"
          body="Import a ride file (.fit or .gpx) from your bike computer. You can then make segments from it and see how you did on each one."
          actions={[{ label: "Import a ride", onPress: () => navigation.navigate("Import"), icon: "download" }]}
        />
      </View>
    );
  }

  return (
    <FlatList
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.list}
      data={cards}
      keyExtractor={(card) => card.ride.rideId}
      renderItem={({ item }) => (
        <RideMapCard ride={item.ride} highlights={item.highlights} onPress={() => navigation.navigate("RideDetail", { rideId: item.ride.rideId })} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: spacing.space16, gap: spacing.space12 },
});
