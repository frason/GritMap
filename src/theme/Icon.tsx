import { Ionicons } from "@expo/vector-icons";
import { colors } from "./colors";
import { iconGlyphFor, type IconName } from "./icons";

type Props = {
  name: IconName;
  color?: keyof typeof colors;
  size?: number;
};

// Thin wrapper so screens pick an icon and a color token by semantic name
// (e.g. <Icon name="route" color="brand" />) instead of an Ionicons glyph and
// a hex value.
export function Icon({ name, color = "textPrimary", size = 24 }: Props) {
  return <Ionicons name={iconGlyphFor(name)} color={colors[color]} size={size} />;
}
