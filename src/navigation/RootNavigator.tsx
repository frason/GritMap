import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Icon } from "../theme/Icon";
import { colors } from "../theme/colors";
import { SegmentsPlaceholderScreen } from "../screens/SegmentsPlaceholderScreen";
import { RidesStackNavigator } from "./RidesStackNavigator";
import type { RootTabParamList } from "./types";

const Tab = createBottomTabNavigator<RootTabParamList>();

export function RootNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textTertiary,
      }}
    >
      <Tab.Screen
        name="RidesTab"
        component={RidesStackNavigator}
        options={{
          title: "Rides",
          tabBarIcon: ({ focused, size }) => (
            <Icon name="route" size={size} color={focused ? "brand" : "textTertiary"} />
          ),
        }}
      />
      <Tab.Screen
        name="SegmentsTab"
        component={SegmentsPlaceholderScreen}
        options={{
          title: "Segments",
          tabBarIcon: ({ focused, size }) => (
            <Icon name="mapPin" size={size} color={focused ? "brand" : "textTertiary"} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
