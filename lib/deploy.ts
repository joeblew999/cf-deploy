/**
 * Deploy commands — upload, preview, promote, list, and the one-step deploy workflow.
 */
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import type { CfDeployConfig } from "./config.ts";
import { VERSION_PICKER_PROVENANCE } from "./types.ts";
import { getAppVersion } from "./versions.ts";
import {
  fetchWranglerVersions,
  versionAliasUrl,
  workerUrl,
  wrangler,
} from "./wrangler.ts";
import { loadVersionsJson } from "./manifest.ts";
import { smoke } from "./smoke.ts";
import versionPickerSource from "../web/version-picker.js" with { type: "text" };

// --- Upload ---

/** Sync version-picker.js (embedded in binary) to the worker's assets dir. */
function syncWebAssets(config: CfDeployConfig) {
  const dest = join(config.assets.dir, "version-picker.js");
  if (!existsSync(config.assets.dir)) {
    mkdirSync(config.assets.dir, { recursive: true });
  }
  writeFileSync(dest, VERSION_PICKER_PROVENANCE + versionPickerSource);
}

export function upload(
  config: CfDeployConfig,
  opts: { version?: string; tag?: string },
) {
  const version = opts.version || getAppVersion(config);

  // Sync web assets from toolkit before upload
  syncWebAssets(config);

  const args = ["versions", "upload"];
  if (opts.tag) {
    args.push(
      "--tag",
      opts.tag,
      "--message",
      opts.tag,
      "--preview-alias",
      opts.tag,
    );
  } else if (version && version !== "0.0.0") {
    const slug = version.replaceAll(".", "-").toLowerCase();
    args.push(
      "--tag",
      `v${version}`,
      "--message",
      `v${version}`,
      "--preview-alias",
      `v${slug}`,
    );
  }

  console.log(`Uploading${version !== "0.0.0" ? ` v${version}` : ""}...`);
  wrangler(config, args);

  if (opts.tag) {
    console.log(`\nPreview: ${workerUrl(config, opts.tag)}`);
  } else if (version !== "0.0.0") {
    console.log(`\nPreview: ${versionAliasUrl(config, version)}`);
    console.log(`To promote to production: cf-deploy promote`);
  }
}

// --- Preview (PR uploads) ---

export function preview(config: CfDeployConfig, prNumber: string) {
  const tag = `pr-${prNumber}`;
  console.log(`Uploading PR preview (${tag})...`);

  const args = [
    "versions",
    "upload",
    "--tag",
    tag,
    "--message",
    `PR #${prNumber}`,
    "--preview-alias",
    tag,
  ];
  wrangler(config, args);

  console.log(`\nPreview: ${workerUrl(config, tag)}`);
}

// --- Promote ---

export function promote(config: CfDeployConfig, targetVersion?: string) {
  let data;
  try {
    data = loadVersionsJson(config);
  } catch {
    console.error(
      `ERROR: Cannot read ${config.output.versions_json} — run 'cf-deploy versions-json' first`,
    );
    return process.exit(1);
  }

  let target;
  if (targetVersion) {
    const v = targetVersion.replace(/^v/, "");
    target = data.versions.find(
      (r) => r.version === v || r.tag === targetVersion,
    );
    if (!target) {
      console.error(
        `ERROR: Version "${targetVersion}" not found in versions.json`,
      );
      console.error(`Available: ${data.versions.map((r) => r.tag).join(", ")}`);
      return process.exit(1);
    }
  } else {
    target = data.versions[0];
  }

  if (!target?.versionId) {
    console.error("ERROR: No versionId found — upload first");
    return process.exit(1);
  }

  const sha = target.git?.commitSha || "?";
  console.log(
    `Promoting ${target.versionId} (${target.tag}, commit ${sha}) to 100%...`,
  );
  wrangler(config, [
    "versions",
    "deploy",
    `${target.versionId}@100%`,
    "--yes",
  ]);
}

// --- List ---

export function list(config: CfDeployConfig) {
  const entries = fetchWranglerVersions(config);

  // Sort by date descending
  entries.sort((a, b) => b.created.localeCompare(a.created));

  const releases = entries.filter((e) => /^v\d/.test(e.tag));
  const previews = entries.filter((e) => e.tag.startsWith("pr-"));

  if (releases.length > 0) {
    console.log("=== Release Versions ===\n");
    for (const e of releases) {
      const ver = e.tag.replace("v", "");
      console.log(`  ${e.tag}  (${e.created})`);
      console.log(`    ${versionAliasUrl(config, ver)}\n`);
    }
  }

  if (previews.length > 0) {
    console.log("=== PR Previews ===\n");
    for (const e of previews) {
      console.log(`  ${e.tag}  (${e.created})`);
      console.log(`    ${workerUrl(config, e.tag)}\n`);
    }
  }

  if (config.urls.production) {
    console.log(`Production:  ${config.urls.production}`);
  }
}

// --- Deploy (upload + smoke + summary) ---

export async function deploy(
  config: CfDeployConfig,
  opts: { version?: string; tag?: string; skipSmoke?: boolean },
) {
  const version = opts.version || getAppVersion(config);
  const tag = opts.tag;

  // 1. Upload
  upload(config, { version, tag });

  // 2. Determine preview URL
  let previewUrl: string;
  if (tag) {
    previewUrl = workerUrl(config, tag);
  } else {
    previewUrl = versionAliasUrl(config, version);
  }

  // 3. Smoke test the preview
  if (!opts.skipSmoke) {
    console.log("");
    await smoke(config, previewUrl);
  }

  // 4. Summary
  console.log(`\n--- Deploy complete ---`);
  console.log(`  Preview:    ${previewUrl}`);
  if (config.urls.production) {
    console.log(`  Production: ${config.urls.production}`);
  }
  console.log(`\n  To go live:  cf-deploy promote`);
}
