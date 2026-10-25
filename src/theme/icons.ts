import type { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";

// Semantic icon names, mirroring the icon/* components in the Figma mock
// (icon/chevron-right, icon/route, etc). Screens reference these names, never
// an Ionicons glyph directly — swapping the underlying icon set only means
// editing the map below.
export const iconGlyphs = {
  chevronRight: "chevron-forward",
  chevronLeft: "chevron-back",
  plus: "add",
  checkCircle: "checkmark-circle",
  alertTriangle: "warning",
  xCircle: "close-circle",
  file: "document-text-outline",
  clock: "time-outline",
  route: "bicycle",
  mapPin: "location",
  trash: "trash-outline",
  flag: "flag-outline",
  medal: "medal-outline",
  list: "list-outline",
  pulse: "pulse-outline",
  more: "ellipsis-vertical",
  search: "search",
  wifi: "wifi",
  bluetooth: "bluetooth",
  download: "download-outline",
  people: "people-outline",
  speedometer: "speedometer-outline",
  refresh: "refresh",
  info: "information-circle-outline",
  home: "home-outline",
  bolt: "flash-outline",
  heart: "heart-outline",
  trophy: "trophy-outline",
  sparkles: "sparkles-outline",
  settings: "settings-outline",
  filter: "options-outline",
  swap: "swap-horizontal",
  user: "person-outline",
  compass: "compass-outline",
  close: "close",
  check: "checkmark",
  chevronDown: "chevron-down",
} as const satisfies Record<string, ComponentProps<typeof Ionicons>["name"]>;

export type IconName = keyof typeof iconGlyphs;

export function iconGlyphFor(name: IconName): ComponentProps<typeof Ionicons>["name"] {
  return iconGlyphs[name];
}
