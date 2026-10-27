import { Linking, Pressable, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { AppText, Button, ScreenScroll } from "../theme/components";
import { MIN_TOUCH_TARGET } from "../theme/layout";
import { spacing } from "../theme/spacing";
import { useColors } from "../theme/useColors";
import { KAROO_SETUP_INTRO, KAROO_STEPS, WIFI_FALLBACK_STEPS } from "./onboardingCopy";

/**
 * "Connect your Karoo", opened from the Home checklist: update GritMap on the Karoo (with the APK and
 * Hammerhead links), then send over Bluetooth, with the Wi-Fi steps as the fallback. The words all come from
 * onboardingCopy.ts, the same source as the Send to Karoo screen.
 */
export function KarooSetupScreen() {
  const palette = useColors();
  const navigation = useNavigation();
  return (
    <ScreenScroll>
      <AppText variant="body" color="textSecondary">
        {KAROO_SETUP_INTRO}
      </AppText>
      {KAROO_STEPS.map((item, index) => (
        <View key={item.title} style={styles.numberedRow}>
          <View style={[styles.number, { backgroundColor: palette.ctaSubtle }]}>
            <AppText variant="headline" color="ctaText" accessibilityElementsHidden importantForAccessibility="no">
              {index + 1}
            </AppText>
          </View>
          <View style={styles.text}>
            <View accessible accessibilityLabel={`Step ${index + 1}. ${item.title}. ${item.body}`}>
              <AppText variant="headline">{item.title}</AppText>
              <AppText variant="subheadline" color="textSecondary">
                {item.body}
              </AppText>
            </View>
            {item.links?.map((link) => (
              <Pressable
                key={link.url}
                onPress={() => void Linking.openURL(link.url)}
                accessibilityRole="link"
                accessibilityLabel={link.label}
                accessibilityHint="Opens in your browser"
                style={styles.link}
              >
                <AppText variant="subheadlineEmphasized" color="ctaText" style={styles.linkText}>
                  {link.label}
                </AppText>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
      <AppText variant="headline" accessibilityRole="header">
        If Bluetooth does not work
      </AppText>
      <AppText variant="subheadline" color="textSecondary">
        You can send over Wi-Fi instead, from the segment's Send to Karoo screen.
      </AppText>
      {WIFI_FALLBACK_STEPS.map((item, index) => (
        <View key={item.title} style={styles.text} accessible accessibilityLabel={`Wi-Fi step ${index + 1}. ${item.title}. ${item.body}`}>
          <AppText variant="subheadlineEmphasized">{`${index + 1}. ${item.title}`}</AppText>
          <AppText variant="footnote" color="textSecondary">
            {item.body}
          </AppText>
        </View>
      ))}
      <AppText variant="footnote" color="textSecondary">
        No Karoo yet? You can still import rides and see how you did against a plan.
      </AppText>
      <Button label="I'll set this up later" variant="secondary" onPress={() => navigation.goBack()} />
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  numberedRow: { flexDirection: "row", gap: spacing.space12, alignItems: "flex-start" },
  number: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, gap: spacing.space4 },
  link: { minHeight: MIN_TOUCH_TARGET, justifyContent: "center", alignSelf: "flex-start" },
  linkText: { textDecorationLine: "underline" },
});
