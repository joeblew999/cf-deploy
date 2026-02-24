/**
 * Run Playwright tests against a deployed URL.
 * Auto-detects the target URL from versions.json or production config.
 */
import { execSync } from "child_process";
import { readFileSync } from "fs";
import type { CfDeployConfig } from "./config.ts";
import type { VersionsJson } from "./types.ts";

export function runTests(config: CfDeployConfig, urlArg?: string) {
  // Determine target URL: arg → latest alias from versions.json → production
  let url = urlArg;

  if (!url) {
    try {
      const data: VersionsJson = JSON.parse(
        readFileSync(config.output.versions_json, "utf8"),
      );
      const latest = data.versions[0];
      if (latest) url = latest.url;
    } catch {
      /* ignore */
    }
  }

  if (!url) url = config.urls.production;

  if (!url) {
    console.error(
      "ERROR: No URL to test. Pass a URL or set urls.production in cf-deploy.yml",
    );
    process.exit(1);
  }

  console.log(`Running Playwright tests against: ${url}\n`);
  execSync(`bun x playwright test`, {
    cwd: config.worker.dir,
    stdio: "inherit",
    env: { ...process.env, TARGET_URL: url },
  });
}
