import { ScrollView, StyleSheet } from "react-native";
import { Icon } from "../Icon";
import { SCREEN_PADDING } from "../layout";
import { spacing } from "../spacing";
import { AppText } from "./AppText";
import { Button } from "./Button";

type Props = {
  title?: string;
  /** What went wrong and what the rider can do, never a stack trace or an internal term. */
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
};

/** Something failed. Says so plainly and offers a retry; announced to VoiceOver as an alert. */
export function ErrorState({ title = "Something went wrong", message, onRetry, retryLabel = "Try again" }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.content} accessibilityRole="alert">
      <Icon name="alertTriangle" size={44} color="statusDanger" />
      <AppText variant="title3" align="center" accessibilityRole="header">
        {title}
      </AppText>
      <AppText variant="body" color="textSecondary" align="center">
        {message}
      </AppText>
      {onRetry === undefined ? null : <Button label={retryLabel} onPress={onRetry} icon="refresh" variant="secondary" />}
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
});
