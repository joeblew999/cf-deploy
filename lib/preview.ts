/**
 * Upload a PR preview version.
 */
import { execSync } from "child_process";
import type { CfDeployConfig } from "./config.ts";
import { workerUrl } from "./urls.ts";

export function preview(config: CfDeployConfig, prNumber: string) {
  const tag = `pr-${prNumber}`;
  console.log(`Uploading PR preview (${tag})...`);

  const args = ["bun", "x", "wrangler", "versions", "upload",
    "--tag", tag, "--message", `PR #${prNumber}`, "--preview-alias", tag];
  execSync(args.map(a => `"${a}"`).join(" "), { cwd: config.worker.dir, stdio: "inherit" });

  console.log(`\nPreview: ${workerUrl(config, tag)}`);
}
