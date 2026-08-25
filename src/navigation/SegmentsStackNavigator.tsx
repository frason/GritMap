import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SegmentListScreen } from "../screens/SegmentListScreen";
import { SegmentDetailScreen } from "../screens/SegmentDetailScreen";
import { AttemptReviewScreen } from "../screens/AttemptReviewScreen";
import type { SegmentsStackParamList } from "./types";

const Stack = createNativeStackNavigator<SegmentsStackParamList>();

export function SegmentsStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="SegmentList" component={SegmentListScreen} options={{ title: "Segments" }} />
      <Stack.Screen name="SegmentDetail" component={SegmentDetailScreen} options={{ title: "" }} />
      <Stack.Screen name="AttemptReview" component={AttemptReviewScreen} options={{ title: "Review Attempt" }} />
    </Stack.Navigator>
  );
}
