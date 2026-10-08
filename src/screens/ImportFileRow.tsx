import { StyleSheet, View } from "react-native";
import { Icon } from "../theme/Icon";
import type { ColorToken } from "../theme/colors";
import { AppText } from "../theme/components";
import type { IconName } from "../theme/icons";
import { MIN_TOUCH_TARGET } from "../theme/layout";
import { radius, spacing } from "../theme/spacing";
import { useColors } from "../theme/useColors";

export type ImportRowStatus = "pending" | "imported" | "duplicate" | "replaced" | "failed";

const STATUS_CONFIG: Record<
  ImportRowStatus,
  { label: string; detail?: string; icon: IconName; foreground: ColorToken; background: ColorToken }
> = {
  pending: {
    label: "Waiting",
    icon: "clock",
    foreground: "textSecondary",
    background: "disabledBackground",
  },
  imported: {
    label: "Added",
    icon: "checkCircle",
    foreground: "statusSuccess",
    background: "statusSuccessSubtle",
  },
  duplicate: {
    label: "Already in GritMap",
    detail: "You already have this ride, so it was not added again.",
    icon: "alertTriangle",
    foreground: "statusWarning",
    background: "statusWarningSubtle",
  },
  replaced: {
    label: "Replaced",
    detail: "This file replaced the ride you already had.",
    icon: "checkCircle",
    foreground: "statusInfo",
    background: "statusInfoSubtle",
  },
  failed: {
    label: "Couldn't import",
    detail: "GritMap couldn't read this file. It needs to be a FIT or GPX ride file.",
    icon: "xCircle",
    foreground: "statusDanger",
    background: "statusDangerSubtle",
  },
};

type Props = {
  filename: string;
  status: ImportRowStatus;
};

/** One chosen file and what happened to it. The result is a word and an icon, not only a color. */
export function ImportFileRow({ filename, status }: Props) {
  const config = STATUS_CONFIG[status];
  const palette = useColors();
  return (
    <View
      accessible
      accessibilityLabel={`${filename}. ${config.label}.${config.detail === undefined ? "" : ` ${config.detail}`}`}
      style={[styles.row, { borderBottomColor: palette.border }]}
    >
      <View style={styles.top}>
        <Icon name="file" color="textSecondary" size={18} />
        <AppText variant="subheadline" style={styles.filename}>
          {filename}
        </AppText>
      </View>
      <View style={[styles.badge, { backgroundColor: palette[config.background] }]}>
        <Icon name={config.icon} color={config.foreground} size={14} />
        <AppText variant="footnote" color={config.foreground} style={styles.badgeLabel}>
          {config.label}
        </AppText>
      </View>
      {config.detail === undefined ? null : (
        <AppText variant="footnote" color="textSecondary">
          {config.detail}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: spacing.space12,
    gap: spacing.space8,
    borderBottomWidth: 1,
    alignItems: "flex-start",
  },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.space8 },
  filename: { flexShrink: 1 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.space4,
    paddingVertical: spacing.space4,
    paddingHorizontal: spacing.space8,
    borderRadius: radius.pill,
  },
  badgeLabel: { fontWeight: "600" },
});
