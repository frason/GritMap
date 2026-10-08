import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { spacing } from "../spacing";
import { AppText } from "./AppText";

type Props = {
  title: string;
  /** One plain sentence under the title saying what the section is for. */
  description?: string;
  children: ReactNode;
};

/** A titled group of content on a screen. The title is a VoiceOver heading, so a rider can jump between sections. */
export function Section({ title, description, children }: Props) {
  return (
    <View style={styles.section}>
      <AppText variant="title3" accessibilityRole="header">
        {title}
      </AppText>
      {description === undefined ? null : (
        <AppText variant="subheadline" color="textSecondary">
          {description}
        </AppText>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.space12 },
});
