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
  RegistryBrowse: undefined;
  ZonesSettings: undefined;
};

export type RootTabParamList = {
  HomeTab: undefined;
  RidesTab: NavigatorScreenParams<RidesStackParamList> | undefined;
  SegmentsTab: NavigatorScreenParams<SegmentsStackParamList> | undefined;
};
