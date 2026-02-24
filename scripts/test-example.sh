#!/bin/bash
set -e

# Full lifecycle test against a real Cloudflare account.
# Requires CLOUDFLARE_API_TOKEN or wrangler login.

CF_DEPLOY="bun $(pwd)/dist/cf-deploy.js"

export WORKER_NAME="cf-deploy-lifecycle-test"
export WORKER_DOMAIN="gedw99.workers.dev"

echo "Starting lifecycle test: $WORKER_NAME.$WORKER_DOMAIN"

# 1. Build
echo -e "\n--- Build ---"
bun run build-js
$CF_DEPLOY whoami

# 2. Init + Setup
echo -e "\n--- Init ---"
TEST_DIR="tmp_lifecycle_test"
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"
$CF_DEPLOY init --name "$WORKER_NAME" --domain "$WORKER_DOMAIN"
bun install
cd ..

# 3. Deploy from example
echo -e "\n--- Deploy ---"
cd example
$CF_DEPLOY deploy

# 4. PR Preview
echo -e "\n--- PR Preview ---"
$CF_DEPLOY preview --pr 999

# 5. Versions JSON
echo -e "\n--- Versions JSON ---"
$CF_DEPLOY versions-json --health-check
$CF_DEPLOY versions-json --latest
$CF_DEPLOY versions-json --latest-env

# 6. Status & Lists
echo -e "\n--- Status ---"
$CF_DEPLOY status
$CF_DEPLOY list
$CF_DEPLOY versions

# 7. Promote & Rollback
echo -e "\n--- Promote & Rollback ---"
$CF_DEPLOY promote
$CF_DEPLOY rollback

# 8. Playwright Tests
echo -e "\n--- Playwright Tests ---"
$CF_DEPLOY test

# 9. Cleanup
echo -e "\n--- Teardown ---"
$CF_DEPLOY delete --yes
cd ..
rm -rf "$TEST_DIR"

echo -e "\nLifecycle test PASSED"
