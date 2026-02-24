/**
 * Wrangler interaction layer — execution, URL construction, version parsing.
 */
import { execSync, type ExecSyncOptions } from "child_process";
import type { CfDeployConfig } from "./config.ts";
import { loadVersionsJson } from "./manifest.ts";

// --- URL construction ---

export function workerUrl(config: CfDeployConfig, prefix: string): string {
  return `https://${prefix}-${config.worker.name}.${config.worker.domain}`;
}

export function versionAliasUrl(config: CfDeployConfig, version: string): string {
  const slug = version.replaceAll(".", "-").toLowerCase();
  return workerUrl(config, `v${slug}`);
}

// --- Wrangler execution ---

export function wrangler(
  config: CfDeployConfig,
  args: string[],
  options: ExecSyncOptions = {},
) {
  const fullArgs = ["bun", "x", "wrangler", ...args, "--name", config.worker.name];
  return execSync(fullArgs.map((a) => `"${a}"`).join(" "), {
    cwd: config.worker.dir,
    stdio: "inherit",
    ...options,
  });
}

// --- Wrangler versions parser ---

export interface WranglerVersion {
  versionId: string;
  created: string;
  tag: string;
}

export function fetchWranglerVersions(config: CfDeployConfig): WranglerVersion[] {
  const raw = wrangler(config, ["versions", "list"], {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).toString();
  return parseWranglerOutput(raw);
}

export function parseWranglerOutput(raw: string): WranglerVersion[] {
  const entries: WranglerVersion[] = [];
  let cur: Partial<WranglerVersion> = {};

  for (const line of raw.split("\n")) {
    const idMatch = line.match(/^Version ID:\s+(.+)/);
    const createdMatch = line.match(/^Created:\s+(.+)/);
    const tagMatch = line.match(/^Tag:\s+(.+)/);

    if (idMatch) {
      cur = { versionId: idMatch[1].trim() };
    } else if (createdMatch && cur.versionId) {
      cur.created = createdMatch[1].trim();
    } else if (tagMatch && cur.versionId) {
      cur.tag = tagMatch[1].trim();
      if (cur.tag !== "-" && cur.created) {
        entries.push(cur as WranglerVersion);
      }
      cur = {};
    }
  }
  return entries;
}

// --- Wrangler commands ---

export function rollback(config: CfDeployConfig) {
  let data;
  try {
    data = loadVersionsJson(config);
  } catch {
    console.log("No versions.json — falling back to interactive wrangler rollback");
    wrangler(config, ["rollback"]);
    return;
  }

  if (data.versions.length < 2) {
    console.error("ERROR: Only one version deployed — nothing to roll back to");
    return process.exit(1);
  }

  const current = data.versions[0];
  const previous = data.versions[1];

  if (!previous.versionId) {
    console.error("ERROR: Previous version has no versionId");
    return process.exit(1);
  }

  const curSha = current.git?.commitSha || "?";
  const prevSha = previous.git?.commitSha || "?";
  console.log(`Rolling back: ${current.tag} (${curSha}) → ${previous.tag} (${prevSha})`);
  console.log(`  Review: ${previous.git?.commitUrl || "no commit link"}\n`);
  wrangler(config, ["versions", "deploy", `${previous.versionId}@100%`, "--yes"]);
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

export function deleteWorker(config: CfDeployConfig, force = false) {
  console.log(`Deleting worker: ${config.worker.name}`);
  if (force) {
    execSync(`yes | bun x wrangler delete --name "${config.worker.name}"`, {
      cwd: config.worker.dir,
      stdio: "inherit",
    });
  } else {
    wrangler(config, ["delete"]);
  }
}
