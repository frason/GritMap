import type { RidesStackParamList, SegmentsStackParamList } from "./types.ts";

/** Where a header button or menu item takes the rider: a tab, and optionally a screen inside it. */
export type NavTarget =
  | { tab: "HomeTab" }
  | { tab: "RidesTab"; screen?: keyof RidesStackParamList }
  | { tab: "SegmentsTab"; screen?: keyof SegmentsStackParamList };

export interface MenuAction {
  id: string;
  /** Plain words, what the rider will do ("Import a ride"). */
  label: string;
  target: NavTarget;
}

/** Where the gear on Home goes. Today that is "Your Profile" (FTP, weight, heart rate); the full Settings screen replaces it. */
export const SETTINGS_TARGET: NavTarget = { tab: "SegmentsTab", screen: "ZonesSettings" };
/** Open Segments: browse and search the segments other riders have shared. */
export const EXPLORE_TARGET: NavTarget = { tab: "SegmentsTab", screen: "RegistryBrowse" };
export const IMPORT_RIDES_TARGET: NavTarget = { tab: "RidesTab", screen: "Import" };

/** The "+" on Home: the three ways to get something into GritMap. */
export const HOME_ADD_ACTIONS: readonly MenuAction[] = [
  { id: "import-ride", label: "Import a ride", target: IMPORT_RIDES_TARGET },
  { id: "find-segment", label: "Find a segment", target: EXPLORE_TARGET },
  { id: "new-segment-from-ride", label: "New segment from a ride", target: { tab: "RidesTab", screen: "RideList" } },
];

/** The "+" on Segments. A segment file (.json) is added from the Import screen, in its own section. */
export const SEGMENTS_ADD_ACTIONS: readonly MenuAction[] = [
  { id: "new-segment-from-ride", label: "New segment from a ride", target: { tab: "RidesTab", screen: "RideList" } },
  { id: "new-segment-from-file", label: "New segment from a file", target: IMPORT_RIDES_TARGET },
  { id: "find-segment", label: "Find in Open Segments", target: EXPLORE_TARGET },
];

/** VoiceOver names for the header icon buttons. */
export const HEADER_LABELS = {
  add: "Add",
  settings: "Settings and your profile",
  importRide: "Import a ride",
  search: "Search Open Segments",
} as const;
