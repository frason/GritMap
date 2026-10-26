import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect, useRoute, type RouteProp } from "@react-navigation/native";
import { useDatabase } from "../db/DatabaseProvider";
import { getSegmentDetail, type SegmentDetail } from "../db/getSegmentDetail";
import type { SegmentsStackParamList } from "../navigation/types";
import { KAROO_SEND_SCREEN_STEPS } from "../onboarding/onboardingCopy";
import { AppText, Card, ErrorState, LoadingState, ScreenScroll } from "../theme/components";
import { isBleTransferEnabled } from "../transfer/bleTransferSettings";
import { BleSendSection } from "./BleSendSection";
import { WifiSendSection } from "./WifiSendSection";
import { spacing } from "../theme/spacing";

type SendToKarooRoute = RouteProp<SegmentsStackParamList, "SendToKaroo">;

/**
 * Sends this segment and its pacing plan to the Karoo. Bluetooth leads: the Bluetooth send first, then the steps. The Wi-Fi route (the
 * original address-based send, which can also send the segment alone) sits below as "Bluetooth not working? Use Wi-Fi" and opens
 * from there or from the fallback button inside the Bluetooth card. The wording is the same as the first-run onboarding
 * (onboardingCopy.ts) so a rider reads one set of instructions everywhere.
 */
export function SendToKarooScreen() {
  const database = useDatabase();
  const route = useRoute<SendToKarooRoute>();
  const [loadState, setLoadState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [segment, setSegment] = useState<SegmentDetail | undefined>(undefined);
  const [showWifi, setShowWifi] = useState(false);

  const load = useCallback(() => {
    try {
      const detail = getSegmentDetail(database, route.params.segmentId);
      setSegment(detail);
      setLoadState(detail === undefined ? "missing" : "ready");
    } catch {
      setLoadState("error");
    }
  }, [database, route.params.segmentId]);

  useFocusEffect(load);

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

  const bluetooth = isBleTransferEnabled(database);

  return (
    <ScreenScroll>
      <AppText variant="body" color="textSecondary">
        Send this segment and its pacing plan to your Karoo so it can guide you live when you ride it.
      </AppText>

      {bluetooth ? (
        <>
          <BleSendSection segment={segment} onUseWifi={() => setShowWifi(true)} wifiOpen={showWifi} />
          <Card>
            <AppText variant="headline">How to send</AppText>
            {KAROO_SEND_SCREEN_STEPS.map((item, index) => (
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
        </>
      ) : null}

      {!bluetooth || showWifi ? <WifiSendSection segment={segment} /> : null}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: "row", gap: spacing.space8, alignItems: "flex-start" },
  stepNumber: { fontWeight: "600", minWidth: 20 },
  stepText: { flex: 1, gap: spacing.space2 },
  stepTitle: { fontWeight: "600" },
});
