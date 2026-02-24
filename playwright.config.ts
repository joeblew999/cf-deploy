import { defineConfig } from "@playwright/test";

/**
 * E2E tests for a deployed cf-deploy worker.
 *
 * TARGET_URL controls which deployment to test:
 *   - Local:      TARGET_URL=http://localhost:8788
 *   - Production: TARGET_URL=https://cf-deploy-example.gedw99.workers.dev
 *   - Any alias:  TARGET_URL=https://v1-0-0-cf-deploy-example.gedw99.workers.dev
 *
 * Default: production URL.
 */
const targetUrl =
  process.env.TARGET_URL || "https://cf-deploy-example.gedw99.workers.dev";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 15_000,
  use: {
    baseURL: targetUrl,
  },
});
