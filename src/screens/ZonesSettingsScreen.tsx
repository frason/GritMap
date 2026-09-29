import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useDatabase } from "../db/DatabaseProvider";
import { getAthleteProfile } from "../db/getAthleteProfile";
import { setAthleteProfile } from "../db/setAthleteProfile";
import { colors } from "../theme/colors";
import { radius, spacing } from "../theme/spacing";

export function ZonesSettingsScreen() {
  const database = useDatabase();
  const [ftpInput, setFtpInput] = useState("");
  const [maxHrInput, setMaxHrInput] = useState("");
  const [status, setStatus] = useState<string | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      const profile = getAthleteProfile(database);
      setFtpInput(profile.ftpWatts === undefined ? "" : String(profile.ftpWatts));
      setMaxHrInput(profile.maxHeartRateBpm === undefined ? "" : String(profile.maxHeartRateBpm));
    }, [database]),
  );

  function handleSave() {
    const ftpWatts = parsePositiveInt(ftpInput);
    const maxHeartRateBpm = parsePositiveInt(maxHrInput);
    if (ftpInput.trim().length > 0 && ftpWatts === undefined) {
      setStatus("FTP must be a positive whole number of watts");
      return;
    }
    if (maxHrInput.trim().length > 0 && maxHeartRateBpm === undefined) {
      setStatus("Max heart rate must be a positive whole number of bpm");
      return;
    }
    setAthleteProfile(database, { ftpWatts, maxHeartRateBpm, nowMs: Date.now() });
    setStatus("Saved");
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.hint}>
        Used to show which power/heart-rate zone you were in during each attempt, alongside
        the raw values. Leave either blank to hide that zone breakdown.
      </Text>

      <View style={styles.field}>
        <Text style={styles.label}>FTP (watts)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 250"
          placeholderTextColor={colors.textTertiary}
          value={ftpInput}
          onChangeText={setFtpInput}
          keyboardType="number-pad"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Max heart rate (bpm)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 185"
          placeholderTextColor={colors.textTertiary}
          value={maxHrInput}
          onChangeText={setMaxHrInput}
          keyboardType="number-pad"
        />
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonLabel}>Save</Text>
      </TouchableOpacity>
      {status !== undefined && <Text style={styles.statusText}>{status}</Text>}
    </ScrollView>
  );
}

/** Empty input parses to undefined (clears the threshold); a non-numeric or non-positive input parses to undefined too, but the caller distinguishes that case to show an error. */
function parsePositiveInt(input: string): number | undefined {
  const trimmed = input.trim();
  if (trimmed.length === 0) return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) && Number.isInteger(value) && value > 0 ? value : undefined;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.space20,
    paddingTop: spacing.space16,
    paddingBottom: spacing.space32,
    gap: spacing.space16,
  },
  hint: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  field: {
    gap: spacing.space8 - 2,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.space16,
    paddingVertical: spacing.space12,
    fontSize: 15,
    color: colors.textPrimary,
  },
  saveButton: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: spacing.space12,
    alignItems: "center",
  },
  saveButtonLabel: {
    color: colors.textOnBrand,
    fontSize: 15,
    fontWeight: "600",
  },
  statusText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
