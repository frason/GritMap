import { StyleSheet, View } from "react-native";
import { AppText, Card, Chip } from "../theme/components";
import { spacing } from "../theme/spacing";
import { useColors } from "../theme/useColors";
import { describeSegmentRow } from "../screens/describeSegmentRow";
import type { SegmentCardData } from "./loadSegmentCards";
import type { PlanTone } from "./planView";

const TONE_TOKEN = { rest: "intensityRest", hold: "intensityHold", push: "intensityPush" } as const;

/** A segment as a card: name, a plan strip coloured by intensity, one line about the plan, and the Karoo mark. */
export function SegmentCard({ data, onPress, compact = false }: { data: SegmentCardData; onPress: () => void; compact?: boolean }) {
  const colors = useColors();
  const { summary, plan, mark } = data;
  const label = [summary.name, describeSegmentRow(summary), plan.line, mark?.label].filter(Boolean).join(". ");
  return (
    <Card onPress={onPress} accessibilityLabel={label} accessibilityHint="Opens this segment">
      <View style={styles.top}>
        <View style={styles.text}>
          <AppText variant="headline">{summary.name}</AppText>
          {compact ? null : (
            <AppText variant="footnote" color="textSecondary">
              {describeSegmentRow(summary)}
            </AppText>
          )}
        </View>
        {mark === undefined ? null : <Chip label={mark.label} tone={mark.tone === "success" ? "success" : "warning"} icon={mark.tone === "success" ? "check" : "alertTriangle"} />}
      </View>
      <AppText variant="subheadline" color="textSecondary">
        {plan.line}
      </AppText>
      {plan.tones.length === 0 ? null : <PlanStrip tones={plan.tones} color={(tone) => colors[TONE_TOKEN[tone]]} />}
    </Card>
  );
}

function PlanStrip({ tones, color }: { tones: PlanTone[]; color: (tone: PlanTone) => string }) {
  return (
    <View style={styles.strip} accessible={false} importantForAccessibility="no-hide-descendants">
      {tones.map((tone, index) => (
        <View key={index} style={[styles.cell, { backgroundColor: color(tone) }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "flex-start", gap: spacing.space8 },
  text: { flex: 1, gap: 2 },
  strip: { flexDirection: "row", gap: 2, height: 8 },
  cell: { flex: 1, borderRadius: 3 },
});
