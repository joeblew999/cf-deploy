/**
 * Upload a new Worker version (does NOT deploy to production).
 * Wraps: wrangler versions upload --tag --message --preview-alias
 *
 * Automatically copies web/version-picker.js into the worker's assets
 * directory before uploading, so consumers always get the latest component.
 */
import { execSync } from "child_process";
import { copyFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { CfDeployConfig } from "./config.ts";
import { getAppVersion } from "./version-source.ts";
import { versionAliasUrl, workerUrl } from "./urls.ts";

/** Copy toolkit web assets (version-picker.js) into the worker's assets dir. */
function syncWebAssets(config: CfDeployConfig) {
  const src = join(config.toolkitDir, "web", "version-picker.js");
  if (!existsSync(src)) return;

  const dest = join(config.assets.dir, "version-picker.js");
  if (!existsSync(config.assets.dir)) {
    mkdirSync(config.assets.dir, { recursive: true });
  }
  copyFileSync(src, dest);
}

export function upload(config: CfDeployConfig, opts: { version?: string; tag?: string }) {
  const version = opts.version || getAppVersion(config);
  const slug = version.replaceAll(".", "-");

  // Sync web assets from toolkit before upload
  syncWebAssets(config);

  const args = ["bun", "x", "wrangler", "versions", "upload"];
  if (opts.tag) {
    args.push("--tag", opts.tag, "--message", opts.tag, "--preview-alias", opts.tag);
  } else if (version && version !== "0.0.0") {
    args.push("--tag", `v${version}`, "--message", `v${version}`, "--preview-alias", `v${slug}`);
  }

  console.log(`Uploading${version !== "0.0.0" ? ` v${version}` : ""}...`);
  execSync(args.map(a => `"${a}"`).join(" "), { cwd: config.worker.dir, stdio: "inherit" });

  if (opts.tag) {
    console.log(`\nPreview: ${workerUrl(config, opts.tag)}`);
  } else if (version !== "0.0.0") {
    console.log(`\nPreview: ${versionAliasUrl(config, version)}`);
    console.log(`To promote to production: cf-deploy promote`);
  }
}
