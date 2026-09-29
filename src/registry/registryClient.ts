import { toPortableSegmentJson, type PortableSegmentInput } from "../segments/toPortableSegmentJson.ts";
import { utf8ToBase64 } from "./base64.ts";
import type { RegistryConfig } from "./registryConfig.ts";

export interface RegistryEntry {
  fingerprint: string;
  path: string;
}

export interface ListRegistryResult {
  ok: boolean;
  entries: RegistryEntry[];
  statusCode?: number;
  message?: string;
}

export interface FetchRegistrySegmentResult {
  ok: boolean;
  segment?: unknown;
  statusCode?: number;
  message?: string;
}

export interface PublishRegistryResult {
  ok: boolean;
  /** True if this exact fingerprint was already published -- nothing was written. */
  alreadyPublished?: boolean;
  path?: string;
  htmlUrl?: string;
  statusCode?: number;
  message?: string;
}

/**
 * Lists published segment fingerprints via GitHub's Contents API. Unauthenticated and
 * read-only -- discovery never needs the user's own token, only publishing does.
 */
export async function listRegistrySegments(config: RegistryConfig): Promise<ListRegistryResult> {
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}?ref=${config.branch}`;
  try {
    const response = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
    if (!response.ok) {
      // No registry directory yet is a valid "nothing published" state, not an error.
      if (response.status === 404) return { ok: true, entries: [] };
      return { ok: false, entries: [], statusCode: response.status };
    }
    const files = (await response.json()) as { name: string; path: string }[];
    const entries = files
      .filter((file) => file.name.endsWith(".json"))
      .map((file) => ({ fingerprint: file.name.slice(0, -".json".length), path: file.path }));
    return { ok: true, entries };
  } catch (error) {
    return { ok: false, entries: [], message: messageOf(error) };
  }
}

/**
 * Fetches one published segment's portable JSON directly from raw.githubusercontent.com --
 * no auth, and not subject to the GitHub API's stricter rate limit. The caller (see
 * importRegistrySegment.ts) is responsible for validating the result with
 * fromPortableSegmentJson before trusting it.
 */
export async function fetchRegistrySegment(
  config: RegistryConfig,
  fingerprint: string,
): Promise<FetchRegistrySegmentResult> {
  const url = `https://raw.githubusercontent.com/${config.owner}/${config.repo}/${config.branch}/${config.path}/${fingerprint}.json`;
  try {
    const response = await fetch(url);
    if (!response.ok) return { ok: false, statusCode: response.status };
    return { ok: true, segment: await response.json() };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

/**
 * Publishes a segment via GitHub's Contents API. Segments are immutable and content-
 * addressed by fingerprint, so if this exact fingerprint is already published there is
 * nothing meaningful to overwrite -- checked first (unauthenticated) so a redundant publish
 * never needs the token at all.
 */
export async function publishRegistrySegment(
  config: RegistryConfig,
  token: string,
  segment: PortableSegmentInput,
): Promise<PublishRegistryResult> {
  const path = `${config.path}/${segment.fingerprint}.json`;

  const existing = await fetchRegistrySegment(config, segment.fingerprint);
  if (existing.ok) {
    return { ok: true, alreadyPublished: true, path };
  }

  const json = toPortableSegmentJson(segment);
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`;

  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `registry: publish ${segment.name} (${segment.fingerprint})`,
        content: utf8ToBase64(JSON.stringify(json, null, 2)),
        branch: config.branch,
      }),
    });
    if (!response.ok) {
      return { ok: false, statusCode: response.status, message: await safeErrorMessage(response) };
    }
    const body = (await response.json()) as { content?: { path?: string; html_url?: string } };
    return { ok: true, path: body.content?.path ?? path, htmlUrl: body.content?.html_url };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

async function safeErrorMessage(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { message?: unknown };
    return typeof body.message === "string" ? body.message : undefined;
  } catch {
    return undefined;
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
