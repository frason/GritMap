import { ActivityIndicator, StyleSheet, View } from "react-native";
import { spacing } from "../spacing";
import { useColors } from "../useColors";
import { AppText } from "./AppText";

/** Work is in progress and the rider should wait. */
export function LoadingState({ label = "Loading…" }: { label?: string }) {
  const palette = useColors();
  return (
    <View style={styles.container} accessible accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={palette.brand} size="large" />
      <AppText variant="subheadline" color="textSecondary">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.space12, padding: spacing.space24 },
});
