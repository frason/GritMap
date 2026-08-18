import { createContext, useContext, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors.ts";
import { initializeDatabase } from "./initializeDatabase.ts";
import type { SyncDatabase } from "./types.ts";

const DatabaseContext = createContext<SyncDatabase | null>(null);

export function useDatabase(): SyncDatabase {
  const database = useContext(DatabaseContext);
  if (!database) throw new Error("useDatabase() called outside DatabaseProvider");
  return database;
}

/** Opens and migrates the on-device database once, then makes it available via useDatabase(). */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [state] = useState<{ database: SyncDatabase | null; error: Error | null }>(() => {
    try {
      return { database: initializeDatabase(), error: null };
    } catch (error) {
      return { database: null, error: error instanceof Error ? error : new Error(String(error)) };
    }
  });

  if (!state.database) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Couldn't open the database</Text>
        <Text style={styles.errorMessage}>{state.error?.message ?? "Unknown error"}</Text>
      </View>
    );
  }

  return <DatabaseContext.Provider value={state.database}>{children}</DatabaseContext.Provider>;
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.statusDanger,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
