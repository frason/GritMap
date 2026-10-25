import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { getAppSetting, setAppSetting } from "../db/appSettings";
import { useDatabase } from "../db/DatabaseProvider";
import { APPEARANCE_SETTING_KEY, DEFAULT_APPEARANCE, parseAppearance, resolveScheme, type AppearancePreference, type ColorScheme } from "./appearance";

type AppearanceContextValue = {
  preference: AppearancePreference;
  scheme: ColorScheme;
  setPreference: (preference: AppearancePreference) => void;
};

const AppearanceContext = createContext<AppearanceContextValue | undefined>(undefined);

/**
 * Holds the rider's appearance choice (saved on the phone) and the scheme it resolves to. Put it
 * once near the top of the app, inside DatabaseProvider; useColors() and useAppearance() read it.
 */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const database = useDatabase();
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<AppearancePreference>(() => parseAppearance(getAppSetting(database, APPEARANCE_SETTING_KEY)));

  const setPreference = useCallback(
    (next: AppearancePreference) => {
      setPreferenceState(next);
      setAppSetting(database, APPEARANCE_SETTING_KEY, next, Date.now());
    },
    [database],
  );

  const value = useMemo(() => ({ preference, scheme: resolveScheme(preference, system), setPreference }), [preference, system, setPreference]);
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

/** The appearance choice and the scheme in use. Outside the provider (tests, previews) it is the default, light. */
export function useAppearance(): AppearanceContextValue {
  const context = useContext(AppearanceContext);
  const system = useColorScheme();
  return context ?? { preference: DEFAULT_APPEARANCE, scheme: resolveScheme(DEFAULT_APPEARANCE, system), setPreference: () => undefined };
}
