/**
 * Promote a version to 100% traffic.
 * By default promotes the latest from versions.json.
 * With --version X, promotes that specific tagged version.
 */
import { readFileSync } from "fs";
import type { CfDeployConfig } from "./config.ts";
import type { VersionsJson } from "./types.ts";
import { wrangler } from "./wrangler.ts";

export function promote(config: CfDeployConfig, targetVersion?: string) {
  let data: VersionsJson;
  try {
    data = JSON.parse(readFileSync(config.output.versions_json, "utf8"));
  } catch {
    console.error(`ERROR: Cannot read ${config.output.versions_json} — run 'cf-deploy versions-json' first`);
    process.exit(1);
  }

  let target;
  if (targetVersion) {
    // Find by version number or tag
    const v = targetVersion.replace(/^v/, "");
    target = data.versions.find((r) => r.version === v || r.tag === targetVersion);
    if (!target) {
      console.error(`ERROR: Version "${targetVersion}" not found in versions.json`);
      console.error(`Available: ${data.versions.map((r) => r.tag).join(", ")}`);
      process.exit(1);
    }
  } else {
    target = data.versions[0];
  }

  if (!target?.versionId) {
    console.error("ERROR: No versionId found — upload first");
    process.exit(1);
  }

  const sha = target.git?.commitSha || "?";
  console.log(`Promoting ${target.versionId} (${target.tag}, commit ${sha}) to 100%...`);
  wrangler(config, ["versions", "deploy", `${target.versionId}@100%`, "--yes"]);
}
