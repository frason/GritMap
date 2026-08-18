import { StyleSheet, Text, View } from "react-native";
import { Icon } from "../theme/Icon";
import { colors, type ColorToken } from "../theme/colors";
import { spacing, radius } from "../theme/spacing";
import type { IconName } from "../theme/icons";

export type ImportRowStatus = "pending" | "imported" | "duplicate" | "replaced" | "failed";

const STATUS_CONFIG: Record<
  ImportRowStatus,
  { label: string; icon: IconName; foreground: ColorToken; background: ColorToken }
> = {
  pending: {
    label: "Pending",
    icon: "clock",
    foreground: "textSecondary",
    background: "disabledBackground",
  },
  imported: {
    label: "Imported",
    icon: "checkCircle",
    foreground: "statusSuccess",
    background: "statusSuccessSubtle",
  },
  duplicate: {
    label: "Duplicate",
    icon: "alertTriangle",
    foreground: "statusWarning",
    background: "statusWarningSubtle",
  },
  replaced: {
    label: "Replaced",
    icon: "checkCircle",
    foreground: "statusInfo",
    background: "statusInfoSubtle",
  },
  failed: {
    label: "Failed",
    icon: "xCircle",
    foreground: "statusDanger",
    background: "statusDangerSubtle",
  },
};

type Props = {
  filename: string;
  status: ImportRowStatus;
};

export function ImportFileRow({ filename, status }: Props) {
  const config = STATUS_CONFIG[status];
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Icon name="file" color="textSecondary" size={18} />
        <Text style={styles.filename} numberOfLines={1}>
          {filename}
        </Text>
      </View>
      <View style={[styles.badge, { backgroundColor: colors[config.background] }]}>
        <Icon name={config.icon} color={config.foreground} size={12} />
        <Text style={[styles.badgeLabel, { color: colors[config.foreground] }]}>
          {config.label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.space16 - 2,
    paddingHorizontal: spacing.space20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.space8 + 2,
    flex: 1,
    marginRight: spacing.space12,
  },
  filename: {
    fontSize: 13,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.space4,
    paddingVertical: spacing.space4,
    paddingHorizontal: spacing.space8,
    borderRadius: radius.pill,
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
});
