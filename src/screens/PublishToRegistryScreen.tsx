import { useCallback, useState } from "react";
import { View } from "react-native";
import { useFocusEffect, useRoute, type RouteProp } from "@react-navigation/native";
import { useDatabase } from "../db/DatabaseProvider";
import { getSegmentDetail, type SegmentDetail } from "../db/getSegmentDetail";
import { describePublishError } from "../registry/describeRegistryError";
import { defaultRegistryConfig } from "../registry/registryConfig";
import { publishRegistrySegment } from "../registry/registryClient";
import { getRegistryToken, setRegistryToken } from "../registry/registryCredentials";
import type { SegmentsStackParamList } from "../navigation/types";
import { AppText, Button, Card, ErrorState, LoadingState, Notice, ScreenScroll, Section, TextField } from "../theme/components";

type PublishToRegistryRoute = RouteProp<SegmentsStackParamList, "PublishToRegistry">;

/**
 * Shares this segment's name and route in Open Segments, a public folder in this app's own GitHub
 * repository (docs/SEGMENT_REGISTRY.md). For the beta, writing there needs a GitHub token that only
 * the maintainer has, so the token path sits behind "I'm the GritMap maintainer" and everyone else is
 * told plainly that sharing is not open yet (docs/OPEN_SEGMENTS_SHARING.md proposes how to open it).
 */
export function PublishToRegistryScreen() {
  const database = useDatabase();
  const route = useRoute<PublishToRegistryRoute>();
  const [loadState, setLoadState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [segment, setSegment] = useState<SegmentDetail | undefined>(undefined);
  const [hasStoredToken, setHasStoredToken] = useState(false);
  const [maintainerOpen, setMaintainerOpen] = useState(false);
  const [changingToken, setChangingToken] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | undefined>(undefined);

  const load = useCallback(() => {
    let cancelled = false;
    try {
      const detail = getSegmentDetail(database, route.params.segmentId);
      setSegment(detail);
      setLoadState(detail === undefined ? "missing" : "ready");
    } catch {
      setLoadState("error");
    }
    getRegistryToken()
      .then((token) => {
        if (cancelled) return;
        setHasStoredToken(token !== undefined);
        // Someone who has already stored a token is the maintainer: show the share controls straight away.
        if (token !== undefined) setMaintainerOpen(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [database, route.params.segmentId]);

  useFocusEffect(load);

  async function handlePublish() {
    if (segment === undefined) return;
    const typed = tokenInput.trim();
    const token = typed.length > 0 ? typed : await getRegistryToken();
    if (token === undefined) {
      setResult({ ok: false, text: "Paste the GitHub token first." });
      return;
    }
    if (typed.length > 0) {
      await setRegistryToken(token);
      setTokenInput("");
      setChangingToken(false);
      setHasStoredToken(true);
    }
    setPublishing(true);
    setResult(undefined);
    const published = await publishRegistrySegment(defaultRegistryConfig(), token, {
      id: segment.segmentId,
      name: segment.name,
      schemaVersion: segment.schemaVersion,
      corridorMeters: segment.corridorMeters,
      requiredCoveragePct: segment.requiredCoveragePct,
      fingerprint: segment.fingerprint,
      referencePolyline: segment.referencePolyline,
    });
    setPublishing(false);
    setResult(
      published.ok
        ? {
            ok: true,
            text: published.alreadyPublished
              ? "This segment is already in Open Segments."
              : "Shared. Anyone can now find this segment in Open Segments and add it.",
          }
        : { ok: false, text: describePublishError(published.statusCode === undefined ? {} : { statusCode: published.statusCode }) },
    );
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

  const showTokenField = !hasStoredToken || changingToken;

  return (
    <ScreenScroll>
      <View>
        <AppText variant="title2" accessibilityRole="header">
          Share to Open Segments
        </AppText>
        <AppText variant="subheadline" color="textSecondary">
          {segment.name}
        </AppText>
      </View>

      <Notice tone="info">
        Sharing your own segments isn't open to everyone yet. During the beta, only the GritMap maintainer can add segments
        to Open Segments. You can already add other riders' segments from Open Segments.
      </Notice>

      <Section title="What would be shared">
        <Card>
          <AppText variant="subheadline">• The segment's name and its route on the map, including how steep it is.</AppText>
          <AppText variant="subheadline">• Never your rides, your times, your goals, your plans or anything from your profile.</AppText>
          <AppText variant="subheadline" color="textSecondary">
            Sharing the same segment twice does nothing extra.
          </AppText>
        </Card>
        <Notice tone="warning">
          Open Segments is public and a shared segment can't be removed from the app. A segment cut from your own ride shows where
          you ride, so don't share one that starts or ends at your home.
        </Notice>
      </Section>

      {maintainerOpen ? (
        <Section
          title="Maintainer: share with a GitHub token"
          description="For the person who runs GritMap's Open Segments. It writes this segment straight into the public GitHub repository."
        >
          {showTokenField ? (
            <TextField
              label="GitHub token"
              value={tokenInput}
              onChangeText={setTokenInput}
              placeholder="Paste the token"
              hint="A GitHub token that is allowed to write to the Open Segments repository. It is kept in this iPhone's Keychain and sent only to GitHub."
              secureTextEntry
            />
          ) : (
            <AppText variant="subheadline" color="textSecondary">
              A token is saved on this iPhone.
            </AppText>
          )}
          {hasStoredToken && !changingToken ? (
            <Button label="Use a different token" variant="tertiary" fullWidth={false} onPress={() => setChangingToken(true)} />
          ) : null}
          {hasStoredToken && changingToken ? (
            <Button
              label="Cancel"
              variant="tertiary"
              fullWidth={false}
              onPress={() => {
                setChangingToken(false);
                setTokenInput("");
              }}
            />
          ) : null}
          <Button label="Share this segment" onPress={handlePublish} loading={publishing} />
          {result === undefined ? null : (
            <Notice tone={result.ok ? "success" : "error"} live>
              {result.text}
            </Notice>
          )}
        </Section>
      ) : (
        <Button label="I'm the GritMap maintainer" variant="tertiary" fullWidth={false} onPress={() => setMaintainerOpen(true)} accessibilityHint="Shows the controls for sharing with a GitHub token" />
      )}
    </ScreenScroll>
  );
}
