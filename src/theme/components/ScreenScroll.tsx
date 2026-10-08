import type { ReactNode, Ref } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { SCREEN_PADDING } from "../layout";
import { spacing } from "../spacing";
import { useColors } from "../useColors";

type Props = {
  children: ReactNode;
  /** Content that runs edge to edge (a hero map) manages its own padding. */
  padded?: boolean;
  /** For a screen that scrolls itself to a section. */
  scrollRef?: Ref<ScrollView>;
};

/**
 * The scrolling root of a screen: background and side padding from the design system, and the same
 * ScrollView whether the screen is loading, empty or full, so the navigation bar's scroll tracking
 * never loses the scroll view when the content arrives.
 */
export function ScreenScroll({ children, padded = true, scrollRef }: Props) {
  const palette = useColors();
  return (
    <ScrollView
      ref={scrollRef}
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={padded ? styles.padded : styles.flush}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  padded: { flexGrow: 1, paddingHorizontal: SCREEN_PADDING, paddingTop: spacing.space16, paddingBottom: spacing.space32, gap: spacing.space16 },
  flush: { flexGrow: 1, paddingBottom: spacing.space32 },
});
