/**
 * Wrangler pass-through and enhanced commands.
 */
import { execSync, type ExecSyncOptions } from "child_process";
import { readFileSync } from "fs";
import type { CfDeployConfig } from "./config.ts";
import type { VersionsJson } from "./types.ts";

/** Execute a wrangler command with the correct --name and working directory */
export function wrangler(
  config: CfDeployConfig,
  args: string[],
  options: ExecSyncOptions = {},
) {
  const fullArgs = [
    "bun",
    "x",
    "wrangler",
    ...args,
    "--name",
    config.worker.name,
  ];
  return execSync(fullArgs.map((a) => `"${a}"`).join(" "), {
    cwd: config.worker.dir,
    stdio: "inherit",
    ...options,
  });
}

export function rollback(config: CfDeployConfig) {
  // Smart rollback: promote the previous version from versions.json
  let data: VersionsJson;
  try {
    data = JSON.parse(readFileSync(config.output.versions_json, "utf8"));
  } catch {
    // Fallback to interactive wrangler rollback if no versions.json
    console.log(
      "No versions.json — falling back to interactive wrangler rollback",
    );
    wrangler(config, ["rollback"]);
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
  console.log(
    `Rolling back: ${current.tag} (${curSha}) → ${previous.tag} (${prevSha})`,
  );
  console.log(`  Review: ${previous.git?.commitUrl || "no commit link"}\n`);
  const vid = previous.versionId;
  wrangler(config, ["versions", "deploy", `${vid}@100%`, "--yes"]);
}

export function canary(config: CfDeployConfig) {
  wrangler(config, ["versions", "deploy"]);
}

export function status(config: CfDeployConfig) {
  wrangler(config, ["deployments", "list"]);
}

export function versionsList(config: CfDeployConfig) {
  wrangler(config, ["versions", "list"]);
}

export function tail(config: CfDeployConfig) {
  wrangler(config, ["tail"]);
}

export function whoami() {
  execSync("bun x wrangler whoami", { stdio: "inherit" });
}

export function secretList(config: CfDeployConfig) {
  wrangler(config, ["secret", "list"]);
}

export function deleteWorker(config: CfDeployConfig, force: boolean = false) {
  console.log(`Deleting worker: ${config.worker.name}`);
  if (force) {
    // Pipe 'yes' for non-interactive deletion
    execSync(`yes | bun x wrangler delete --name "${config.worker.name}"`, {
      cwd: config.worker.dir,
      stdio: "inherit",
    });
  } else {
    wrangler(config, ["delete"]);
  }
}
