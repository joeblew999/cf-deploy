import { defineConfig } from "@playwright/test";

/**
 * Playwright config for cf-deploy example.
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
  testDir: "./tests",
  timeout: 15_000,
  use: {
    baseURL: targetUrl,
  },
});
