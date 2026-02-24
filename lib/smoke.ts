/**
 * Smoke test a deployed URL — health + index check.
 */

async function checkHealth(
  url: string,
  timeoutMs = 10_000,
): Promise<string | null> {
  try {
    const res = await fetch(`${url}/api/health`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { version?: string };
    return body.version || null;
  } catch {
    return null;
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

export async function smoke(url: string) {
  console.log(`Smoke testing: ${url}\n`);

  const version = await checkHealth(url);
  if (!version) {
    console.error(`  FAIL: /api/health unreachable`);
    process.exit(1);
  }
  console.log(`  health:    OK (v${version})`);

  await checkIndex(url);

  console.log(`\nPASS: All checks passed (v${version})`);
}
