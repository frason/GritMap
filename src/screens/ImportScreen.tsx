import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

// Stub — replaced once the FIT import pipeline (parse → dedupe → persist) is
// wired to a native file picker.
export function ImportScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Import</Text>
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
