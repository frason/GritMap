import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { radius, spacing } from "../spacing";
import { useColors } from "../useColors";
import { AppText } from "./AppText";

/** A row of StatTiles that wraps to a second line at large text sizes instead of squeezing the numbers. */
export function StatRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

/** One headline number with its label ("6.5 mi", "Distance"). Read by VoiceOver as "Distance: 6.5 mi". */
export function StatTile({ value, label }: { value: string; label: string }) {
  const palette = useColors();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={[styles.tile, { backgroundColor: palette.surface, borderColor: palette.border }]}
    >
      <AppText variant="headline" align="center" importantForAccessibility="no">
        {value}
      </AppText>
      <AppText variant="caption1" color="textSecondary" align="center" importantForAccessibility="no">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.space8 },
  tile: {
    flexGrow: 1,
    flexBasis: 96,
    alignItems: "center",
    gap: spacing.space2,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: spacing.space12,
    paddingHorizontal: spacing.space8,
  },
});
