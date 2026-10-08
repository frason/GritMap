import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Text, TouchableOpacity } from "react-native";
import { SegmentListScreen } from "../screens/SegmentListScreen";
import { SegmentDetailScreen } from "../screens/SegmentDetailScreen";
import { AttemptReviewScreen } from "../screens/AttemptReviewScreen";
import { AttemptComparisonScreen } from "../screens/AttemptComparisonScreen";
import { RegistryBrowseScreen } from "../screens/RegistryBrowseScreen";
import { ZonesSettingsScreen } from "../screens/ZonesSettingsScreen";
import { HistoricalBandScreen } from "../screens/HistoricalBandScreen";
import { SendToKarooScreen } from "../screens/SendToKarooScreen";
import { PublishToRegistryScreen } from "../screens/PublishToRegistryScreen";
import { ImportCoachPlanScreen } from "../screens/ImportCoachPlanScreen";
import { PlanVsActualScreen } from "../screens/PlanVsActualScreen";
import { colors } from "../theme/colors";
import type { SegmentsStackParamList } from "./types";

const Stack = createNativeStackNavigator<SegmentsStackParamList>();

export function SegmentsStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="SegmentList"
        component={SegmentListScreen}
        options={({ navigation }) => ({
          title: "Segments",
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate("ZonesSettings")}
              accessibilityRole="button"
              accessibilityLabel="Your profile"
              accessibilityHint="Your FTP, weight and heart rate"
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <Text style={{ color: colors.brand, fontSize: 17 }}>Profile</Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={() => navigation.navigate("RegistryBrowse")}>
              <Text style={{ color: colors.brand, fontSize: 17 }} accessibilityRole="button" accessibilityLabel="Open Segments">
                Open Segments
              </Text>
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen name="SegmentDetail" component={SegmentDetailScreen} options={{ title: "" }} />
      <Stack.Screen name="AttemptReview" component={AttemptReviewScreen} options={{ title: "Review Attempt" }} />
      <Stack.Screen
        name="AttemptComparison"
        component={AttemptComparisonScreen}
        options={{ title: "Compare Attempts" }}
      />
      <Stack.Screen name="RegistryBrowse" component={RegistryBrowseScreen} options={{ title: "Open Segments" }} />
      <Stack.Screen name="ZonesSettings" component={ZonesSettingsScreen} options={{ title: "Your Profile" }} />
      <Stack.Screen name="HistoricalBand" component={HistoricalBandScreen} options={{ title: "Historical Range" }} />
      <Stack.Screen name="SendToKaroo" component={SendToKarooScreen} options={{ title: "Send to Karoo" }} />
      <Stack.Screen
        name="PublishToRegistry"
        component={PublishToRegistryScreen}
        options={{ title: "Publish to Registry" }}
      />
      <Stack.Screen name="ImportCoachPlan" component={ImportCoachPlanScreen} options={{ title: "Import Plan" }} />
      <Stack.Screen name="PlanVsActual" component={PlanVsActualScreen} options={{ title: "Plan vs Actual" }} />
    </Stack.Navigator>
  );
}
