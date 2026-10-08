import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { DatabaseProvider, useDatabase } from "./src/db/DatabaseProvider";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { OnboardingFlow } from "./src/onboarding/OnboardingFlow";
import { resolveOnboarding } from "./src/onboarding/onboardingState";

export default function App() {
  return (
    <SafeAreaProvider>
      <DatabaseProvider>
        <AppContent />
        <StatusBar style="auto" />
      </DatabaseProvider>
    </SafeAreaProvider>
  );
}

/** First-run onboarding on an empty install, then the main tabs. An existing install goes straight to the tabs. */
function AppContent() {
  const database = useDatabase();
  const [onboarding, setOnboarding] = useState<"show" | "done" | "skip">(() => resolveOnboarding(database, Date.now()));

  if (onboarding === "show") return <OnboardingFlow onFinished={() => setOnboarding("done")} />;

  return (
    <NavigationContainer>
      {/* A rider who has just finished onboarding lands on Segments, where the next step is. */}
      <RootNavigator initialTab={onboarding === "done" ? "SegmentsTab" : "HomeTab"} />
    </NavigationContainer>
  );
}
