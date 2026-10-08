import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { HomeScreen } from "../screens/HomeScreen";
import { Icon } from "../theme/Icon";
import { colors } from "../theme/colors";
import { RidesStackNavigator } from "./RidesStackNavigator";
import { SegmentsStackNavigator } from "./SegmentsStackNavigator";
import type { RootTabParamList } from "./types";

const Tab = createBottomTabNavigator<RootTabParamList>();

export function RootNavigator({ initialTab = "HomeTab" }: { initialTab?: keyof RootTabParamList }) {
  return (
    <Tab.Navigator
      initialRouteName={initialTab}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textTertiary,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          title: "Home",
          tabBarIcon: ({ focused, size }) => (
            <Icon name="flag" size={size} color={focused ? "brand" : "textTertiary"} />
          ),
        }}
      />
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
        component={SegmentsStackNavigator}
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
