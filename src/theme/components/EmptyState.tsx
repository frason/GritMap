import { ScrollView, StyleSheet, View } from "react-native";
import { Icon } from "../Icon";
import type { IconName } from "../icons";
import { SCREEN_PADDING } from "../layout";
import { spacing } from "../spacing";
import { AppText } from "./AppText";
import { Button } from "./Button";
import type { ButtonVariant } from "./buttonStyle";

export interface EmptyStateAction {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  accessibilityHint?: string;
}

type Props = {
  icon: IconName;
  /** What is missing, in the rider's words ("No segments yet"). */
  title: string;
  /** Why it matters and what to do about it, in a sentence or two. */
  body?: string;
  /** The recommended next step, then up to two alternatives. */
  actions?: readonly EmptyStateAction[];
};

/**
 * What a screen shows when there is nothing to list yet. It always says what the thing is and how to
 * get one, and offers the actions. Scrolls, so it still works at the largest Dynamic Type sizes.
 */
export function EmptyState({ icon, title, body, actions = [] }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Icon name={icon} size={44} color="textTertiary" />
      <AppText variant="title3" align="center" accessibilityRole="header">
        {title}
      </AppText>
      {body === undefined ? null : (
        <AppText variant="body" color="textSecondary" align="center">
          {body}
        </AppText>
      )}
      <View style={styles.actions}>
        {actions.map((action, index) => (
          <Button
            key={action.label}
            label={action.label}
            onPress={action.onPress}
            variant={action.variant ?? (index === 0 ? "primary" : "secondary")}
            {...(action.icon === undefined ? {} : { icon: action.icon })}
            {...(action.accessibilityHint === undefined ? {} : { accessibilityHint: action.accessibilityHint })}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.space16,
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: spacing.space32,
  },
  actions: { alignSelf: "stretch", gap: spacing.space12, marginTop: spacing.space8 },
});
