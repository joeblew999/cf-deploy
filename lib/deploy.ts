/**
 * Deploy command — the one-step developer workflow.
 * Uploads a new version, runs a smoke test, and prints the preview URL.
 * Does NOT promote to production (use `cf-deploy promote` for that).
 */
import { upload } from "./upload.ts";
import { smoke } from "./smoke.ts";
import type { CfDeployConfig } from "./config.ts";
import { getAppVersion } from "./version-source.ts";
import { versionAliasUrl, workerUrl } from "./urls.ts";

export async function deploy(config: CfDeployConfig, opts: { version?: string; tag?: string; skipSmoke?: boolean }) {
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
