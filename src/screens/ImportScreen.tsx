import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { readAsStringAsync } from "expo-file-system/legacy";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { useRef, useState } from "react";
import { View } from "react-native";
import { useDatabase } from "../db/DatabaseProvider";
import { importSegmentJsonText } from "../db/importSegmentJsonText";
import { computeFileHash } from "../import/computeFileHash";
import type { DuplicateRule } from "../import/findDuplicate";
import { importRideFile, type ImportRideFileInput } from "../import/importRideFile";
import { deleteRetainedFile, retainRideFile } from "../import/retainFitFile";
import { readTextWithFallback } from "../import/readTextWithFallback";
import { runMatcherForRide, runMatcherForSegment } from "../matcher/runMatcher";
import type { RootTabParamList } from "../navigation/types";
import { AppText, Button, Notice, ScreenScroll, Section, type NoticeTone } from "../theme/components";
import { describeImportProgress, describeImportSummary } from "./describeImportSummary";
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

interface SegmentImportResult {
  tone: NoticeTone;
  text: string;
  /** Set when the segment is already in the library: offers a way to open it. */
  openSegmentId?: string;
}

const generateId = () => Crypto.randomUUID();

export function ImportScreen() {
  const database = useDatabase();
  const navigation = useNavigation();
  const [isImportingSegment, setIsImportingSegment] = useState(false);
  const [segmentResult, setSegmentResult] = useState<SegmentImportResult | undefined>(undefined);
  const [pickerError, setPickerError] = useState<string | undefined>(undefined);
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
      retained = retainRideFile(uri, filename, generateId);

      const input: ImportRideFileInput = {
        bytes,
        filename,
        contentHash,
        retainedFileUri: retained.uri,
        fileSizeBytes: retained.fileSizeBytes,
        nowMs: Date.now(),
      };

      const result = importRideFile(database, generateId, input);

      if (result.status === "imported") {
        runMatcherForRide(database, generateId, result.rideId, Date.now());
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
        // Unreachable in practice: importRideFile only returns duplicate-kept/replaced when a
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

      const replaceResult = importRideFile(database, generateId, input, "replace");
      if (replaceResult.status === "replaced") {
        if (replaceResult.previousRetainedFileUri) {
          deleteRetainedFile(replaceResult.previousRetainedFileUri);
        }
        runMatcherForRide(database, generateId, replaceResult.rideId, Date.now());
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

  /**
   * Adds a segment from a portable segment JSON file (for example one AirDropped from the Karoo),
   * through the same validation and fingerprint handling as a registry import, then opens it so a
   * plan can be created and sent back. Existing rides are matched against it straight away.
   */
  async function handleImportSegmentJsonPress() {
    setSegmentResult(undefined);
    let picked: DocumentPicker.DocumentPickerResult;
    try {
      picked = await DocumentPicker.getDocumentAsync({
        multiple: false,
        type: "*/*",
        copyToCacheDirectory: true,
      });
    } catch (error) {
      setSegmentResult({ tone: "error", text: `GritMap couldn't open the file picker. ${error instanceof Error ? error.message : ""}`.trim() });
      return;
    }
    if (picked.canceled) return;
    const asset = picked.assets[0];
    if (!asset) return;

    setIsImportingSegment(true);
    try {
      const text = await readTextWithFallback([
        () => new File(asset.uri).text(),
        () => readAsStringAsync(asset.uri),
        async () => {
          const response = await fetch(asset.uri);
          if (!response.ok) throw new Error(`URI fetch failed (${response.status})`);
          return response.text();
        },
      ]);
      const result = await importSegmentJsonText(database, generateId, text, Date.now());
      if (result.status === "invalid") {
        setSegmentResult({ tone: "error", text: `${asset.name} couldn't be added as a segment: ${result.error}` });
        return;
      }
      if (result.status === "imported") {
        runMatcherForSegment(database, generateId, result.segmentId, Date.now());
      }
      if (result.status === "already-imported") {
        setSegmentResult({
          tone: "info",
          text: `${asset.name} is a segment you already have.`,
          openSegmentId: result.segmentId,
        });
      } else {
        openSegment(result.segmentId);
      }
    } catch (error) {
      setSegmentResult({
        tone: "error",
        text: `${asset.name} couldn't be read. ${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setIsImportingSegment(false);
    }
  }

  // Import lives in the Rides stack, SegmentDetail in the Segments stack: go through the tab navigator.
  function openSegment(segmentId: string) {
    navigation
      .getParent<BottomTabNavigationProp<RootTabParamList>>()
      ?.navigate("SegmentsTab", { screen: "SegmentDetail", params: { segmentId } });
  }

  async function handleImportPress() {
    setPickerError(undefined);
    let picked: DocumentPicker.DocumentPickerResult;
    try {
      picked = await DocumentPicker.getDocumentAsync({ multiple: true, type: "*/*" });
    } catch (error) {
      setPickerError(`GritMap couldn't open the file picker. ${error instanceof Error ? error.message : ""}`.trim());
      return;
    }
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
  const handled = totals.imported + totals.replaced + totals.duplicate + totals.failed;
  const summary = describeImportSummary(totals);

  return (
    <ScreenScroll>
      <Section
        title="Ride files"
        description="Choose the FIT or GPX files from your bike computer or a ride app. GritMap adds them to Rides and checks them against your segments."
      >
        <Button
          label={rows.length === 0 ? "Choose ride files" : "Add more ride files"}
          icon="download"
          onPress={handleImportPress}
          loading={isImporting}
        />
        {pickerError === undefined ? null : <Notice tone="error" live>{pickerError}</Notice>}
      </Section>

      {rows.length === 0 ? null : (
        <Section title="Results">
          {isImporting ? (
            <AppText variant="subheadline" color="textSecondary" accessibilityLiveRegion="polite">
              {describeImportProgress(handled, rows.length)}
            </AppText>
          ) : (
            <Notice tone={summary.tone === "error" ? "error" : summary.tone === "warning" ? "warning" : "success"} live>
              {summary.text}
            </Notice>
          )}
          <View>
            {rows.map((row) => (
              <ImportFileRow key={row.id} filename={row.filename} status={row.status} />
            ))}
          </View>
        </Section>
      )}

      <Section
        title="Segment file"
        description="For a segment file moved from your Karoo or shared by someone else (it ends in .json). It is added to your Segments, not Rides."
      >
        <Button
          label="Import a segment file"
          icon="download"
          variant="secondary"
          onPress={handleImportSegmentJsonPress}
          loading={isImportingSegment}
        />
        {segmentResult === undefined ? null : (
          <>
            <Notice tone={segmentResult.tone} live>
              {segmentResult.text}
            </Notice>
            {segmentResult.openSegmentId === undefined ? null : (
              <Button
                label="Open that segment"
                variant="tertiary"
                fullWidth={false}
                onPress={() => openSegment(segmentResult.openSegmentId!)}
              />
            )}
          </>
        )}
      </Section>

      {pendingDuplicate && (
        <DuplicateDecisionModal
          visible
          filename={pendingDuplicate.filename}
          matchedRule={pendingDuplicate.matchedRule}
          onKeepExisting={() => resolveDuplicate("keep")}
          onReplaceExisting={() => resolveDuplicate("replace")}
        />
      )}
    </ScreenScroll>
  );
}
