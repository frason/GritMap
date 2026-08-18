import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useRef, useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDatabase } from "../db/DatabaseProvider";
import { computeFileHash } from "../import/computeFileHash";
import type { DuplicateRule } from "../import/findDuplicate";
import { importFitFile, type ImportFitFileInput } from "../import/importFitFile";
import { deleteRetainedFile, retainFitFile } from "../import/retainFitFile";
import { colors } from "../theme/colors";
import { Icon } from "../theme/Icon";
import { radius, spacing } from "../theme/spacing";
import { DuplicateDecisionModal } from "./DuplicateDecisionModal";
import { ImportFileRow, type ImportRowStatus } from "./ImportFileRow";

interface FileRowState {
  id: string;
  filename: string;
  status: ImportRowStatus;
}

interface PendingDuplicate {
  rowId: string;
  filename: string;
  matchedRule: DuplicateRule;
}

const generateId = () => Crypto.randomUUID();

export function ImportScreen() {
  const database = useDatabase();
  const [rows, setRows] = useState<FileRowState[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [pendingDuplicate, setPendingDuplicate] = useState<PendingDuplicate | null>(null);
  const decisionResolverRef = useRef<((choice: "keep" | "replace") => void) | null>(null);

  function updateRow(id: string, patch: Partial<FileRowState>) {
    setRows((previous) => previous.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function awaitDuplicateDecision(
    rowId: string,
    filename: string,
    matchedRule: DuplicateRule,
  ): Promise<"keep" | "replace"> {
    return new Promise((resolve) => {
      decisionResolverRef.current = resolve;
      setPendingDuplicate({ rowId, filename, matchedRule });
    });
  }

  function resolveDuplicate(choice: "keep" | "replace") {
    setPendingDuplicate(null);
    decisionResolverRef.current?.(choice);
    decisionResolverRef.current = null;
  }

  async function importOneFile(rowId: string, uri: string, filename: string) {
    let retained: { uri: string; fileSizeBytes: number } | undefined;
    try {
      const bytes = await new File(uri).bytes();
      const contentHash = await computeFileHash(bytes);
      retained = retainFitFile(uri, generateId);

      const input: ImportFitFileInput = {
        bytes,
        filename,
        contentHash,
        retainedFileUri: retained.uri,
        fileSizeBytes: retained.fileSizeBytes,
        nowMs: Date.now(),
      };

      const result = importFitFile(database, generateId, input);

      if (result.status === "imported") {
        updateRow(rowId, { status: "imported" });
        return;
      }
      if (result.status === "failed") {
        console.warn(`Import failed for ${filename}: ${result.error}`);
        deleteRetainedFile(retained.uri);
        updateRow(rowId, { status: "failed" });
        return;
      }
      if (result.status !== "duplicate") {
        // Unreachable in practice: importFitFile only returns duplicate-kept/replaced when a
        // resolution was passed, and this is the first, resolution-less call -- handled
        // defensively rather than assumed away.
        deleteRetainedFile(retained.uri);
        updateRow(rowId, { status: "failed" });
        return;
      }

      // result.status === "duplicate" -- ask the user before writing anything.
      const choice = await awaitDuplicateDecision(rowId, filename, result.matchedRule);
      if (choice === "keep") {
        deleteRetainedFile(retained.uri); // "Keep Existing" must not retain a second copy.
        updateRow(rowId, { status: "duplicate" });
        return;
      }

      const replaceResult = importFitFile(database, generateId, input, "replace");
      if (replaceResult.status === "replaced") {
        if (replaceResult.previousRetainedFileUri) {
          deleteRetainedFile(replaceResult.previousRetainedFileUri);
        }
        updateRow(rowId, { status: "replaced" });
      } else {
        deleteRetainedFile(retained.uri);
        updateRow(rowId, { status: "failed" });
      }
    } catch (error) {
      console.warn(`Import failed for ${filename}`, error);
      if (retained) deleteRetainedFile(retained.uri);
      updateRow(rowId, { status: "failed" });
    }
  }

  async function handleImportPress() {
    const picked = await DocumentPicker.getDocumentAsync({ multiple: true, type: "*/*" });
    if (picked.canceled) return;

    const newRows: FileRowState[] = picked.assets.map((asset) => ({
      id: generateId(),
      filename: asset.name,
      status: "pending",
    }));
    setRows((previous) => [...previous, ...newRows]);
    setIsImporting(true);

    for (let i = 0; i < picked.assets.length; i += 1) {
      const asset = picked.assets[i];
      const row = newRows[i];
      if (!asset || !row) continue;
      await importOneFile(row.id, asset.uri, asset.name);
      // Yield between files so the row list can repaint as status updates arrive.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    setIsImporting(false);
  }

  const totals = rows.reduce(
    (acc, row) => {
      if (row.status !== "pending") acc[row.status] += 1;
      return acc;
    },
    { imported: 0, replaced: 0, duplicate: 0, failed: 0 },
  );

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {rows.length === 0 ? (
        <View style={styles.emptyState}>
          <Icon name="file" color="textTertiary" size={40} />
          <Text style={styles.emptyTitle}>Select FIT files to import</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleImportPress}
            disabled={isImporting}
          >
            <Text style={styles.primaryButtonLabel}>
              {isImporting ? "Importing…" : "Choose Files"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={rows}
            keyExtractor={(row) => row.id}
            renderItem={({ item }) => (
              <ImportFileRow filename={item.filename} status={item.status} />
            )}
          />
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Imported: {totals.imported} · Replaced: {totals.replaced} · Duplicate:{" "}
              {totals.duplicate} · Failed: {totals.failed}
            </Text>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleImportPress}
              disabled={isImporting}
            >
              <Text style={styles.secondaryButtonLabel}>
                {isImporting ? "Importing…" : "Add More Files"}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {pendingDuplicate && (
        <DuplicateDecisionModal
          visible
          filename={pendingDuplicate.filename}
          matchedRule={pendingDuplicate.matchedRule}
          onKeepExisting={() => resolveDuplicate("keep")}
          onReplaceExisting={() => resolveDuplicate("replace")}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.space16,
    paddingHorizontal: spacing.space24,
  },
  emptyTitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "center",
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.space20,
    paddingTop: spacing.space16,
    paddingBottom: spacing.space16,
    alignItems: "center",
    gap: spacing.space12,
  },
  footerText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
  },
  primaryButton: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: spacing.space12,
    paddingHorizontal: spacing.space24,
  },
  primaryButtonLabel: {
    color: colors.textOnBrand,
    fontSize: 15,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: colors.brandSubtle,
    borderRadius: radius.md,
    paddingVertical: spacing.space12,
    paddingHorizontal: spacing.space24,
    alignSelf: "stretch",
    alignItems: "center",
  },
  secondaryButtonLabel: {
    color: colors.brand,
    fontSize: 15,
    fontWeight: "600",
  },
});
