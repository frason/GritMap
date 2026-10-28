import { StyleSheet, View } from "react-native";
import { AppText, Button, Card, Chip, InfoBubble, Notice, ProgressBar } from "../theme/components";
import { Icon } from "../theme/Icon";
import { spacing } from "../theme/spacing";
import { useColors } from "../theme/useColors";
import { formatDurationMinutesSeconds } from "../screens/formatRideStats";
import { ElevationProfileChart } from "../screens/ElevationProfileChart";
import type { PlanScreenModel } from "./planScreenModel";
import { TONE_MEANINGS, type PlanSectionRow, type PlanTone } from "./planView";

const TONE_COLORS: Record<PlanTone, { text: "intensityRest" | "intensityHold" | "intensityPush"; subtle: "intensityRestSubtle" | "intensityHoldSubtle" | "intensityPushSubtle" }> = {
  rest: { text: "intensityRest", subtle: "intensityRestSubtle" },
  hold: { text: "intensityHold", subtle: "intensityHoldSubtle" },
  push: { text: "intensityPush", subtle: "intensityPushSubtle" },
};

export interface PlanTabProps {
  model: PlanScreenModel;
  referencePolyline: Parameters<typeof ElevationProfileChart>[0]["referencePolyline"];
  onEditGoal: () => void;
  onSetGoalToBeatBest: (durationMs: number) => void;
  onSetNextGoal: (durationMs: number) => void;
  onImportPlan: () => void;
  onUseGeneratedPlan: () => void;
  onOpenProfile: () => void;
}

/**
 * The Plan view of a segment: the goal, then the plan for it (the chart, the sections, the predicted finish),
 * then Send. What the rider reads here is what is sent: the Plan screen model follows the same rules as the send.
 */
export function PlanTab(props: PlanTabProps) {
  const { model } = props;
  if (model.kind === "needs-ftp") {
    return (
      <Card>
        <AppText variant="headline">Set your FTP to get a plan</AppText>
        <AppText variant="subheadline" color="textSecondary">
          GritMap builds each section's power from the power you can hold for about an hour.
        </AppText>
        <Button label="Set your FTP" onPress={props.onOpenProfile} />
      </Card>
    );
  }
  if (model.kind === "needs-goal") {
    return (
      <View style={styles.stack}>
        <Card>
          <AppText variant="headline">How fast do you want to ride this?</AppText>
          <AppText variant="subheadline" color="textSecondary">
            Pick a goal time and GritMap builds the power for each section.
          </AppText>
          {model.otherGoal === undefined ? null : (
            <Notice tone="info">{`Your current goal is on ${model.otherGoal.name}: ${formatDurationMinutesSeconds(model.otherGoal.durationMs)}. Setting one here switches it to this segment.`}</Notice>
          )}
          {model.goalRange === undefined ? null : (
            <AppText variant="footnote" color="textSecondary">
              {`At your FTP this takes about ${formatDurationMinutesSeconds(model.goalRange.typicalMs)}.`}
            </AppText>
          )}
          {model.suggestedBeatBestMs === undefined || model.beatBestMs === undefined ? null : (
            <Button
              label={`Beat my best (${formatDurationMinutesSeconds(model.suggestedBeatBestMs)})`}
              variant="secondary"
              onPress={() => props.onSetGoalToBeatBest(model.suggestedBeatBestMs!)}
              accessibilityHint={`Sets a goal about one percent faster than your best of ${formatDurationMinutesSeconds(model.beatBestMs)}`}
            />
          )}
          <Button label="Set a goal time" onPress={props.onEditGoal} />
          <Button label="Import a coach plan instead" variant="tertiary" fullWidth={false} onPress={props.onImportPlan} />
        </Card>
      </View>
    );
  }
  return <PlanBody {...props} model={model} />;
}

function PlanBody(props: PlanTabProps & { model: Extract<PlanScreenModel, { kind: "plan" }> }) {
  const { model } = props;
  return (
    <View style={styles.stack}>
      <Card>
        <View style={styles.titleRow}>
          <View style={styles.titleText}>
            <AppText variant="subheadlineEmphasized" color="textSecondary">
              {model.goal === undefined ? model.sourceLabel : model.goal.longTermMs === undefined ? "Goal" : "Next goal"}
            </AppText>
            {model.goal === undefined ? null : <AppText variant="title2">{formatDurationMinutesSeconds(model.goal.nextMs)}</AppText>}
          </View>
          {model.lastSent === undefined ? null : <Chip label={model.lastSent} tone="neutral" icon="check" />}
        </View>
        {model.goal?.progress === undefined ? null : (
          <ProgressBar value={model.goal.progress} accessibilityLabel={`Progress to your ${formatDurationMinutesSeconds(model.goal.nextMs)} goal`} />
        )}
        {model.goal === undefined ? null : (
          <View style={styles.stageRow}>
            {model.goal.stages.map((stage) => (
              <View key={stage.key} style={styles.stage} accessible accessibilityLabel={`${stage.label} ${stage.timeLabel}`}>
                <AppText variant="footnote" color="textSecondary">{stage.label}</AppText>
                <AppText variant="subheadlineEmphasized">{stage.timeLabel}</AppText>
              </View>
            ))}
          </View>
        )}
        {model.goal?.staged?.progress === undefined ? null : (
          <AppText variant="subheadline" color="textSecondary">{model.goal.staged.progress}</AppText>
        )}
        {model.goal?.staged?.reached === undefined ? null : <Notice tone="success">{model.goal.staged.reached}</Notice>}
        {model.goal?.staged?.suggestedNextGoalMs === undefined ? null : (
          <Button
            label={`Set my next goal to ${formatDurationMinutesSeconds(model.goal.staged.suggestedNextGoalMs)}`}
            variant="secondary"
            onPress={() => props.onSetNextGoal(model.goal!.staged!.suggestedNextGoalMs!)}
          />
        )}
        {model.origin === "generated" ? (
          <Button label="Change goal" variant="tertiary" fullWidth={false} onPress={props.onEditGoal} accessibilityHint="Edit your goal time" />
        ) : null}
        <View style={styles.footerRow}>
          <Icon name="file" size={16} color="textSecondary" />
          <AppText variant="footnote" color="textSecondary" style={styles.footerText}>{model.sourceLabel}</AppText>
          <Button
            label={model.origin === "imported" ? "Replace" : "Import a coach plan"}
            variant="tertiary"
            fullWidth={false}
            onPress={props.onImportPlan}
          />
          {model.origin === "imported" ? (
            <Button label="Use GritMap's plan" variant="tertiary" fullWidth={false} onPress={props.onUseGeneratedPlan} />
          ) : null}
        </View>
      </Card>

      {model.prediction === undefined ? (
        model.needsWeight ? (
          <Button label="Set your weight to see a predicted finish" variant="tertiary" fullWidth={false} onPress={props.onOpenProfile} />
        ) : null
      ) : (
        <Card>
          <View style={styles.titleRow}>
            <View style={styles.titleText}>
              <AppText variant="subheadlineEmphasized" color="textSecondary">Predicted finish</AppText>
              <AppText variant="title2">{formatDurationMinutesSeconds(model.prediction.durationMs)}</AppText>
            </View>
            <InfoBubble topic="Predicted finish">{model.prediction.lines.basis}</InfoBubble>
          </View>
          {model.prediction.lines.goal === undefined ? null : <AppText variant="subheadline">{model.prediction.lines.goal}</AppText>}
          {model.prediction.lines.coachTarget === undefined ? null : (
            <AppText variant="footnote" color="textSecondary">{model.prediction.lines.coachTarget}</AppText>
          )}
        </Card>
      )}

      {model.feasibility === undefined ? null : <Notice tone={model.feasibility.tone}>{`${model.feasibility.headline} ${model.feasibility.detail}`}</Notice>}
      {model.outdated === undefined ? null : (
        <Notice tone="warning">
          {`Written for an FTP of ${model.outdated.planFtpWatts} W; yours is now ${model.outdated.currentFtpWatts} W. Import an updated plan, or switch back to GritMap's own plan, before sending.`}
        </Notice>
      )}

      <Card>
        <View style={styles.titleRow}>
          <View style={styles.titleText}>
            <AppText variant="headline">Targets by section</AppText>
            <AppText variant="footnote" color="textSecondary">
              {`${model.summary.sectionCount} sections · about ${model.summary.averageWatts} W (${model.summary.percentOfFtp}% of FTP)`}
            </AppText>
          </View>
          <InfoBubble topic="Targets by section">{`Each section has a power to aim for. Rest: ${TONE_MEANINGS.rest.toLowerCase()}. Hold: ${TONE_MEANINGS.hold.toLowerCase()}. Push: ${TONE_MEANINGS.push.toLowerCase()}.`}</InfoBubble>
        </View>
        <ElevationProfileChart referencePolyline={props.referencePolyline} zones={model.zones} />
        {model.sections.map((section) => (
          <SectionRowView key={section.number} section={section} />
        ))}
        {model.notes === undefined ? null : <AppText variant="subheadline" color="textSecondary">{model.notes}</AppText>}
      </Card>

    </View>
  );
}

function SectionRowView({ section }: { section: PlanSectionRow }) {
  const colors = useColors();
  const tone = TONE_COLORS[section.tone];
  return (
    <View
      accessible
      accessibilityLabel={`Section ${section.number}, ${section.rangeLabel}, ${section.watts} watts, ${section.toneLabel}`}
      style={styles.sectionRow}
    >
      <View style={[styles.swatch, { backgroundColor: colors[tone.subtle] }]}>
        <AppText variant="footnoteEmphasized" style={{ color: colors[tone.text] }}>{section.number}</AppText>
      </View>
      <AppText variant="subheadline" color="textSecondary" style={styles.sectionRange}>{section.rangeLabel}</AppText>
      <AppText variant="subheadlineEmphasized">{`${section.watts} W`}</AppText>
      <Chip label={section.toneLabel} tone={section.tone} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.space12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.space8 },
  titleText: { flex: 1, gap: spacing.space4 },
  stageRow: { flexDirection: "row", justifyContent: "space-between" },
  stage: { gap: 2 },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: spacing.space12 },
  swatch: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  sectionRange: { flex: 1 },
  footerRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.space8 },
  footerText: { flex: 1 },
});
