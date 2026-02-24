/**
 * Upload a new Worker version (does NOT deploy to production).
 * Wraps: wrangler versions upload --tag --message --preview-alias
 */
import { execSync } from "child_process";
import type { CfDeployConfig } from "./config.ts";
import { getAppVersion } from "./version-source.ts";

export function upload(config: CfDeployConfig, opts: { version?: string; tag?: string }) {
  const version = opts.version || getAppVersion(config);
  const slug = version.replaceAll(".", "-");

  let cmd = "bun x wrangler versions upload";
  if (opts.tag) {
    // Custom tag (e.g. pr-42)
    cmd += ` --tag "${opts.tag}" --message "${opts.tag}" --preview-alias "${opts.tag}"`;
  } else if (version && version !== "0.0.0") {
    cmd += ` --tag "v${version}" --message "v${version}" --preview-alias "v${slug}"`;
  }

  console.log(`Uploading${version !== "0.0.0" ? ` v${version}` : ""}...`);
  execSync(`bun install && ${cmd}`, { cwd: config.worker.dir, stdio: "inherit" });

  if (opts.tag) {
    console.log(`\nPreview: https://${opts.tag}-${config.worker.name}.${config.worker.domain}`);
  } else if (version !== "0.0.0") {
    console.log(`\nPreview: https://v${slug}-${config.worker.name}.${config.worker.domain}`);
    console.log(`To promote to production: cf-deploy promote`);
  }
}
