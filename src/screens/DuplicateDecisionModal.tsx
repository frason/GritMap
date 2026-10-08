import { Modal, ScrollView, StyleSheet, View } from "react-native";
import { Icon } from "../theme/Icon";
import { AppText, Button } from "../theme/components";
import { radius, spacing } from "../theme/spacing";
import { useColors } from "../theme/useColors";
import type { DuplicateRule } from "../import/findDuplicate";

const RULE_DESCRIPTIONS: Record<DuplicateRule, string> = {
  "content-hash": "is identical to a ride you already imported.",
  "activity-id": "has the same activity ID as a ride you already imported.",
  "device-timing": "was recorded by the same device at the same start time as a ride you already imported.",
};

type Props = {
  visible: boolean;
  filename: string;
  matchedRule: DuplicateRule;
  onKeepExisting: () => void;
  onReplaceExisting: () => void;
};

/**
 * Asks what to do with a ride GritMap thinks it already has. "Keep the existing ride" skips this
 * file; "Replace the existing ride" keeps the ride's place in your list, swaps in this file's data,
 * and clears its segment matches so they are checked again (handled by replaceImportedRide -- this
 * modal only asks the question).
 */
export function DuplicateDecisionModal({ visible, filename, matchedRule, onKeepExisting, onReplaceExisting }: Props) {
  const palette = useColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onKeepExisting}>
      <View style={styles.backdrop}>
        <View style={[styles.scrim, { backgroundColor: palette.textPrimary }]} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          accessibilityViewIsModal
        >
          <View style={[styles.card, { backgroundColor: palette.surface }]}>
            <View style={[styles.iconChip, { backgroundColor: palette.statusWarningSubtle }]}>
              <Icon name="alertTriangle" color="statusWarning" size={24} />
            </View>
            <AppText variant="title3" align="center" accessibilityRole="header">
              This ride looks like a duplicate
            </AppText>
            <AppText variant="body" color="textSecondary" align="center">
              {filename} {RULE_DESCRIPTIONS[matchedRule]}
            </AppText>
            <AppText variant="footnote" color="textSecondary" align="center">
              Replacing keeps the ride in your list but uses this file's data, and checks it against your segments again. Any
              approvals you gave that ride's efforts are cleared.
            </AppText>
            <Button label="Keep the existing ride" onPress={onKeepExisting} />
            <Button label="Replace the existing ride" onPress={onReplaceExisting} variant="secondary" />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  scrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.45 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: spacing.space24 },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: radius.lg,
    padding: spacing.space24,
    alignItems: "center",
    gap: spacing.space16,
  },
  iconChip: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
});
