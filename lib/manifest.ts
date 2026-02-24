/**
 * Shared helpers for reading versions.json and resolving target URLs.
 */
import { readFileSync } from "fs";
import type { CfDeployConfig } from "./config.ts";
import type { VersionsJson } from "./types.ts";

/** Load and parse versions.json. Throws on missing/invalid file. */
export function loadVersionsJson(config: CfDeployConfig): VersionsJson {
  return JSON.parse(readFileSync(config.output.versions_json, "utf8"));
}

/** Check health of a URL (returns version string or null). */
export async function checkHealth(
  url: string,
  timeoutMs = 5000,
): Promise<string | null> {
  try {
    const res = await fetch(`${url}/api/health`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { version?: string };
    return body.version || null;
  } catch {
    return null;
  }
}

/**
 * Resolve a target URL from: explicit arg → latest in versions.json → production config.
 * Returns null if no URL can be determined.
 */
export function resolveTargetUrl(
  config: CfDeployConfig,
  urlArg?: string,
): { url: string; expectedVersion?: string } | null {
  if (urlArg) return { url: urlArg };

  try {
    const data = loadVersionsJson(config);
    const latest = data.versions[0];
    if (latest?.url) {
      return { url: latest.url, expectedVersion: latest.version };
    }
  } catch {
    /* no versions.json */
  }

  if (config.urls.production) {
    return { url: config.urls.production };
  }

  return null;
}
