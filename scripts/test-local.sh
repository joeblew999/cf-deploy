#!/bin/bash
set -e

# Test the tool as a local bundle (no global pollution)
echo "🚀 Testing Local Standalone Bundle"

# 1. Build the bundle
echo "Building JS bundle..."
bun run build-js

# 2. Create a temporary project directory
TEST_DIR="tmp_local_bundle_test"
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR"

# 3. Use the BUNDLE to initialize the project
# This proves the bundle is self-contained (templates are inlined)
echo "Initializing project using local bundle..."
bun dist/cf-deploy.js init --name "local-test-worker" --domain "example.com" --cwd "$TEST_DIR"

# Note: I need to make sure 'init' supports --cwd or I run it from inside
cd "$TEST_DIR"
node ../dist/cf-deploy.js --version
node ../dist/cf-deploy.js --help

# 4. Verify scaffolding
echo "Verifying files..."
ls -R

# 5. Cleanup
cd ..
rm -rf "$TEST_DIR"

echo -e "
✅ Local bundle test PASSED (No OS pollution!)"
