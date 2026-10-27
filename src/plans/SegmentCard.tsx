import { useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { AppText, Card, Chip } from "../theme/components";
import { radius, spacing } from "../theme/spacing";
import { useColors } from "../theme/useColors";
import { describeSegmentRow } from "../screens/describeSegmentRow";
import { RidePreviewThumbnail } from "../screens/RidePreviewThumbnail";
import type { SegmentCardData } from "./loadSegmentCards";
import type { PlanTone } from "./planView";

const TONE_TOKEN = { rest: "intensityRest", hold: "intensityHold", push: "intensityPush" } as const;
const PREVIEW_HEIGHT = 96;

/**
 * A segment as a card. The default (Segments list) shows the name, its length and efforts, a small
 * preview of the course and a bare "Karoo" check when the segment is on a Karoo. `compact` (Home) keeps the
 * plan line, the intensity strip and the "Last sent" mark. The plan itself lives on the segment page.
 */
export function SegmentCard({ data, onPress, compact = false }: { data: SegmentCardData; onPress: () => void; compact?: boolean }) {
  const colors = useColors();
  const [width, setWidth] = useState(0);
  const { summary, plan, mark } = data;
  const label = compact
    ? [summary.name, describeSegmentRow(summary), plan.line, mark?.label].filter(Boolean).join(". ")
    : [summary.name, describeSegmentRow(summary), data.onKaroo ? "On your Karoo" : undefined].filter(Boolean).join(". ");
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
        {compact ? (
          mark === undefined ? null : <Chip label={mark.label} tone={mark.tone === "success" ? "success" : "warning"} icon={mark.tone === "success" ? "check" : "alertTriangle"} />
        ) : data.onKaroo ? (
          <Chip label="Karoo" tone="success" icon="check" />
        ) : null}
      </View>
      {compact ? (
        <>
          <AppText variant="subheadline" color="textSecondary">
            {plan.line}
          </AppText>
          {plan.tones.length === 0 ? null : <PlanStrip tones={plan.tones} color={(tone) => colors[TONE_TOKEN[tone]]} />}
        </>
      ) : data.preview.length >= 2 ? (
        <View
          style={[styles.preview, { backgroundColor: colors.surfaceRaised }]}
          onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
          {width > 0 ? <RidePreviewThumbnail points={data.preview} width={width} height={PREVIEW_HEIGHT} strokeWidth={3} /> : null}
        </View>
      ) : null}
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
  preview: { height: PREVIEW_HEIGHT, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  strip: { flexDirection: "row", gap: 2, height: 8 },
  cell: { flex: 1, borderRadius: 3 },
});
