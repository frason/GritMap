import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect, useRoute, type RouteProp } from "@react-navigation/native";
import { useDatabase } from "../db/DatabaseProvider";
import { getSegmentDetail, type SegmentDetail } from "../db/getSegmentDetail";
import { describeSendResult } from "../karoo/describeSendResult";
import { getSavedKarooAddress, saveKarooAddress } from "../karoo/savedKarooAddress";
import { sendSegmentToKaroo } from "../karoo/sendSegmentToKaroo";
import type { SegmentsStackParamList } from "../navigation/types";
import { KAROO_ADDRESS_EXAMPLE, KAROO_RECEIVE_SCREEN, KAROO_STEPS } from "../onboarding/onboardingCopy";
import { AppText, Button, Card, ErrorState, LoadingState, Notice, ScreenScroll, TextField } from "../theme/components";
import { spacing } from "../theme/spacing";

type SendToKarooRoute = RouteProp<SegmentsStackParamList, "SendToKaroo">;

/**
 * Sends just the segment (its route) to a Karoo on the same Wi-Fi, with no plan. Reached from a
 * segment's menu; the step-by-step is the same wording the first-run onboarding uses
 * (onboardingCopy.ts) so a rider reads one set of instructions everywhere.
 */
export function SendToKarooScreen() {
  const database = useDatabase();
  const route = useRoute<SendToKarooRoute>();
  const [loadState, setLoadState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [segment, setSegment] = useState<SegmentDetail | undefined>(undefined);
  const [karooAddress, setKarooAddress] = useState("");
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<{ text: string; ok: boolean } | undefined>(undefined);

  const load = useCallback(() => {
    try {
      const detail = getSegmentDetail(database, route.params.segmentId);
      setSegment(detail);
      setKarooAddress((current) => (current === "" ? (getSavedKarooAddress(database) ?? "") : current));
      setLoadState(detail === undefined ? "missing" : "ready");
    } catch {
      setLoadState("error");
    }
  }, [database, route.params.segmentId]);

  useFocusEffect(load);

  async function handleSend() {
    if (segment === undefined) return;
    const trimmed = karooAddress.trim();
    if (trimmed.length === 0) {
      setSendStatus({ text: `Type the address your Karoo shows on its ${KAROO_RECEIVE_SCREEN} screen.`, ok: false });
      return;
    }
    setSending(true);
    setSendStatus(undefined);
    const result = await sendSegmentToKaroo(segment, trimmed);
    setSending(false);
    if (result.ok) setKarooAddress(saveKarooAddress(database, trimmed, Date.now()));
    setSendStatus({ text: describeSendResult(result, trimmed), ok: result.ok });
  }

  if (loadState === "loading") {
    return (
      <ScreenScroll>
        <LoadingState label="Loading segment…" />
      </ScreenScroll>
    );
  }
  if (loadState === "error") {
    return <ErrorState message="GritMap couldn't open this segment. Go back and try again." onRetry={load} />;
  }
  if (loadState === "missing" || segment === undefined) {
    return <ErrorState title="This segment is no longer available" message="It may have been removed. Go back to your segments and pick another." />;
  }

  return (
    <ScreenScroll>
      <AppText variant="body" color="textSecondary">
        Send this segment's route to your Karoo so it can find the start when you ride. This sends the route only; open the segment's pacing plan to send a plan as well.
      </AppText>

      <Card>
        <AppText variant="headline">How to send</AppText>
        {KAROO_STEPS.map((item, index) => (
          <View key={item.title} style={styles.step} accessible accessibilityLabel={`Step ${index + 1}. ${item.title}. ${item.body}`}>
            <AppText variant="subheadline" color="brand" style={styles.stepNumber}>
              {index + 1}.
            </AppText>
            <View style={styles.stepText}>
              <AppText variant="subheadline" style={styles.stepTitle}>
                {item.title}
              </AppText>
              <AppText variant="footnote" color="textSecondary">
                {item.body}
              </AppText>
            </View>
          </View>
        ))}
      </Card>

      <TextField
        label="Karoo address"
        value={karooAddress}
        onChangeText={setKarooAddress}
        placeholder={`e.g. ${KAROO_ADDRESS_EXAMPLE}`}
        hint={`Shown on the Karoo's ${KAROO_RECEIVE_SCREEN} screen. GritMap remembers it after a successful send.`}
        keyboardType="url"
        returnKeyType="send"
        onSubmitEditing={handleSend}
      />
      <Button label="Send route to Karoo" onPress={handleSend} loading={sending} />
      {sendStatus === undefined ? null : (
        <Notice tone={sendStatus.ok ? "success" : "error"} live>
          {sendStatus.text}
        </Notice>
      )}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: "row", gap: spacing.space8, alignItems: "flex-start" },
  stepNumber: { fontWeight: "600", minWidth: 20 },
  stepText: { flex: 1, gap: spacing.space2 },
  stepTitle: { fontWeight: "600" },
});
