import { StyleSheet, View } from "react-native";
import type { ColorToken } from "../colors";
import { radius } from "../spacing";
import { useColors } from "../useColors";
import { clampProgress, progressAccessibilityValue } from "./progress";

type Props = {
  /** 0 to 1. Out-of-range values are clamped. */
  value: number;
  /** What the bar measures, for VoiceOver ("Progress to your 40:00 goal"). */
  accessibilityLabel: string;
  /** The fill colour token. Defaults to the interactive blue; use an intensity or status token for other meanings. */
  tone?: ColorToken;
  height?: number;
};

/** A thin bar showing how far along something is, such as a rider's best time against a goal. */
export function ProgressBar({ value, accessibilityLabel, tone = "cta", height = 8 }: Props) {
  const palette = useColors();
  const fraction = clampProgress(value);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={progressAccessibilityValue(value)}
      style={[styles.track, { height, backgroundColor: palette.border }]}
    >
      <View style={{ width: `${fraction * 100}%`, height, borderRadius: radius.pill, backgroundColor: palette[tone] }} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { borderRadius: radius.pill, overflow: "hidden", alignSelf: "stretch" },
});
