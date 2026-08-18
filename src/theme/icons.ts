import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";

// Semantic icon names, mirroring the icon/* components in the Figma mock
// (icon/chevron-right, icon/route, etc). Screens reference these names, never
// an Ionicons glyph directly — swapping the underlying icon set only means
// editing the map below.
const iconGlyphs = {
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
} as const satisfies Record<string, ComponentProps<typeof Ionicons>["name"]>;

export type IconName = keyof typeof iconGlyphs;

export function iconGlyphFor(name: IconName): ComponentProps<typeof Ionicons>["name"] {
  return iconGlyphs[name];
}
