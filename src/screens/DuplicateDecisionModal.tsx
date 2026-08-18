import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Icon } from "../theme/Icon";
import { colors } from "../theme/colors";
import { radius, spacing } from "../theme/spacing";
import type { DuplicateRule } from "../import/findDuplicate";

const RULE_DESCRIPTIONS: Record<DuplicateRule, string> = {
  "content-hash": "matches an existing ride byte-for-byte.",
  "activity-id": "matches an existing ride by its recorded activity ID.",
  "device-timing": "matches an existing ride by recording device and start time (device-timing rule).",
};

type Props = {
  visible: boolean;
  filename: string;
  matchedRule: DuplicateRule;
  onKeepExisting: () => void;
  onReplaceExisting: () => void;
};

/** MVP's exact prompt language: "Keep Existing" cancels this file's import; "Replace
 * Existing" preserves the existing ride's id, replaces its content, and clears its match
 * decisions (handled by replaceImportedRide's cascade -- this modal only asks the question). */
export function DuplicateDecisionModal({
  visible,
  filename,
  matchedRule,
  onKeepExisting,
  onReplaceExisting,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onKeepExisting}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconChip}>
            <Icon name="alertTriangle" color="statusWarning" size={24} />
          </View>
          <Text style={styles.title}>This ride looks like a duplicate</Text>
          <Text style={styles.body}>
            {filename} {RULE_DESCRIPTIONS[matchedRule]}
          </Text>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={onReplaceExisting}
          >
            <Text style={styles.primaryButtonLabel}>Replace Existing</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={onKeepExisting}
          >
            <Text style={styles.secondaryButtonLabel}>Keep Existing</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.space24,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.space24,
    alignItems: "center",
    gap: spacing.space16,
  },
  iconChip: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.statusWarningSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.textPrimary,
    textAlign: "center",
  },
  body: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
  },
  button: {
    width: "100%",
    paddingVertical: spacing.space12,
    borderRadius: radius.md,
    alignItems: "center",
  },
  primaryButton: {
    backgroundColor: colors.brand,
  },
  primaryButtonLabel: {
    color: colors.textOnBrand,
    fontSize: 15,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: colors.brandSubtle,
  },
  secondaryButtonLabel: {
    color: colors.brand,
    fontSize: 15,
    fontWeight: "600",
  },
});
