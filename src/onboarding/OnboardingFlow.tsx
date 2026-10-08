import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  findNodeHandle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDatabase } from "../db/DatabaseProvider";
import { getAthleteProfile } from "../db/getAthleteProfile";
import { setAthleteProfile } from "../db/setAthleteProfile";
import { Icon } from "../theme/Icon";
import { MIN_TOUCH_TARGET, SCREEN_PADDING } from "../theme/layout";
import { spacing } from "../theme/spacing";
import { useColors } from "../theme/useColors";
import { AppText, Button, Card, SegmentedControl, TextField } from "../theme/components";
import {
  FTP_HELP,
  KAROO_STEPS,
  ONBOARDING_STEPS,
  SEGMENT_WAYS,
  WELCOME_POINTS,
} from "./onboardingCopy";
import { markOnboardingComplete } from "./onboardingState";
import {
  defaultWeightUnit,
  kilogramsToDisplay,
  parseFtpInput,
  parseWeightInput,
  type WeightUnit,
} from "./riderNumbers";

/**
 * First-run onboarding, shown once on an empty install before the main tabs: what GritMap does,
 * the rider's FTP and weight, how to get a segment, and how to connect the Karoo. Every step after
 * the first can be skipped; nothing here is required to use the app, and each skipped thing is
 * reachable later from where it is used.
 */
export function OnboardingFlow({ onFinished }: { onFinished: () => void }) {
  const database = useDatabase();
  const palette = useColors();
  const [stepIndex, setStepIndex] = useState(0);
  const step = ONBOARDING_STEPS[stepIndex]!;
  const titleRef = useRef<View>(null);

  const stored = getAthleteProfile(database);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(() => defaultWeightUnit(deviceLocale()));
  const [ftpInput, setFtpInput] = useState(stored.ftpWatts === undefined ? "" : String(stored.ftpWatts));
  const [weightInput, setWeightInput] = useState(
    stored.weightKg === undefined ? "" : kilogramsToDisplay(stored.weightKg, defaultWeightUnit(deviceLocale())),
  );
  const [ftpError, setFtpError] = useState<string | undefined>(undefined);
  const [weightError, setWeightError] = useState<string | undefined>(undefined);

  // While the keyboard is up the two-button footer would leave almost no room for the form, so the
  // footer collapses to a single Done button (there is no return key on a number pad) and returns after.
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Move VoiceOver to the new step's title so the change is announced.
  useEffect(() => {
    const tag = findNodeHandle(titleRef.current);
    if (tag !== null) AccessibilityInfo.setAccessibilityFocus(tag);
  }, [stepIndex]);

  function finish() {
    markOnboardingComplete(database, Date.now());
    onFinished();
  }

  function next() {
    if (stepIndex === ONBOARDING_STEPS.length - 1) finish();
    else setStepIndex(stepIndex + 1);
  }

  function changeUnit(unit: WeightUnit) {
    if (unit === weightUnit) return;
    const parsed = parseWeightInput(weightInput, weightUnit);
    // Carry what was typed across the unit switch so the rider does not have to re-enter it.
    if (parsed.ok) setWeightInput(kilogramsToDisplay(parsed.value, unit));
    setWeightUnit(unit);
    setWeightError(undefined);
  }

  /** Saves FTP and weight if entered. Returns false (showing why) if what was entered is not usable. */
  function saveNumbers(): boolean {
    const ftpEntered = ftpInput.trim().length > 0;
    const weightEntered = weightInput.trim().length > 0;
    const ftp = ftpEntered ? parseFtpInput(ftpInput) : undefined;
    const weight = weightEntered ? parseWeightInput(weightInput, weightUnit) : undefined;
    setFtpError(ftp !== undefined && !ftp.ok ? ftp.error : undefined);
    setWeightError(weight !== undefined && !weight.ok ? weight.error : undefined);
    if ((ftp !== undefined && !ftp.ok) || (weight !== undefined && !weight.ok)) return false;

    if (ftp !== undefined || weight !== undefined) {
      const existing = getAthleteProfile(database);
      setAthleteProfile(database, {
        ...(existing.maxHeartRateBpm === undefined ? {} : { maxHeartRateBpm: existing.maxHeartRateBpm }),
        ...(ftp?.ok ? { ftpWatts: ftp.value } : existing.ftpWatts === undefined ? {} : { ftpWatts: existing.ftpWatts }),
        ...(weight?.ok ? { weightKg: weight.value } : existing.weightKg === undefined ? {} : { weightKg: existing.weightKg }),
        nowMs: Date.now(),
      });
    }
    return true;
  }

  const isLast = stepIndex === ONBOARDING_STEPS.length - 1;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <View style={styles.topBar}>
          {stepIndex > 0 ? (
            <Pressable
              onPress={() => setStepIndex(stepIndex - 1)}
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={8}
              style={styles.back}
            >
              <Icon name="chevronLeft" size={22} color="brand" />
              <AppText variant="body" color="brand">
                Back
              </AppText>
            </Pressable>
          ) : (
            <View style={styles.back} />
          )}
          <View
            style={styles.dots}
            accessible
            accessibilityLabel={`Step ${stepIndex + 1} of ${ONBOARDING_STEPS.length}`}
          >
            {ONBOARDING_STEPS.map((item, index) => (
              <View
                key={item.key}
                style={[styles.dot, { backgroundColor: index <= stepIndex ? palette.brand : palette.borderStrong }]}
              />
            ))}
          </View>
          <View style={styles.back} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View ref={titleRef} accessible accessibilityRole="header">
            <AppText variant="title1">{headline(step.key)}</AppText>
          </View>

          {step.key === "welcome" ? <WelcomeStep /> : null}
          {step.key === "numbers" ? (
            <NumbersStep
              ftpInput={ftpInput}
              onFtpChange={(text) => {
                setFtpInput(text);
                setFtpError(undefined);
              }}
              ftpError={ftpError}
              weightInput={weightInput}
              onWeightChange={(text) => {
                setWeightInput(text);
                setWeightError(undefined);
              }}
              weightError={weightError}
              weightUnit={weightUnit}
              onUnitChange={changeUnit}
            />
          ) : null}
          {step.key === "segments" ? <SegmentsStep /> : null}
          {step.key === "karoo" ? <KarooStep /> : null}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: palette.border, backgroundColor: palette.background }]}>
          {keyboardVisible ? (
            <Button label="Done" variant="tertiary" onPress={Keyboard.dismiss} />
          ) : (
            <>
              {step.key === "welcome" ? <Button label="Get started" onPress={next} /> : null}
              {step.key === "numbers" ? (
                <>
                  <Button
                    label="Continue"
                    onPress={() => {
                      if (saveNumbers()) next();
                    }}
                  />
                  <Button label="Skip for now" variant="tertiary" onPress={next} />
                </>
              ) : null}
              {step.key === "segments" ? <Button label="Continue" onPress={next} /> : null}
              {isLast ? (
                <>
                  <Button label="Finish" onPress={finish} />
                  <Button label="I'll set this up later" variant="tertiary" onPress={finish} />
                </>
              ) : null}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function headline(key: (typeof ONBOARDING_STEPS)[number]["key"]): string {
  switch (key) {
    case "welcome":
      return "Get faster on the climbs you care about";
    case "numbers":
      return "Your numbers";
    case "segments":
      return "Pick a segment";
    case "karoo":
      return "Connect your Karoo";
  }
}

function WelcomeStep() {
  return (
    <View style={styles.stack}>
      <AppText variant="body" color="textSecondary">
        GritMap plans how to pace a climb, guides you through it live on your Karoo, and shows you afterwards how it went.
      </AppText>
      {WELCOME_POINTS.map((point) => (
        <Card key={point.title}>
          <View style={styles.pointRow}>
            <Icon name={point.icon} size={26} color="brand" />
            <View style={styles.pointText}>
              <AppText variant="headline">{point.title}</AppText>
              <AppText variant="subheadline" color="textSecondary">
                {point.body}
              </AppText>
            </View>
          </View>
        </Card>
      ))}
    </View>
  );
}

function NumbersStep(props: {
  ftpInput: string;
  onFtpChange: (text: string) => void;
  ftpError: string | undefined;
  weightInput: string;
  onWeightChange: (text: string) => void;
  weightError: string | undefined;
  weightUnit: WeightUnit;
  onUnitChange: (unit: WeightUnit) => void;
}) {
  return (
    <View style={styles.stack}>
      <AppText variant="body" color="textSecondary">
        GritMap turns your goal time into target watts, and predicts your finish time, from these two numbers. Both stay on your phone.
      </AppText>
      <TextField
        label="FTP"
        unit="watts"
        value={props.ftpInput}
        onChangeText={props.onFtpChange}
        placeholder="e.g. 250"
        hint={FTP_HELP}
        keyboardType="number-pad"
        {...(props.ftpError === undefined ? {} : { error: props.ftpError })}
      />
      <SegmentedControl
        accessibilityLabel="Weight unit"
        value={props.weightUnit}
        onChange={props.onUnitChange}
        options={[
          { value: "lb", label: "lb", accessibilityLabel: "Pounds" },
          { value: "kg", label: "kg", accessibilityLabel: "Kilograms" },
        ]}
      />
      <TextField
        label="Weight"
        unit={props.weightUnit}
        value={props.weightInput}
        onChangeText={props.onWeightChange}
        placeholder={props.weightUnit === "lb" ? "e.g. 165" : "e.g. 75"}
        hint="Your weight, with your kit, is how GritMap works out how fast a given power will take you uphill."
        keyboardType="decimal-pad"
        {...(props.weightError === undefined ? {} : { error: props.weightError })}
      />
      <AppText variant="footnote" color="textSecondary">
        You can skip this now. Without both numbers GritMap can still import and compare your rides, but it cannot build a pacing plan.
      </AppText>
    </View>
  );
}

function SegmentsStep() {
  return (
    <View style={styles.stack}>
      <AppText variant="body" color="textSecondary">
        A segment is the stretch of road you want to get faster on. There are three ways to get one. You can do this after setup too.
      </AppText>
      {SEGMENT_WAYS.map((way) => (
        <Card key={way.title}>
          <View style={styles.pointRow}>
            <Icon name={way.icon} size={26} color="brand" />
            <View style={styles.pointText}>
              <AppText variant="headline">{way.title}</AppText>
              <AppText variant="subheadline" color="textSecondary">
                {way.body}
              </AppText>
            </View>
          </View>
        </Card>
      ))}
    </View>
  );
}

function KarooStep() {
  const palette = useColors();
  return (
    <View style={styles.stack}>
      <AppText variant="body" color="textSecondary">
        To ride a segment with live pacing, GritMap sends it and its plan to your Karoo over Wi-Fi. Do this when you are ready to ride; you can skip it for now.
      </AppText>
      {KAROO_STEPS.map((item, index) => (
        <View key={item.title} style={styles.numberedRow}>
          <View style={[styles.number, { backgroundColor: palette.brandSubtle }]}>
            <AppText variant="headline" color="brand" accessibilityElementsHidden importantForAccessibility="no">
              {index + 1}
            </AppText>
          </View>
          <View style={styles.pointText} accessible accessibilityLabel={`Step ${index + 1}. ${item.title}. ${item.body}`}>
            <AppText variant="headline">{item.title}</AppText>
            <AppText variant="subheadline" color="textSecondary">
              {item.body}
            </AppText>
          </View>
        </View>
      ))}
      <AppText variant="footnote" color="textSecondary">
        No Karoo yet? You can still import rides and see how you did against a plan.
      </AppText>
    </View>
  );
}

function deviceLocale(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: spacing.space8,
    minHeight: MIN_TOUCH_TARGET,
  },
  back: { flexDirection: "row", alignItems: "center", minWidth: 72, minHeight: MIN_TOUCH_TARGET },
  dots: { flexDirection: "row", gap: spacing.space8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  content: { paddingHorizontal: SCREEN_PADDING, paddingTop: spacing.space16, paddingBottom: spacing.space24, gap: spacing.space16 },
  stack: { gap: spacing.space16 },
  pointRow: { flexDirection: "row", gap: spacing.space12, alignItems: "flex-start" },
  pointText: { flex: 1, gap: spacing.space4 },
  numberedRow: { flexDirection: "row", gap: spacing.space12, alignItems: "flex-start" },
  number: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  footer: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: spacing.space12,
    paddingBottom: spacing.space12,
    gap: spacing.space8,
    borderTopWidth: 1,
  },
});
