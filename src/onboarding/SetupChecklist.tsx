import { StyleSheet, View } from "react-native";
import { AppText, Button, Card, InfoBubble, ProgressBar, ScreenScroll } from "../theme/components";
import { Icon } from "../theme/Icon";
import { spacing } from "../theme/spacing";
import { WHAT_YOU_NEED } from "./onboardingCopy";
import { nextSetupStep, type SetupStep, type SetupStepKey } from "./setupSteps";

/**
 * First-run Home: what GritMap needs, then four steps with the next one to do highlighted. The requirement text
 * comes from onboardingCopy.ts (one source), and each step opens the screen that does it.
 */
export function SetupChecklist({ steps, onAction }: { steps: readonly SetupStep[]; onAction: (key: SetupStepKey) => void }) {
  const doneCount = steps.filter((step) => step.done).length;
  const next = nextSetupStep(steps);
  return (
    <ScreenScroll>
      <Card>
        <View style={styles.row}>
          <AppText variant="headline" style={styles.grow}>
            {WHAT_YOU_NEED.intro}
          </AppText>
          <InfoBubble topic={WHAT_YOU_NEED.title}>{WHAT_YOU_NEED.body}</InfoBubble>
        </View>
        {WHAT_YOU_NEED.items.map((item) => (
          <View key={item} style={styles.row}>
            <Icon name="check" color="ctaText" size={18} />
            <AppText variant="subheadline" style={styles.grow}>
              {item}
            </AppText>
          </View>
        ))}
      </Card>

      <View style={styles.progress}>
        <AppText variant="subheadlineEmphasized" accessibilityRole="header">{`Get set up: ${doneCount} of ${steps.length}`}</AppText>
        <ProgressBar value={doneCount / steps.length} accessibilityLabel={`${doneCount} of ${steps.length} set-up steps done`} />
      </View>

      {steps.map((step) => {
        const isNext = next?.key === step.key;
        return (
          <Card key={step.key} raised={isNext}>
            <View style={styles.row} accessible accessibilityLabel={`${step.title}. ${step.done ? "Done." : step.body}`}>
              <Icon name={step.done ? "checkCircle" : step.icon} color={step.done ? "statusSuccess" : isNext ? "ctaText" : "textTertiary"} size={24} />
              <View style={styles.grow}>
                <AppText variant="headline" color={step.done ? "textSecondary" : "textPrimary"}>
                  {step.title}
                </AppText>
                {step.done ? null : (
                  <AppText variant="subheadline" color="textSecondary">
                    {step.body}
                  </AppText>
                )}
              </View>
            </View>
            {step.done ? null : <Button label={step.action} variant={isNext ? "primary" : "secondary"} onPress={() => onAction(step.key)} />}
          </Card>
        );
      })}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.space12 },
  grow: { flex: 1, gap: spacing.space2 },
  progress: { gap: spacing.space8 },
});
