import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useDatabase } from "../db/DatabaseProvider";
import { getAthleteProfile } from "../db/getAthleteProfile";
import { addBackdatedWeight, listProfileHistory, removeBackdatedWeight, type ProfileHistoryEntry } from "../db/profileHistory";
import { setAthleteProfile } from "../db/setAthleteProfile";
import {
  defaultWeightUnit,
  kilogramsToDisplay,
  parseFtpInput,
  parseMaxHeartRateInput,
  parseWeightInput,
  type WeightUnit,
} from "../onboarding/riderNumbers";
import { colors } from "../theme/colors";
import { AppText, Button, SegmentedControl, TextField } from "../theme/components";
import { SCREEN_PADDING } from "../theme/layout";
import { spacing } from "../theme/spacing";
import { FTP_HELP } from "../onboarding/onboardingCopy";
import { parsePastDateInput } from "./parsePastDate";
import { formatRideDate } from "./formatRideStats";

/**
 * "Your Profile": the numbers GritMap uses to build pacing plans, predict finish times and show
 * power and heart-rate zones. Weight can be entered in pounds or kilograms; it is stored in kilograms.
 */
export function ZonesSettingsScreen() {
  const database = useDatabase();
  const [ftpInput, setFtpInput] = useState("");
  const [maxHrInput, setMaxHrInput] = useState("");
  const [weightInput, setWeightInput] = useState("");
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(() => defaultWeightUnit(deviceLocale()));
  const [errors, setErrors] = useState<{ ftp?: string; maxHr?: string; weight?: string }>({});
  const [saved, setSaved] = useState(false);
  // Past weights the rider entered for a date (for example the weight on the day of a personal best).
  const [pastDateInput, setPastDateInput] = useState("");
  const [pastWeightInput, setPastWeightInput] = useState("");
  const [pastError, setPastError] = useState<string | undefined>(undefined);
  const [pastWeights, setPastWeights] = useState<ProfileHistoryEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      const profile = getAthleteProfile(database);
      setFtpInput(profile.ftpWatts === undefined ? "" : String(profile.ftpWatts));
      setMaxHrInput(profile.maxHeartRateBpm === undefined ? "" : String(profile.maxHeartRateBpm));
      setWeightInput(profile.weightKg === undefined ? "" : kilogramsToDisplay(profile.weightKg, weightUnit));
      setSaved(false);
      setPastWeights(listProfileHistory(database).filter((entry) => entry.source === "backdated"));
      // The unit is deliberately not a dependency: switching it converts in place (below), not by reloading.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [database]),
  );

  function handleAddPastWeight() {
    const date = parsePastDateInput(pastDateInput, Date.now());
    if (!date.ok) {
      setPastError(date.error);
      return;
    }
    const weight = parseWeightInput(pastWeightInput, weightUnit);
    if (!weight.ok) {
      setPastError(weight.error);
      return;
    }
    const nowMs = Date.now();
    addBackdatedWeight(database, { effectiveFromMs: Math.min(date.value, nowMs), weightKg: weight.value, nowMs });
    setPastWeights(listProfileHistory(database).filter((entry) => entry.source === "backdated"));
    setPastDateInput("");
    setPastWeightInput("");
    setPastError(undefined);
  }

  function handleRemovePastWeight(id: number) {
    removeBackdatedWeight(database, id);
    setPastWeights(listProfileHistory(database).filter((entry) => entry.source === "backdated"));
  }

  function changeUnit(unit: WeightUnit) {
    if (unit === weightUnit) return;
    const parsed = parseWeightInput(weightInput, weightUnit);
    if (parsed.ok) setWeightInput(kilogramsToDisplay(parsed.value, unit));
    setWeightUnit(unit);
    setErrors((current) => ({ ...current, weight: undefined }));
  }

  function handleSave() {
    const next: { ftp?: string; maxHr?: string; weight?: string } = {};
    const ftp = ftpInput.trim().length === 0 ? undefined : parseFtpInput(ftpInput);
    const maxHr = maxHrInput.trim().length === 0 ? undefined : parseMaxHeartRateInput(maxHrInput);
    const weight = weightInput.trim().length === 0 ? undefined : parseWeightInput(weightInput, weightUnit);
    if (ftp !== undefined && !ftp.ok) next.ftp = ftp.error;
    if (maxHr !== undefined && !maxHr.ok) next.maxHr = maxHr.error;
    if (weight !== undefined && !weight.ok) next.weight = weight.error;
    setErrors(next);
    setSaved(false);
    if (next.ftp !== undefined || next.maxHr !== undefined || next.weight !== undefined) return;

    setAthleteProfile(database, {
      ...(ftp?.ok ? { ftpWatts: ftp.value } : {}),
      ...(maxHr?.ok ? { maxHeartRateBpm: maxHr.value } : {}),
      ...(weight?.ok ? { weightKg: weight.value } : {}),
      nowMs: Date.now(),
    });
    setSaved(true);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <AppText variant="body" color="textSecondary">
        GritMap uses these to build pacing plans, predict your finish time, and show which power and heart-rate zone you were in. They stay on your phone.
      </AppText>

      <TextField
        label="FTP"
        unit="watts"
        value={ftpInput}
        onChangeText={(text) => {
          setFtpInput(text);
          setErrors((current) => ({ ...current, ftp: undefined }));
          setSaved(false);
        }}
        placeholder="e.g. 250"
        hint={FTP_HELP}
        keyboardType="number-pad"
        {...(errors.ftp === undefined ? {} : { error: errors.ftp })}
      />

      <View style={styles.weightGroup}>
        <SegmentedControl
          accessibilityLabel="Weight unit"
          value={weightUnit}
          onChange={changeUnit}
          options={[
            { value: "lb", label: "lb", accessibilityLabel: "Pounds" },
            { value: "kg", label: "kg", accessibilityLabel: "Kilograms" },
          ]}
        />
        <TextField
          label="Weight"
          unit={weightUnit}
          value={weightInput}
          onChangeText={(text) => {
            setWeightInput(text);
            setErrors((current) => ({ ...current, weight: undefined }));
            setSaved(false);
          }}
          placeholder={weightUnit === "lb" ? "e.g. 165" : "e.g. 75"}
          hint="Needed for pacing plans and finish-time predictions."
          keyboardType="decimal-pad"
          {...(errors.weight === undefined ? {} : { error: errors.weight })}
        />
      </View>

      <TextField
        label="Max heart rate (optional)"
        unit="bpm"
        value={maxHrInput}
        onChangeText={(text) => {
          setMaxHrInput(text);
          setErrors((current) => ({ ...current, maxHr: undefined }));
          setSaved(false);
        }}
        placeholder="e.g. 185"
        hint="Used for heart-rate zones. Leave blank to hide them."
        keyboardType="number-pad"
        {...(errors.maxHr === undefined ? {} : { error: errors.maxHr })}
      />

      <Button label="Save" onPress={handleSave} />
      {saved ? (
        <AppText variant="subheadline" color="statusSuccess" align="center" accessibilityRole="alert" accessibilityLiveRegion="polite">
          Saved
        </AppText>
      ) : null}

      <View style={styles.pastGroup}>
        <AppText variant="headline" accessibilityRole="header">
          Past weights (optional)
        </AppText>
        <AppText variant="subheadline" color="textSecondary">
          If you weighed something different when you rode a personal best, add it here with the date of the ride. GritMap then judges that ride at the weight you had that day. Your current weight above is not changed.
        </AppText>
        {pastWeights.map((entry) => (
          <View key={entry.id} style={styles.pastRow}>
            <AppText variant="body" style={styles.pastText}>
              {`${formatRideDate(entry.effectiveFromMs)}: ${kilogramsToDisplay(entry.weightKg ?? 0, weightUnit)} ${weightUnit}`}
            </AppText>
            <Button
              label="Remove"
              variant="tertiary"
              fullWidth={false}
              accessibilityHint={`Removes the weight you entered for ${formatRideDate(entry.effectiveFromMs)}`}
              onPress={() => handleRemovePastWeight(entry.id)}
            />
          </View>
        ))}
        <TextField
          label="Date of the ride"
          value={pastDateInput}
          onChangeText={(text) => {
            setPastDateInput(text);
            setPastError(undefined);
          }}
          placeholder="e.g. 2025-05-10"
          hint="Year-month-day."
          keyboardType="numbers-and-punctuation"
        />
        <TextField
          label="Your weight that day"
          unit={weightUnit}
          value={pastWeightInput}
          onChangeText={(text) => {
            setPastWeightInput(text);
            setPastError(undefined);
          }}
          placeholder={weightUnit === "lb" ? "e.g. 200" : "e.g. 90"}
          keyboardType="decimal-pad"
          {...(pastError === undefined ? {} : { error: pastError })}
        />
        <Button label="Add past weight" variant="secondary" onPress={handleAddPastWeight} />
      </View>
    </ScrollView>
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
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: SCREEN_PADDING, paddingTop: spacing.space16, paddingBottom: spacing.space32, gap: spacing.space20 },
  weightGroup: { gap: spacing.space12 },
  pastGroup: { gap: spacing.space12 },
  pastRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.space12 },
  pastText: { flex: 1 },
});
