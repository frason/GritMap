import type { NavigatorScreenParams } from "@react-navigation/native";

export type RidesStackParamList = {
  RideList: undefined;
  RideDetail: { rideId: string };
  Import: undefined;
  DefineSegment: { rideId: string };
};

export type SegmentsStackParamList = {
  SegmentList: undefined;
  SegmentDetail: { segmentId: string };
  AttemptReview: { attemptId: string };
  AttemptComparison: { primaryAttemptId: string; comparisonAttemptId: string };
};

export type RootTabParamList = {
  RidesTab: undefined;
  SegmentsTab: NavigatorScreenParams<SegmentsStackParamList> | undefined;
};
