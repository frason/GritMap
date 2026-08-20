import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Text, TouchableOpacity } from "react-native";
import { RideDetailScreen } from "../screens/RideDetailScreen";
import { RideListScreen } from "../screens/RideListScreen";
import { ImportScreen } from "../screens/ImportScreen";
import { DefineSegmentScreen } from "../screens/DefineSegmentScreen";
import { colors } from "../theme/colors";
import type { RidesStackParamList } from "./types";

const Stack = createNativeStackNavigator<RidesStackParamList>();

export function RidesStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="RideList"
        component={RideListScreen}
        options={({ navigation }) => ({
          title: "Rides",
          headerRight: () => (
            <TouchableOpacity onPress={() => navigation.navigate("Import")}>
              <Text style={{ color: colors.brand, fontSize: 15, fontWeight: "600" }}>Import</Text>
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen name="RideDetail" component={RideDetailScreen} options={{ title: "" }} />
      <Stack.Screen
        name="Import"
        component={ImportScreen}
        options={{ title: "Import Rides", presentation: "card" }}
      />
      <Stack.Screen
        name="DefineSegment"
        component={DefineSegmentScreen}
        options={{ title: "New Segment", presentation: "card" }}
      />
    </Stack.Navigator>
  );
}
