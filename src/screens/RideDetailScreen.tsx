import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

// Stub — replaced once listRides/getRideDetail queries exist.
export function RideDetailScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Ride detail</Text>
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
