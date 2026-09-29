import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Text, TouchableOpacity } from "react-native";
import { SegmentListScreen } from "../screens/SegmentListScreen";
import { SegmentDetailScreen } from "../screens/SegmentDetailScreen";
import { AttemptReviewScreen } from "../screens/AttemptReviewScreen";
import { AttemptComparisonScreen } from "../screens/AttemptComparisonScreen";
import { RegistryBrowseScreen } from "../screens/RegistryBrowseScreen";
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
          headerRight: () => (
            <TouchableOpacity onPress={() => navigation.navigate("RegistryBrowse")}>
              <Text style={{ color: colors.brand, fontSize: 15, fontWeight: "600" }}>Registry</Text>
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
      <Stack.Screen name="RegistryBrowse" component={RegistryBrowseScreen} options={{ title: "Segment Registry" }} />
    </Stack.Navigator>
  );
}
