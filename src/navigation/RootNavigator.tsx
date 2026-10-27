import { createBottomTabNavigator, type BottomTabHeaderProps } from "@react-navigation/bottom-tabs";
import { StackActions } from "@react-navigation/native";
import { HomeScreen } from "../screens/HomeScreen";
import { Icon } from "../theme/Icon";
import type { IconName } from "../theme/icons";
import { useColors } from "../theme/useColors";
import { RidesStackNavigator } from "./RidesStackNavigator";
import { SegmentsStackNavigator } from "./SegmentsStackNavigator";
import { HomeHeader } from "./tabHeaders";
import { stackToReset } from "./tabPressReset";
import type { RootTabParamList } from "./types";

const Tab = createBottomTabNavigator<RootTabParamList>();

/** The three tabs, in order: what each is called and the icon it wears. */
const TABS: readonly { name: keyof RootTabParamList; title: string; icon: IconName }[] = [
  { name: "HomeTab", title: "Home", icon: "home" },
  { name: "RidesTab", title: "Rides", icon: "route" },
  { name: "SegmentsTab", title: "Segments", icon: "mapPin" },
];

function tabIcon(icon: IconName) {
  return ({ focused, size }: { focused: boolean; size: number }) => <Icon name={icon} size={size} color={focused ? "ctaText" : "textTertiary"} />;
}

/**
 * The app's shell: an iOS-style bottom tab bar with Home, Rides and Segments. Each tab's first page
 * draws its own large-title header with an icon bar (tabHeaders.tsx); pushed pages use the standard
 * back-button header. The tab bar and headers take their colours from the theme tokens, so they
 * follow light and dark. Room at the right end of the bar for the later AI button is set aside in aiDock.ts.
 */
export function RootNavigator({ initialTab = "HomeTab" }: { initialTab?: keyof RootTabParamList }) {
  const palette = useColors();
  return (
    <Tab.Navigator
      initialRouteName={initialTab}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.ctaText,
        tabBarInactiveTintColor: palette.textTertiary,
        tabBarStyle: { backgroundColor: palette.surface, borderTopColor: palette.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500" },
      }}
    >
      {TABS.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.name === "HomeTab" ? HomeScreen : tab.name === "RidesTab" ? RidesStackNavigator : SegmentsStackNavigator}
          listeners={({ navigation, route }) => ({
            // Tapping a tab, focused or not, shows that tab's list page and drops anything left open inside it.
            tabPress: () => {
              const target = stackToReset(navigation.getState().routes.find((candidate) => candidate.key === route.key)?.state);
              if (target !== undefined) navigation.dispatch({ ...StackActions.popToTop(), target });
            },
          })}
          options={{
            title: tab.title,
            tabBarIcon: tabIcon(tab.icon),
            ...(tab.name === "HomeTab" ? { headerShown: true, header: ({ navigation }: BottomTabHeaderProps) => <HomeHeader navigation={navigation} /> } : {}),
          }}
        />
      ))}
    </Tab.Navigator>
  );
}
