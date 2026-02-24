/**
 * Smoke test and Playwright test runner for deployed URLs.
 */
import { execSync } from "child_process";
import type { CfDeployConfig } from "./config.ts";
import { checkHealth, resolveTargetUrl } from "./manifest.ts";

// --- Smoke test ---

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
  const resolved = resolveTargetUrl(config, urlArg);
  if (!resolved) {
    console.error(
      "ERROR: No URL to smoke test. Pass a URL or set urls.production in cf-deploy.yml",
    );
    return process.exit(1);
  }

  const { url, expectedVersion } = resolved;
  console.log(`Smoke testing: ${url}\n`);

  const healthVersion = await checkHealth(url, 10_000);
  if (!healthVersion) {
    console.error(`  FAIL: /api/health unreachable`);
    process.exit(1);
  }
  console.log(`  health:    OK (v${healthVersion})`);

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

// --- Playwright tests ---

export function runTests(config: CfDeployConfig, urlArg?: string) {
  const resolved = resolveTargetUrl(config, urlArg);
  if (!resolved) {
    console.error(
      "ERROR: No URL to test. Pass a URL or set urls.production in cf-deploy.yml",
    );
    return process.exit(1);
  }

  console.log(`Running Playwright tests against: ${resolved.url}\n`);
  execSync(`bun x playwright test`, {
    cwd: config.worker.dir,
    stdio: "inherit",
    env: { ...process.env, TARGET_URL: resolved.url },
  });
}
