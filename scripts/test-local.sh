#!/bin/bash
set -e

# Test the JS bundle is self-contained (templates inlined, CLI works).
echo "Testing local JS bundle..."

# 1. Build the bundle
bun run build-js

# 2. Verify CLI basics
bun dist/cf-deploy.js --version
bun dist/cf-deploy.js --help

# 3. Test init scaffolding in a temp directory
TEST_DIR="tmp_local_bundle_test"
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

bun ../dist/cf-deploy.js init --name "test-worker" --domain "example.com"

# 4. Verify all scaffolded files exist
for f in cf-deploy.yml wrangler.toml package.json src/index.ts public/index.html public/version-picker.js; do
  if [ ! -f "$f" ]; then
    echo "FAIL: missing $f"
    exit 1
  fi
done

# 5. Verify provenance header in generated version-picker.js
if ! head -1 public/version-picker.js | grep -q "AUTO-GENERATED"; then
  echo "FAIL: version-picker.js missing provenance header"
  exit 1
fi

# 6. Cleanup
cd ..
rm -rf "$TEST_DIR"

echo "Local bundle test PASSED"
