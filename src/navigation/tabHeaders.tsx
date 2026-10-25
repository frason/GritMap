import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackHeaderProps } from "@react-navigation/native-stack";
import { showActionMenu } from "./actionMenu";
import { EXPLORE_TARGET, HEADER_LABELS, HOME_ADD_ACTIONS, IMPORT_RIDES_TARGET, SEGMENTS_ADD_ACTIONS, SETTINGS_TARGET } from "./headerActions";
import { navigateToTarget, type TabNavigationLike } from "./navigateToTarget";
import { TabHeader } from "./TabHeader";
import type { RootTabParamList } from "./types";

/** Home: add something, and settings. */
export function HomeHeader({ navigation }: { navigation: TabNavigationLike }) {
  return (
    <TabHeader
      title="Home"
      items={[
        {
          icon: "plus",
          accessibilityLabel: HEADER_LABELS.add,
          accessibilityHint: "Import a ride, find a segment or make a new one",
          onPress: () => showActionMenu("Add to GritMap", HOME_ADD_ACTIONS, (action) => navigateToTarget(navigation, action.target)),
        },
        { icon: "settings", accessibilityLabel: HEADER_LABELS.settings, onPress: () => navigateToTarget(navigation, SETTINGS_TARGET) },
      ]}
    />
  );
}

/** The stack's `navigation` reaches the tab navigator through its parent, which is where cross-tab moves happen. */
function tabNavigationOf(navigation: NativeStackHeaderProps["navigation"]): TabNavigationLike {
  return navigation.getParent<BottomTabNavigationProp<RootTabParamList>>() as unknown as TabNavigationLike;
}

/** Rides: import. (A filter joins it when the rides list gets filters.) */
export function RidesHeader({ navigation }: NativeStackHeaderProps) {
  const tabs = tabNavigationOf(navigation);
  return <TabHeader title="Rides" items={[{ icon: "plus", accessibilityLabel: HEADER_LABELS.importRide, onPress: () => navigateToTarget(tabs, IMPORT_RIDES_TARGET) }]} />;
}

/** Segments: search Open Segments, and add. */
export function SegmentsHeader({ navigation }: NativeStackHeaderProps) {
  const tabs = tabNavigationOf(navigation);
  return (
    <TabHeader
      title="Segments"
      items={[
        { icon: "search", accessibilityLabel: HEADER_LABELS.search, onPress: () => navigateToTarget(tabs, EXPLORE_TARGET) },
        {
          icon: "plus",
          accessibilityLabel: HEADER_LABELS.add,
          accessibilityHint: "Make a new segment or find one",
          onPress: () => showActionMenu("Add a segment", SEGMENTS_ADD_ACTIONS, (action) => navigateToTarget(tabs, action.target)),
        },
      ]}
    />
  );
}
