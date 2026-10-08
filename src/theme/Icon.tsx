import { Ionicons } from "@expo/vector-icons";
import type { ColorToken } from "./colors";
import { iconGlyphFor, type IconName } from "./icons";
import { useColors } from "./useColors";

type Props = {
  name: IconName;
  color?: ColorToken;
  size?: number;
};

// Thin wrapper so screens pick an icon and a color token by semantic name
// (e.g. <Icon name="route" color="brand" />) instead of an Ionicons glyph and
// a hex value. Icons are decorative by default: the text beside them carries the meaning, so
// they are hidden from VoiceOver rather than read out as "image".
export function Icon({ name, color = "textPrimary", size = 24 }: Props) {
  const palette = useColors();
  return (
    <Ionicons
      name={iconGlyphFor(name)}
      color={palette[color]}
      size={size}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
