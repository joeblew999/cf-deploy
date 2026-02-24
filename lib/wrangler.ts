/**
 * Wrangler pass-through and enhanced commands.
 */
import { execSync } from "child_process";
import { readFileSync } from "fs";
import type { CfDeployConfig } from "./config.ts";
import type { VersionsJson } from "./types.ts";

export function rollback(config: CfDeployConfig) {
  // Smart rollback: promote the previous version from versions.json
  let data: VersionsJson;
  try {
    data = JSON.parse(readFileSync(config.output.versions_json, "utf8"));
  } catch {
    // Fallback to interactive wrangler rollback if no versions.json
    console.log("No versions.json — falling back to interactive wrangler rollback");
    execSync("bun x wrangler rollback", { cwd: config.worker.dir, stdio: "inherit" });
    return;
  }

  if (data.versions.length < 2) {
    console.error("ERROR: Only one version deployed — nothing to roll back to");
    process.exit(1);
  }

  const current = data.versions[0];
  const previous = data.versions[1];

  if (!previous.versionId) {
    console.error("ERROR: Previous version has no versionId");
    process.exit(1);
  }

  const curSha = current.git?.commitSha || "?";
  const prevSha = previous.git?.commitSha || "?";
  console.log(`Rolling back: ${current.tag} (${curSha}) → ${previous.tag} (${prevSha})`);
  console.log(`  Review: ${previous.git?.commitUrl || "no commit link"}\n`);
  execSync(`bun x wrangler versions deploy "${previous.versionId}@100%" --yes`, {
    cwd: config.worker.dir,
    stdio: "inherit",
  });
}

export function canary(config: CfDeployConfig) {
  execSync("bun x wrangler versions deploy", { cwd: config.worker.dir, stdio: "inherit" });
}

export function status(config: CfDeployConfig) {
  execSync("bun x wrangler deployments list", { cwd: config.worker.dir, stdio: "inherit" });
}

export function versionsList(config: CfDeployConfig) {
  execSync("bun x wrangler versions list", { cwd: config.worker.dir, stdio: "inherit" });
}

export function tail(config: CfDeployConfig) {
  execSync("bun x wrangler tail", { cwd: config.worker.dir, stdio: "inherit" });
}

export function whoami() {
  execSync("bun x wrangler whoami", { stdio: "inherit" });
}

export function secretList(config: CfDeployConfig) {
  execSync("bun x wrangler secret list", { cwd: config.worker.dir, stdio: "inherit" });
}

export function deleteWorker(config: CfDeployConfig) {
  console.log(`Deleting worker: ${config.worker.name}`);
  execSync(`bun x wrangler delete --name ${config.worker.name}`, { cwd: config.worker.dir, stdio: "inherit" });
}
