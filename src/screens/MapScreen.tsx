import { Map } from "@maplibre/maplibre-react-native";
import { StyleSheet } from "react-native";

// Minimal scaffold (issue #47): an empty MapLibre view on an open, non-paid style source,
// so segment definition (needs a map, docs/PLAN_first_ui_increment.md's Context section)
// has something to build on. Not wired into any navigation flow yet -- no screen uses it.
export function MapScreen() {
  return <Map style={styles.map} mapStyle="https://demotiles.maplibre.org/style.json" />;
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
