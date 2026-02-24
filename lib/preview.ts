/**
 * Upload a PR preview version.
 */
import type { CfDeployConfig } from "./config.ts";
import { workerUrl } from "./urls.ts";
import { wrangler } from "./wrangler.ts";

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
