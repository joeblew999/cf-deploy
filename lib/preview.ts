/**
 * Upload a PR preview version.
 */
import { execSync } from "child_process";
import type { CfDeployConfig } from "./config.ts";

export function preview(config: CfDeployConfig, prNumber: string) {
  const tag = `pr-${prNumber}`;
  console.log(`Uploading PR preview (${tag})...`);
  execSync(
    `bun install && bun x wrangler versions upload --tag "${tag}" --message "PR #${prNumber}" --preview-alias "${tag}"`,
    { cwd: config.worker.dir, stdio: "inherit" }
  );
  console.log(`\nPreview: https://${tag}-${config.worker.name}.${config.worker.domain}`);
}
