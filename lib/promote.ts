/**
 * Promote the latest uploaded version to 100% traffic.
 * Reads versions.json to find the latest versionId.
 */
import { execSync } from "child_process";
import { readFileSync } from "fs";
import type { CfDeployConfig } from "./config.ts";
import type { VersionsJson } from "./types.ts";

export function promote(config: CfDeployConfig) {
  let data: VersionsJson;
  try {
    data = JSON.parse(readFileSync(config.output.versions_json, "utf8"));
  } catch {
    console.error(`ERROR: Cannot read ${config.output.versions_json} — run 'cf-deploy versions-json' first`);
    process.exit(1);
  }

  const latest = data.versions[0];
  if (!latest?.versionId) {
    console.error("ERROR: No versionId in versions.json — upload first");
    process.exit(1);
  }

  const sha = latest.git?.commitSha || "?";
  console.log(`Promoting ${latest.versionId} (v${latest.version}, commit ${sha}) to 100%...`);
  execSync(`bun x wrangler versions deploy "${latest.versionId}@100%" --yes`, {
    cwd: config.worker.dir,
    stdio: "inherit",
  });
}
