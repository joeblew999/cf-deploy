/**
 * Smoke test a deployed URL — health + index + optional project-specific checks.
 */
import { execSync } from "child_process";
import { readFileSync } from "fs";
import type { CfDeployConfig } from "./config.ts";
import type { VersionsJson } from "./types.ts";

async function checkHealth(url: string): Promise<string> {
  try {
    const res = await fetch(`${url}/api/health`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { version?: string };
    const version = body.version || "?";
    console.log(`  health:    OK (v${version})`);
    return version;
  } catch (e: any) {
    console.error(`  FAIL: /api/health unreachable (${e.message || e})`);
    process.exit(1);
  }
}

async function checkIndex(url: string) {
  try {
    const res = await fetch(`${url}/`, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.text();
    console.log(`  index:     OK (HTTP ${res.status}, ${body.length} bytes)`);
  } catch (e: any) {
    console.error(`  FAIL: index page unreachable (${e.message || e})`);
    process.exit(1);
  }
}

function runExtraChecks(config: CfDeployConfig, url: string) {
  if (!config.smoke.extra) return;
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

export async function smoke(config: CfDeployConfig, urlArg?: string) {
  let url = urlArg;
  let expectedVersion: string | undefined;

  if (!url) {
    try {
      const data: VersionsJson = JSON.parse(
        readFileSync(config.output.versions_json, "utf8"),
      );
      const latest = data.versions[0];
      if (latest) {
        url = latest.url;
        expectedVersion = latest.version;
      }
    } catch {
      /* ignore */
    }
  }

  url = url || config.urls.production;
  if (!url) {
    console.error(
      "ERROR: No URL to smoke test. Pass a URL or set urls.production in cf-deploy.yml",
    );
    process.exit(1);
  }

  console.log(`Smoke testing: ${url}\n`);

  const healthVersion = await checkHealth(url);
  await checkIndex(url);
  runExtraChecks(config, url);

  console.log("");
  if (expectedVersion && healthVersion === expectedVersion) {
    console.log(`PASS: All checks passed (v${expectedVersion})`);
  } else if (expectedVersion) {
    console.log(
      `WARN: Version mismatch — expected v${expectedVersion}, got v${healthVersion}`,
    );
  } else {
    console.log(`PASS: All checks passed (v${healthVersion})`);
  }
}
