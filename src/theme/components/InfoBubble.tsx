import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { Icon } from "../Icon";
import { MIN_TOUCH_TARGET, SCREEN_PADDING } from "../layout";
import { spacing } from "../spacing";
import { useColors } from "../useColors";
import { AppText } from "./AppText";
import { Button } from "./Button";
import { Card } from "./Card";

type Props = {
  /** What this explains, in a few words ("Predicted finish"). It titles the bubble and names the button for VoiceOver. */
  topic: string;
  /** The explanation, in plain language for a cyclist who has never seen GritMap. Keep it to a few sentences. */
  children: string;
};

/**
 * A small (i) next to a heading or value. Explanations live here instead of as paragraphs on the
 * screen; the screen stays readable without them. First-run and Karoo-setup steps stay visible and
 * do not use this.
 */
export function InfoBubble({ topic, children }: Props) {
  const palette = useColors();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={(MIN_TOUCH_TARGET - 18) / 2}
        accessibilityRole="button"
        accessibilityLabel={`About ${topic}`}
        accessibilityHint="Opens a short explanation"
        style={styles.trigger}
      >
        <Icon name="info" size={18} color="textTertiary" />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable
            style={[styles.scrim, { backgroundColor: palette.scrim }]}
            onPress={() => setOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
          <View accessibilityViewIsModal style={styles.cardWrap}>
            <Card raised>
              <AppText variant="headline" accessibilityRole="header">
                {topic}
              </AppText>
              <AppText variant="subheadline" color="textSecondary">
                {children}
              </AppText>
              <Button label="Got it" variant="secondary" onPress={() => setOpen(false)} />
            </Card>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { alignItems: "center", justifyContent: "center" },
  backdrop: { flex: 1, justifyContent: "center", padding: SCREEN_PADDING },
  scrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.45 },
  cardWrap: { paddingHorizontal: spacing.space4 },
});
