import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { RideDetailScreen } from "../screens/RideDetailScreen";
import { RideListScreen } from "../screens/RideListScreen";
import { ImportScreen } from "../screens/ImportScreen";
import { DefineSegmentScreen } from "../screens/DefineSegmentScreen";
import { RidesHeader } from "./tabHeaders";
import type { RidesStackParamList } from "./types";

const Stack = createNativeStackNavigator<RidesStackParamList>();

export function RidesStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="RideList"
        component={RideListScreen}
        options={{ title: "Rides", header: (props) => <RidesHeader {...props} /> }}
      />
      <Stack.Screen name="RideDetail" component={RideDetailScreen} options={{ title: "" }} />
      <Stack.Screen
        name="Import"
        component={ImportScreen}
        options={{ title: "Import", presentation: "card" }}
      />
      <Stack.Screen
        name="DefineSegment"
        component={DefineSegmentScreen}
        options={{ title: "New Segment", presentation: "card" }}
      />
    </Stack.Navigator>
  );
}
