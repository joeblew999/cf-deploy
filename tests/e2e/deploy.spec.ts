import { test, expect } from "@playwright/test";

/**
 * E2E tests for a deployed cf-deploy worker.
 *
 * Run against any deployment:
 *   TARGET_URL=https://cf-deploy-example.gedw99.workers.dev bun x playwright test
 *   TARGET_URL=http://localhost:8788 bun x playwright test
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
  expect(data.production).toBeTruthy();
  expect(data.generated).toBeTruthy();
  expect(Array.isArray(data.versions)).toBeTruthy();
});

test("index page loads with version picker", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("cf-deploy");
  await expect(page.locator("cf-version-picker")).toBeAttached();
});
