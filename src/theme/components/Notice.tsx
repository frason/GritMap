import { StyleSheet, View } from "react-native";
import type { ColorToken } from "../colors";
import { Icon } from "../Icon";
import type { IconName } from "../icons";
import { radius, spacing } from "../spacing";
import { useColors } from "../useColors";
import { AppText } from "./AppText";

export type NoticeTone = "success" | "error" | "warning" | "info";

const TONES: Record<NoticeTone, { icon: IconName; text: ColorToken; background: ColorToken; spoken: string }> = {
  success: { icon: "checkCircle", text: "statusSuccess", background: "statusSuccessSubtle", spoken: "Success" },
  error: { icon: "xCircle", text: "statusDanger", background: "statusDangerSubtle", spoken: "Problem" },
  warning: { icon: "alertTriangle", text: "statusWarning", background: "statusWarningSubtle", spoken: "Heads up" },
  info: { icon: "info", text: "statusInfo", background: "statusInfoSubtle", spoken: "Note" },
};

/**
 * A short message about what just happened or what to watch for. The tone is carried by an icon and
 * a spoken prefix as well as color, and it is announced as it appears (results of a send or an import).
 */
export function Notice({ tone, children, live = false }: { tone: NoticeTone; children: string; live?: boolean }) {
  const palette = useColors();
  const style = TONES[tone];
  return (
    <View
      accessible
      accessibilityLabel={`${style.spoken}. ${children}`}
      {...(live ? { accessibilityRole: "alert" as const, accessibilityLiveRegion: "polite" as const } : {})}
      style={[styles.notice, { backgroundColor: palette[style.background] }]}
    >
      <Icon name={style.icon} size={20} color={style.text} />
      <AppText variant="subheadline" color={style.text} style={styles.text}>
        {children}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { flexDirection: "row", alignItems: "flex-start", gap: spacing.space8, borderRadius: radius.md, padding: spacing.space12 },
  text: { flex: 1 },
});
