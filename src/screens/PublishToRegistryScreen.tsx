import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRoute, type RouteProp } from "@react-navigation/native";
import { useDatabase } from "../db/DatabaseProvider";
import { getSegmentDetail, type SegmentDetail } from "../db/getSegmentDetail";
import { defaultRegistryConfig } from "../registry/registryConfig";
import { publishRegistrySegment } from "../registry/registryClient";
import { getRegistryToken, setRegistryToken } from "../registry/registryCredentials";
import type { SegmentsStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { radius, spacing } from "../theme/spacing";

type PublishToRegistryRoute = RouteProp<SegmentsStackParamList, "PublishToRegistry">;

/**
 * Publishes this segment's route and matching parameters to the public registry (a
 * directory in this app's own GitHub repo -- see docs/SEGMENT_REGISTRY.md). Separated from
 * the main segment screen since it's an occasional administrative action, not something
 * looked at on every visit.
 */
export function PublishToRegistryScreen() {
  const database = useDatabase();
  const route = useRoute<PublishToRegistryRoute>();
  const [segment, setSegment] = useState<SegmentDetail | undefined>(undefined);
  const [hasStoredToken, setHasStoredToken] = useState(false);
  const [tokenFieldVisible, setTokenFieldVisible] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<string | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      setSegment(getSegmentDetail(database, route.params.segmentId));
      let cancelled = false;
      getRegistryToken().then((token) => {
        if (!cancelled) setHasStoredToken(token !== undefined);
      });
      return () => {
        cancelled = true;
      };
    }, [database, route.params.segmentId]),
  );

  async function handlePublish() {
    if (segment === undefined) return;
    const token = tokenInput.trim().length > 0 ? tokenInput.trim() : await getRegistryToken();
    if (token === undefined) {
      setTokenFieldVisible(true);
      setPublishStatus("Paste a GitHub personal access token (repo scope) to publish");
      return;
    }
    if (tokenInput.trim().length > 0) {
      await setRegistryToken(token);
      setTokenInput("");
      setTokenFieldVisible(false);
      setHasStoredToken(true);
    }
    setPublishing(true);
    setPublishStatus("Publishing…");
    const result = await publishRegistrySegment(defaultRegistryConfig(), token, {
      id: segment.segmentId,
      name: segment.name,
      schemaVersion: segment.schemaVersion,
      corridorMeters: segment.corridorMeters,
      requiredCoveragePct: segment.requiredCoveragePct,
      fingerprint: segment.fingerprint,
      referencePolyline: segment.referencePolyline,
    });
    setPublishing(false);
    setPublishStatus(
      result.ok
        ? result.alreadyPublished
          ? "Already published to the registry"
          : "Published — anyone can now discover and import this segment"
        : `Publish failed${result.statusCode ? ` (HTTP ${result.statusCode})` : ""}${
            result.message ? `: ${result.message}` : ""
          }`,
    );
  }

  if (segment === undefined) {
    return <View style={styles.container} />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Publish to Registry</Text>
      <Text style={styles.body}>
        Publishes this segment's route and matching parameters (direction, corridor width,
        required coverage) to a public, shared registry so anyone running GritMap can
        discover and import it. Only the geometry is shared -- never your rides, attempts,
        goals, or any other personal data.
      </Text>
      <Text style={styles.body}>
        Segments are identified by a fingerprint computed from their geometry, so publishing
        the same segment twice is a no-op rather than a duplicate. Publishing writes directly
        to the registry's underlying GitHub repository using a personal access token you
        provide below (stored securely on this device, never sent anywhere but GitHub's own
        API) -- it needs the token's "repo" scope (or, for a fine-grained token, Contents:
        Read and write access to that repository).
      </Text>
      {hasStoredToken && !tokenFieldVisible && (
        <TouchableOpacity onPress={() => setTokenFieldVisible(true)}>
          <Text style={styles.changeTokenLink}>Use a different token</Text>
        </TouchableOpacity>
      )}
      {(tokenFieldVisible || !hasStoredToken) && (
        <>
          <TextInput
            style={styles.addressInput}
            placeholder="GitHub personal access token (repo scope)"
            placeholderTextColor={colors.textTertiary}
            value={tokenInput}
            onChangeText={setTokenInput}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          {hasStoredToken && (
            <TouchableOpacity
              onPress={() => {
                setTokenFieldVisible(false);
                setTokenInput("");
              }}
            >
              <Text style={styles.changeTokenLink}>Cancel</Text>
            </TouchableOpacity>
          )}
        </>
      )}
      <TouchableOpacity
        style={[styles.sendButton, publishing && styles.sendButtonDisabled]}
        onPress={handlePublish}
        disabled={publishing}
      >
        <Text style={styles.sendButtonLabel}>{publishing ? "Publishing…" : "Publish to registry"}</Text>
      </TouchableOpacity>
      {publishStatus !== undefined && <Text style={styles.sendStatusText}>{publishStatus}</Text>}
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
  changeTokenLink: {
    fontSize: 13,
    color: colors.brand,
    fontWeight: "600",
  },
});
