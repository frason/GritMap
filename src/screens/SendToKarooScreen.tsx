import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRoute, type RouteProp } from "@react-navigation/native";
import { useDatabase } from "../db/DatabaseProvider";
import { getSegmentDetail, type SegmentDetail } from "../db/getSegmentDetail";
import { sendSegmentToKaroo } from "../karoo/sendSegmentToKaroo";
import type { SegmentsStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { radius, spacing } from "../theme/spacing";

type SendToKarooRoute = RouteProp<SegmentsStackParamList, "SendToKaroo">;

/**
 * Sends the bare segment definition only -- route geometry and matching parameters, no
 * pacing plan or rider profile. Separated from the main segment screen (and reachable only
 * from its overflow menu) since it's a one-off setup action, not something looked at often.
 */
export function SendToKarooScreen() {
  const database = useDatabase();
  const route = useRoute<SendToKarooRoute>();
  const [segment, setSegment] = useState<SegmentDetail | undefined>(undefined);
  const [karooAddress, setKarooAddress] = useState("");
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<string | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      setSegment(getSegmentDetail(database, route.params.segmentId));
    }, [database, route.params.segmentId]),
  );

  async function handleSend() {
    if (segment === undefined) return;
    const trimmed = karooAddress.trim();
    if (trimmed.length === 0) {
      setSendStatus("Enter the Karoo's address (shown on its \"Receive from Phone\" screen)");
      return;
    }
    setSending(true);
    setSendStatus("Sending…");
    const result = await sendSegmentToKaroo(segment, trimmed);
    setSending(false);
    setSendStatus(
      result.ok
        ? "Sent — check the Karoo screen to confirm it imported"
        : `Send failed${result.statusCode ? ` (HTTP ${result.statusCode})` : ""}${
            result.message ? `: ${result.message}` : ""
          }`,
    );
  }

  if (segment === undefined) {
    return <View style={styles.container} />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Send to Karoo</Text>
      <Text style={styles.body}>
        Sends just this segment's route and matching parameters (the corridor and coverage
        settings) to a Karoo on the same WiFi network -- no pacing plan, no rider profile, no
        ride history. Use this to get the segment defined on the Karoo before you've set an
        FTP or a goal time for it; once those are set, the Pacing Plan section on the segment
        screen sends a fuller package that includes this same route data alongside the
        generated target-watts table.
      </Text>
      <Text style={styles.body}>
        On the Karoo, open the GritMap app and tap "Receive from Phone" -- it shows an
        address to type below. The phone and Karoo must be on the same WiFi network, and this
        is a one-shot listener: the Karoo only accepts a transfer while that screen is open.
      </Text>
      <TextInput
        style={styles.addressInput}
        placeholder="192.168.1.42:8734"
        placeholderTextColor={colors.textTertiary}
        value={karooAddress}
        onChangeText={setKarooAddress}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />
      <TouchableOpacity
        style={[styles.sendButton, sending && styles.sendButtonDisabled]}
        onPress={handleSend}
        disabled={sending}
      >
        <Text style={styles.sendButtonLabel}>{sending ? "Sending…" : "Send to Karoo"}</Text>
      </TouchableOpacity>
      {sendStatus !== undefined && <Text style={styles.sendStatusText}>{sendStatus}</Text>}
    </ScrollView>
  );
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
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  body: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  addressInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.space16,
    paddingVertical: spacing.space12,
    fontSize: 15,
    color: colors.textPrimary,
  },
  sendButton: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: spacing.space12,
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonLabel: {
    color: colors.textOnBrand,
    fontSize: 15,
    fontWeight: "600",
  },
  sendStatusText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
