import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SegmentListScreen } from "../screens/SegmentListScreen";
import { SegmentDetailScreen } from "../screens/SegmentDetailScreen";
import { SegmentPageScreen } from "../screens/SegmentPageScreen";
import { AttemptReviewScreen } from "../screens/AttemptReviewScreen";
import { AttemptComparisonScreen } from "../screens/AttemptComparisonScreen";
import { RegistryBrowseScreen } from "../screens/RegistryBrowseScreen";
import { ZonesSettingsScreen } from "../screens/ZonesSettingsScreen";
import { HistoricalBandScreen } from "../screens/HistoricalBandScreen";
import { SendToKarooScreen } from "../screens/SendToKarooScreen";
import { PublishToRegistryScreen } from "../screens/PublishToRegistryScreen";
import { ImportCoachPlanScreen } from "../screens/ImportCoachPlanScreen";
import { PlanVsActualScreen } from "../screens/PlanVsActualScreen";
import { KarooSetupScreen } from "../onboarding/KarooSetupScreen";
import { SegmentsHeader } from "./tabHeaders";
import type { SegmentsStackParamList } from "./types";

const Stack = createNativeStackNavigator<SegmentsStackParamList>();

export function SegmentsStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="SegmentList"
        component={SegmentListScreen}
        options={{ title: "Segments", header: (props) => <SegmentsHeader {...props} /> }}
      />
      <Stack.Screen name="SegmentDetail" component={SegmentDetailScreen} options={{ title: "" }} />
      <Stack.Screen name="SegmentPage" component={SegmentPageScreen} options={{ title: "" }} />
      <Stack.Screen name="AttemptReview" component={AttemptReviewScreen} options={{ title: "Review Effort" }} />
      <Stack.Screen
        name="AttemptComparison"
        component={AttemptComparisonScreen}
        options={{ title: "Compare Efforts" }}
      />
      <Stack.Screen name="RegistryBrowse" component={RegistryBrowseScreen} options={{ title: "Open Segments" }} />
      <Stack.Screen name="ZonesSettings" component={ZonesSettingsScreen} options={{ title: "Settings" }} />
      <Stack.Screen name="KarooSetup" component={KarooSetupScreen} options={{ title: "Connect your Karoo" }} />
      <Stack.Screen name="HistoricalBand" component={HistoricalBandScreen} options={{ title: "Progress Over Time" }} />
      <Stack.Screen name="SendToKaroo" component={SendToKarooScreen} options={{ title: "Send to Karoo" }} />
      <Stack.Screen
        name="PublishToRegistry"
        component={PublishToRegistryScreen}
        options={{ title: "Share to Open Segments" }}
      />
      <Stack.Screen name="ImportCoachPlan" component={ImportCoachPlanScreen} options={{ title: "Import Plan" }} />
      <Stack.Screen name="PlanVsActual" component={PlanVsActualScreen} options={{ title: "Plan vs Actual" }} />
    </Stack.Navigator>
  );
}
