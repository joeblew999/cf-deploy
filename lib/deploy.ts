/**
 * Deploy commands — upload, promote, rollback.
 */
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import type { CfDeployConfig } from "./config.ts";
import { readVersion } from "./config.ts";
import {
  VERSION_PICKER_JS,
  fetchWranglerVersions,
  versionAliasUrl,
  workerUrl,
  wrangler,
} from "./wrangler.ts";

/** Copy version-picker.js into the worker's assets dir before upload. */
export function syncWebAssets(config: CfDeployConfig) {
  if (!existsSync(config.assetsDir)) {
    mkdirSync(config.assetsDir, { recursive: true });
  }
  writeFileSync(
    join(config.assetsDir, "version-picker.js"),
    VERSION_PICKER_JS,
  );
}

// --- Upload ---

export function upload(
  config: CfDeployConfig,
  opts: { version?: string; tag?: string; pr?: string },
) {
  const version = opts.version || readVersion(config.workerDir);
  syncWebAssets(config);

  const args = ["versions", "upload"];

  // Inject APP_VERSION binding so /api/health returns it
  if (version !== "0.0.0") {
    args.push("--var", `APP_VERSION:${version}`);
  }

  if (opts.pr) {
    // PR preview
    const tag = `pr-${opts.pr}`;
    args.push("--tag", tag, "--message", `PR #${opts.pr}`, "--preview-alias", tag);
    console.log(`Uploading PR preview (${tag})...`);
    wrangler(config, args);
    const url = workerUrl(config, tag);
    console.log(`\nPreview: ${url}`);
    return url;
  }

  if (opts.tag) {
    args.push("--tag", opts.tag, "--message", opts.tag, "--preview-alias", opts.tag);
  } else if (version !== "0.0.0") {
    const slug = version.replaceAll(".", "-").toLowerCase();
    args.push("--tag", `v${version}`, "--message", `v${version}`, "--preview-alias", `v${slug}`);
  }

  console.log(`Uploading${version !== "0.0.0" ? ` v${version}` : ""}...`);
  wrangler(config, args);

  const url = opts.tag
    ? workerUrl(config, opts.tag)
    : version !== "0.0.0"
      ? versionAliasUrl(config, version)
      : "";

  if (url) {
    console.log(`\nPreview: ${url}`);
  }
  return url;
}

// --- Promote ---

export function promote(config: CfDeployConfig, targetVersion?: string) {
  const versions = fetchWranglerVersions(config);

  let target;
  if (targetVersion) {
    const v = targetVersion.replace(/^v/, "");
    target = versions.find(
      (r) => r.tag === targetVersion || r.tag === `v${v}`,
    );
    if (!target) {
      console.error(`ERROR: Version "${targetVersion}" not found`);
      console.error(`Available: ${versions.map((r) => r.tag).join(", ")}`);
      return process.exit(1);
    }
  } else {
    // Latest tagged version
    target = versions.find((v) => /^v\d/.test(v.tag));
    if (!target) {
      console.error("ERROR: No tagged versions found — upload first");
      return process.exit(1);
    }
  }

  console.log(`Promoting ${target.tag} (${target.versionId}) to 100%...`);
  wrangler(config, ["versions", "deploy", `${target.versionId}@100%`, "--yes"]);
}

// --- Rollback ---

export function rollback(config: CfDeployConfig) {
  const versions = fetchWranglerVersions(config);
  const tagged = versions.filter((v) => /^v\d/.test(v.tag));

  if (tagged.length < 2) {
    console.error("ERROR: Only one version deployed — nothing to roll back to");
    return process.exit(1);
  }

  const current = tagged[0];
  const previous = tagged[1];
  console.log(`Rolling back: ${current.tag} → ${previous.tag}`);
  wrangler(config, ["versions", "deploy", `${previous.versionId}@100%`, "--yes"]);
}
