import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

// Placeholder content for the Segments tab. Real segment definition needs a
// map (docs/MVP.md capability 3) and depends on PR #54's MapLibre work.
export function SegmentsPlaceholderScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Segments — coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    color: colors.textSecondary,
    fontSize: 15,
  },
});
