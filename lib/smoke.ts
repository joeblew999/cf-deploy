/**
 * Smoke test a deployed URL — health + index + optional project-specific checks.
 */
import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import type { CfDeployConfig } from "./config.ts";
import type { VersionsJson } from "./types.ts";

export function smoke(config: CfDeployConfig, urlArg?: string) {
  // Determine URL to test
  let url = urlArg;
  let expectedVersion: string | undefined;

  if (!url) {
    // Try to get latest from versions.json
    try {
      const data: VersionsJson = JSON.parse(readFileSync(config.output.versions_json, "utf8"));
      const latest = data.versions[0];
      if (latest) {
        url = latest.url; // alias URL (e.g. v0-7-0-worker.domain) — stable
        expectedVersion = latest.version;
      }
    } catch { /* ignore */ }
  }

  if (!url) {
    url = config.urls.production;
  }

  if (!url) {
    console.error("ERROR: No URL to smoke test. Pass a URL or set urls.production in cf-deploy.yml");
    process.exit(1);
  }

  console.log(`Smoke testing: ${url}\n`);

  // 1. Health check
  let healthVersion: string;
  try {
    const health = execSync(`curl -sf "${url}/api/health"`, { encoding: "utf8" });
    healthVersion = JSON.parse(health).version || "?";
    console.log(`  health:    OK (v${healthVersion})`);
  } catch {
    console.error("  FAIL: /api/health unreachable");
    process.exit(1);
  }

  // 2. Index page
  try {
    const status = execSync(`curl -sf -o /dev/null -w "%{http_code}" "${url}/"`, { encoding: "utf8" }).trim();
    const size = execSync(`curl -sf -o /dev/null -w "%{size_download}" "${url}/"`, { encoding: "utf8" }).trim();
    console.log(`  index:     OK (HTTP ${status}, ${size} bytes)`);
  } catch {
    console.error("  FAIL: index page unreachable");
    process.exit(1);
  }

  // 3. Project-specific checks
  if (config.smoke.extra) {
    try {
      execSync(config.smoke.extra, {
        stdio: "inherit",
        env: { ...process.env, SMOKE_URL: url },
      });
    } catch {
      console.error("  FAIL: extra smoke checks failed");
      process.exit(1);
    }
  }

  // 4. Version match
  console.log("");
  if (expectedVersion && healthVersion! === expectedVersion) {
    console.log(`PASS: All checks passed (v${expectedVersion})`);
  } else if (expectedVersion && healthVersion! !== expectedVersion) {
    console.log(`WARN: Version mismatch — expected v${expectedVersion}, got v${healthVersion!}`);
  } else {
    console.log(`PASS: All checks passed (v${healthVersion!})`);
  }
}
