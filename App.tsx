import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { DatabaseProvider, useDatabase } from "./src/db/DatabaseProvider";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { OnboardingFlow } from "./src/onboarding/OnboardingFlow";
import { navigationColors } from "./src/navigation/navigationTheme";
import { resolveOnboarding } from "./src/onboarding/onboardingState";
import { AppearanceProvider, useAppearance } from "./src/theme/AppearanceProvider";
import { useColors } from "./src/theme/useColors";

export default function App() {
  return (
    <SafeAreaProvider>
      <DatabaseProvider>
        <AppearanceProvider>
          <AppContent />
          <ThemedStatusBar />
        </AppearanceProvider>
      </DatabaseProvider>
    </SafeAreaProvider>
  );
}

/** Light icons on a dark app, dark icons on a light one, following the rider's appearance choice. */
function ThemedStatusBar() {
  return <StatusBar style={useAppearance().scheme === "dark" ? "light" : "dark"} />;
}

/** First-run onboarding on an empty install, then the main tabs. An existing install goes straight to the tabs. */
function AppContent() {
  const database = useDatabase();
  const palette = useColors();
  const { scheme } = useAppearance();
  const [onboarding, setOnboarding] = useState<"show" | "done" | "skip">(() => resolveOnboarding(database, Date.now()));

  if (onboarding === "show") return <OnboardingFlow onFinished={() => setOnboarding("done")} />;

  return (
    <NavigationContainer theme={{ ...DefaultTheme, dark: scheme === "dark", colors: navigationColors(palette) }}>
      {/* A rider who has just finished onboarding lands on Segments, where the next step is. */}
      <RootNavigator initialTab={onboarding === "done" ? "SegmentsTab" : "HomeTab"} />
    </NavigationContainer>
  );
}
