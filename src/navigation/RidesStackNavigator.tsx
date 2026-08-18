import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { RideDetailScreen } from "../screens/RideDetailScreen";
import { RideListScreen } from "../screens/RideListScreen";
import { ImportScreen } from "../screens/ImportScreen";
import type { RidesStackParamList } from "./types";

const Stack = createNativeStackNavigator<RidesStackParamList>();

export function RidesStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="RideList" component={RideListScreen} options={{ title: "Rides" }} />
      <Stack.Screen name="RideDetail" component={RideDetailScreen} options={{ title: "" }} />
      <Stack.Screen
        name="Import"
        component={ImportScreen}
        options={{ title: "Import Rides", presentation: "card" }}
      />
    </Stack.Navigator>
  );
}
