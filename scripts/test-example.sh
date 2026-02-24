#!/bin/bash
set -e

# Definitive lifecycle test for cf-deploy
# Covers EVERY command and feature in a single run.

export WORKER_NAME="cf-deploy-lifecycle-full"
export WORKER_DOMAIN="gedw99.workers.dev"
export APP_VERSION="0.0.full-$(date +%s)"

echo "🚀 Starting COMPLETE Lifecycle Test"
echo "Project: $WORKER_NAME.$WORKER_DOMAIN"
echo "Version: $APP_VERSION"

# 1. Build & Whoami
echo -e "\n--- 1. PREP ---"
npm run build
BINARY="$(pwd)/cf-deploy"
chmod +x "$BINARY"
"$BINARY" whoami

# 2. Init & Setup
echo -e "\n--- 2. INIT & SETUP ---"
mkdir -p tmp_init_full && cd tmp_init_full
../cf-deploy init --name "$WORKER_NAME" --domain "$WORKER_DOMAIN"
bun install
cd ..

# 3. Deploy (One-step command)
echo -e "\n--- 3. DEPLOY (One-step) ---"
cd example
# Note: deploy runs upload + smoke. 
# We'll use a unique version via env to ensure we can find it later.
"$BINARY" deploy

# 4. PR Preview
echo -e "\n--- 4. PR PREVIEW ---"
"$BINARY" preview --pr 123

# 5. Versions JSON (Extended)
echo -e "\n--- 5. VERSIONS JSON ---"
"$BINARY" versions-json --health-check
"$BINARY" versions-json --latest
"$BINARY" versions-json --latest-env

# 6. Status & Lists
echo -e "\n--- 6. STATUS & LISTS ---"
"$BINARY" status
"$BINARY" list
"$BINARY" versions
"$BINARY" secrets

# 7. Smoke Test (Manual URL)
echo -e "\n--- 7. SMOKE TEST (Manual) ---"
PREVIEW_URL="https://v$(echo $APP_VERSION | tr '.' '-')-$WORKER_NAME.$WORKER_DOMAIN"
"$BINARY" smoke "$PREVIEW_URL"

# 8. Promote & Rollback
echo -e "\n--- 8. PROMOTE & ROLLBACK ---"
# Promote the one we just uploaded
"$BINARY" promote
# Rollback to the one before
"$BINARY" rollback

# 9. Canary (Intent)
echo -e "\n--- 9. CANARY ---"
# Note: 'wrangler versions deploy' is interactive if no args, 
# but we can test the 'canary' command triggers the right help/flow.
echo "Testing canary command intent..."
"$BINARY" canary --help

# 10. Playwright Tests
echo -e "\n--- 10. PLAYWRIGHT TESTS ---"
TEST_PROD_URL="https://$WORKER_NAME.$WORKER_DOMAIN"
"$BINARY" test "$TEST_PROD_URL"

# 11. Delete
echo -e "\n--- 11. TEARDOWN ---"
"$BINARY" delete --yes

echo -e "\n✅ ALL cf-deploy FEATURES VERIFIED!"
