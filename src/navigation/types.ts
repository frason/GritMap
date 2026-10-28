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
  /** The redesigned segment page; reached from the list while SEGMENT_PAGE_ENABLED is on. */
  SegmentPage: { segmentId: string; /** An effort to highlight in the results (set when opened from a ride). */ highlightAttemptId?: string };
  AttemptReview: { attemptId: string };
  AttemptComparison: { primaryAttemptId: string; comparisonAttemptId: string };
  RegistryBrowse: undefined;
  /** `returnAfterSave`: opened from a prompt to set FTP or weight, so Save goes back to where the rider came from. */
  /** "Connect your Karoo": the Karoo steps, opened from the Home checklist. */
  KarooSetup: undefined;
  ZonesSettings: { returnAfterSave?: boolean } | undefined;
  HistoricalBand: { segmentId: string; currentAttemptId: string };
  SendToKaroo: { segmentId: string };
  PublishToRegistry: { segmentId: string };
  ImportCoachPlan: { segmentId: string };
  PlanVsActual: { attemptId: string };
};

export type RootTabParamList = {
  HomeTab: undefined;
  RidesTab: NavigatorScreenParams<RidesStackParamList> | undefined;
  SegmentsTab: NavigatorScreenParams<SegmentsStackParamList> | undefined;
};
