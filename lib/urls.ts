/**
 * Centralized URL construction for Worker preview/alias URLs.
 */
import type { CfDeployConfig } from "./config.ts";

/** Build a Workers preview/alias URL from a prefix (tag slug or versionId). */
export function workerUrl(config: CfDeployConfig, prefix: string): string {
  return `https://${prefix}-${config.worker.name}.${config.worker.domain}`;
}

/** Build the alias URL for a semver version string (e.g. "1.2.0" → "v1-2-0-..."). */
export function versionAliasUrl(
  config: CfDeployConfig,
  version: string,
): string {
  const slug = version.replaceAll(".", "-").toLowerCase();
  return workerUrl(config, `v${slug}`);
}
