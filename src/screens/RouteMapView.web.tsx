import { StyleSheet, Text, View } from "react-native";
import type { RideTrackPoint } from "../db/getRideTrack";
import { Icon } from "../theme/Icon";
import { colors } from "../theme/colors";
import { radius, spacing } from "../theme/spacing";

export interface RouteMapViewProps {
  points: RideTrackPoint[];
  highlightRange?: { startPointIndex: number; endPointIndex: number };
}

/**
 * MapLibre's native module doesn't resolve for web. This deliberately imports nothing from
 * @maplibre/maplibre-react-native, so the web bundle's reachable graph never touches it --
 * see docs/PLAN_segment_definition_increment.md's "Platform-specific map module" decision.
 */
export function RouteMapView({ points }: RouteMapViewProps) {
  return (
    <View style={styles.container}>
      <Icon name="route" color="textTertiary" size={28} />
      <Text style={styles.text}>
        {points.length > 0
          ? `${points.length} GPS points — map view is available on the mobile app`
          : "No GPS track for this ride"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.space8,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.space24,
  },
  text: {
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: "center",
  },
});
