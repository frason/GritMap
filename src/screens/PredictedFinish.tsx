import { StyleSheet, View } from "react-native";
import type { PlanFinishPrediction } from "../pacing/predictPlanFinish";
import { AppText } from "../theme/components";
import { spacing } from "../theme/spacing";
import { describePlanPrediction } from "./describePlanPrediction";

type Props = {
  prediction: PlanFinishPrediction;
  /** The goal's time, only when that goal is for this segment. */
  goalDurationMs?: number;
  /** The plan's own target, when it states one. */
  coachTargetSeconds?: number;
  /** Said when the Karoo is given the predicted time as this plan's target ("Sent to the Karoo as…"). */
  targetNote?: string;
};

/** The predicted finish time for a plan, how it was worked out, and how it compares with the rider's goal. */
export function PredictedFinish({ prediction, goalDurationMs, coachTargetSeconds, targetNote }: Props) {
  const lines = describePlanPrediction({
    prediction,
    ...(goalDurationMs === undefined ? {} : { goalDurationMs }),
    ...(coachTargetSeconds === undefined ? {} : { coachTargetSeconds }),
  });
  return (
    <View
      accessible
      accessibilityLabel={[lines.headline, lines.basis, lines.goal, lines.coachTarget, targetNote]
        .filter((part): part is string => part !== undefined)
        .join(" ")}
      style={styles.block}
    >
      <AppText variant="headline">{lines.headline}</AppText>
      <AppText variant="footnote" color="textSecondary">
        {lines.basis}
      </AppText>
      {lines.goal === undefined ? null : <AppText variant="subheadline" style={styles.goal}>{lines.goal}</AppText>}
      {lines.coachTarget === undefined ? null : (
        <AppText variant="footnote" color="textSecondary">
          {lines.coachTarget}
        </AppText>
      )}
      {targetNote === undefined ? null : (
        <AppText variant="footnote" color="textSecondary">
          {targetNote}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.space4 },
  goal: { fontWeight: "600" },
});
