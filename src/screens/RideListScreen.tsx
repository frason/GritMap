import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

// Stub — replaced with the real ride list + import CTA once the DB write
// paths and query modules land (see docs/plan for the PR sequence).
export function RideListScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Rides</Text>
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
