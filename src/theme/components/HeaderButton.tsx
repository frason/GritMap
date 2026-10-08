import { Pressable, StyleSheet } from "react-native";
import { Icon } from "../Icon";
import type { IconName } from "../icons";
import { MIN_TOUCH_TARGET } from "../layout";
import { AppText } from "./AppText";

type Props = {
  onPress: () => void;
  /** What VoiceOver says; required because a header button is often only an icon. */
  accessibilityLabel: string;
  accessibilityHint?: string;
  /** A visible word ("Import"). Omit for an icon-only button. */
  label?: string;
  icon?: IconName;
};

/** A navigation-bar button with a 44 x 44 pt touch target, in the brand color. */
export function HeaderButton({ onPress, accessibilityLabel, accessibilityHint, label, icon }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      {...(accessibilityHint === undefined ? {} : { accessibilityHint })}
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.6 : 1 }]}
    >
      {icon === undefined ? null : <Icon name={icon} size={22} color={label === undefined ? "textPrimary" : "brand"} />}
      {label === undefined ? null : (
        <AppText variant="headline" color="brand">
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minWidth: MIN_TOUCH_TARGET, minHeight: MIN_TOUCH_TARGET, alignItems: "center", justifyContent: "center", flexDirection: "row" },
});
