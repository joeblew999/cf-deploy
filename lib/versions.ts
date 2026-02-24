/**
 * Generate versions.json manifest from wrangler + git metadata.
 * Port of scripts/versions-json.ts — now reads config from CfDeployConfig.
 */
import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import type { CfDeployConfig } from "./config.ts";
import { getAppVersion, getCommandCount } from "./version-source.ts";
import type { GitInfo, Preview, Release, VersionsJson } from "./types.ts";

/** Build a Workers preview/alias URL */
function workerUrl(config: CfDeployConfig, prefix: string): string {
  return `https://${prefix}-${config.worker.name}.${config.worker.domain}`;
}

/** Check health of a URL */
async function checkHealth(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Print latest version as JSON (--latest mode) */
export function printLatest(config: CfDeployConfig) {
  const data: VersionsJson = JSON.parse(readFileSync(config.output.versions_json, "utf8"));
  const latest = data.versions[0];
  if (!latest) {
    console.error("No versions found in versions.json");
    process.exit(1);
  }
  console.log(JSON.stringify(latest));
}

/** Print latest version as shell-eval-able vars (--latest-env mode) */
export function printLatestEnv(config: CfDeployConfig) {
  const data: VersionsJson = JSON.parse(readFileSync(config.output.versions_json, "utf8"));
  const latest = data.versions[0];
  if (!latest) {
    console.error("No versions found in versions.json");
    process.exit(1);
  }
  console.log(`VERSION_ID="${latest.versionId}"`);
  console.log(`VERSION="${latest.version}"`);
  console.log(`COMMIT_SHA="${latest.git?.commitSha || "?"}"`);
  console.log(`COMMIT_MSG="${(latest.git?.commitMessage || "").replace(/"/g, '\\"')}"`);
  console.log(`COMMAND_COUNT="${latest.commandCount || 0}"`);
  console.log(`PREVIEW_URL="${latest.previewUrl || latest.url}"`);
  console.log(`ALIAS_URL="${latest.url}"`);
}

/** Generate versions.json */
export async function generateVersionsJson(config: CfDeployConfig, opts?: { healthCheck?: boolean }) {
  const rootDir = config.rootDir;
  const healthCheck = opts?.healthCheck || process.env.HEALTH_CHECK === "1";

  // Git metadata (resilient — falls back to empty if git unavailable)
  function git(cmd: string): string {
    try {
      return execSync(cmd, { cwd: rootDir, encoding: "utf8" }).trim();
    } catch {
      return "";
    }
  }
  const commitSha = git("git rev-parse --short HEAD");
  const commitFull = git("git rev-parse HEAD");
  const commitMessage = git("git log -1 --format=%s");
  const branch = git("git branch --show-current");

  const gitInfo: GitInfo = {
    commitSha,
    commitFull,
    commitMessage,
    branch,
    commitUrl: config.github.repo && commitFull
      ? `https://github.com/${config.github.repo}/commit/${commitFull}`
      : "",
  };

  // App version + command count
  const appVersion = getAppVersion(config);
  const commandCount = getCommandCount(config);

  // Parse wrangler versions list
  interface WranglerVersion {
    versionId: string;
    created: string;
    tag: string;
  }

  const raw = execSync("bun x wrangler versions list 2>&1", {
    cwd: config.worker.dir,
    encoding: "utf8",
  });
  const wranglerVersions: WranglerVersion[] = [];
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
        wranglerVersions.push(cur as WranglerVersion);
      }
      cur = {};
    }
  }

  // Load existing versions.json to preserve git metadata from previous runs
  const existingGit: Map<string, { git?: GitInfo; commandCount?: number }> = new Map();
  try {
    const prev: VersionsJson = JSON.parse(readFileSync(config.output.versions_json, "utf8"));
    for (const r of prev.versions) {
      if (r.git) existingGit.set(r.version, { git: r.git, commandCount: r.commandCount });
    }
  } catch { /* no existing file — that's fine */ }

  // Build releases + previews
  const releases: Release[] = [];
  const previews: Preview[] = [];

  for (const v of wranglerVersions) {
    if (v.tag.startsWith("pr-")) {
      previews.push({
        label: `PR #${v.tag.replace("pr-", "")}`,
        tag: v.tag,
        date: v.created,
        versionId: v.versionId,
        url: workerUrl(config, v.tag),
      });
    } else if (/^v\d/.test(v.tag)) {
      const ver = v.tag.replace("v", "");
      const slug = ver.replaceAll(".", "-");
      const entry: Release = {
        version: ver,
        tag: v.tag,
        date: v.created,
        versionId: v.versionId,
        url: workerUrl(config, `v${slug}`),
        previewUrl: workerUrl(config, v.versionId),
      };
      if (ver === appVersion) {
        // Current version gets fresh git info
        entry.git = gitInfo;
        entry.commandCount = commandCount;
      } else if (existingGit.has(ver)) {
        // Older versions preserve git info from previous runs
        const prev = existingGit.get(ver)!;
        entry.git = prev.git;
        entry.commandCount = prev.commandCount;
      }
      releases.push(entry);
    }
  }

  // Dedupe by version (keep latest), sort descending
  const deduped = [...new Map(releases.map((r) => [r.version, r])).values()];
  deduped.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));

  // Ensure current version is present
  if (!deduped.find((v) => v.version === appVersion)) {
    const slug = appVersion.replaceAll(".", "-");
    deduped.unshift({
      version: appVersion,
      tag: `v${appVersion}`,
      date: new Date().toISOString(),
      versionId: "",
      url: workerUrl(config, `v${slug}`),
      previewUrl: "",
      git: gitInfo,
      commandCount,
    });
  }

  // Optional: health-check preview URLs
  if (healthCheck) {
    console.log("Health-checking preview URLs...");
    await Promise.all([
      ...deduped.map(async (r) => {
        if (r.previewUrl) r.healthy = await checkHealth(r.previewUrl);
      }),
      ...previews.map(async (p) => {
        p.healthy = await checkHealth(p.url);
      }),
    ]);
    const healthyCount = deduped.filter((r) => r.healthy).length + previews.filter((p) => p.healthy).length;
    console.log(`  ${healthyCount}/${deduped.length + previews.length} URLs healthy`);
  }

  const out: VersionsJson = {
    production: config.urls.production,
    github: config.github.repo ? `https://github.com/${config.github.repo}` : "",
    generated: new Date().toISOString(),
    versions: deduped,
    previews,
  };

  // Ensure output directory exists
  const outDir = dirname(config.output.versions_json);
  if (!existsSync(outDir)) {
    const { mkdirSync } = await import("fs");
    mkdirSync(outDir, { recursive: true });
  }

  writeFileSync(config.output.versions_json, JSON.stringify(out, null, 2) + "\n");
  console.log(
    `versions.json: ${deduped.length} versions, ${previews.length} PR previews · ${commitSha} · ${branch}`
  );
}
