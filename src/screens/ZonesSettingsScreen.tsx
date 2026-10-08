import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useDatabase } from "../db/DatabaseProvider";
import { getAthleteProfile } from "../db/getAthleteProfile";
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

  useFocusEffect(
    useCallback(() => {
      const profile = getAthleteProfile(database);
      setFtpInput(profile.ftpWatts === undefined ? "" : String(profile.ftpWatts));
      setMaxHrInput(profile.maxHeartRateBpm === undefined ? "" : String(profile.maxHeartRateBpm));
      setWeightInput(profile.weightKg === undefined ? "" : kilogramsToDisplay(profile.weightKg, weightUnit));
      setSaved(false);
      // The unit is deliberately not a dependency: switching it converts in place (below), not by reloading.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [database]),
  );

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
});
