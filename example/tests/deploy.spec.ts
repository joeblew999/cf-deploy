import { test, expect } from "@playwright/test";

/**
 * cf-deploy example — Playwright tests.
 *
 * Run against any deployment:
 *   TARGET_URL=http://localhost:8788 bun x playwright test
 *   TARGET_URL=https://v1-0-0-cf-deploy-example.gedw99.workers.dev bun x playwright test
 *   bun x playwright test   # defaults to production
 */

test("/api/health returns ok + version", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.status).toBe("ok");
  expect(body.version).toBeTruthy();
});

test("/versions.json is valid manifest", async ({ request }) => {
  const res = await request.get("/versions.json");
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  expect(data._provenance).toContain("cf-deploy");
  expect(data.production).toBeTruthy();
  expect(data.generated).toBeTruthy();
  expect(Array.isArray(data.versions)).toBeTruthy();
  expect(data.versions.length).toBeGreaterThan(0);

  // Each version has required fields
  const v = data.versions[0];
  expect(v.version).toBeTruthy();
  expect(v.tag).toBeTruthy();
  expect(v.versionId).toBeTruthy();
  expect(v.url).toBeTruthy();
});

test("index page loads with version picker", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("cf-deploy");
  // Version picker renders
  await expect(page.locator("cf-version-picker")).toBeAttached();
});

test("health version matches versions.json latest", async ({ request }) => {
  const [health, manifest] = await Promise.all([
    request.get("/api/health").then((r) => r.json()),
    request.get("/versions.json").then((r) => r.json()),
  ]);
  const latest = manifest.versions[0];
  expect(health.version).toBe(latest.version);
});
