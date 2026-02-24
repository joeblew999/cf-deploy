#!/bin/bash
set -e

# Detect OS and Arch
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

if [ "$OS" == "darwin" ]; then
  PLATFORM="macos"
elif [ "$OS" == "linux" ]; then
  PLATFORM="linux"
else
  echo "Unsupported OS: $OS"
  exit 1
fi

if [ "$ARCH" == "x86_64" ]; then
  ARCH_NAME="x64"
elif [ "$ARCH" == "arm64" ] || [ "$ARCH" == "aarch64" ]; then
  ARCH_NAME="arm64"
else
  echo "Unsupported Architecture: $ARCH"
  exit 1
fi

# Fallback for linux arm64 if not built yet (ADR only mentioned x64 for linux, but let's assume we build both)
# In my release.yml I only have:
# cf-deploy-linux-x64
# cf-deploy-macos-x64
# cf-deploy-macos-arm64

if [ "$PLATFORM" == "linux" ] && [ "$ARCH_NAME" == "arm64" ]; then
  echo "Warning: linux-arm64 binary might not be available yet. Trying linux-x64 (might not work)."
  ARCH_NAME="x64"
fi

BINARY_NAME="cf-deploy-${PLATFORM}-${ARCH_NAME}"
URL="https://github.com/joeblew999/cf-deploy/releases/latest/download/${BINARY_NAME}"

echo "Downloading ${BINARY_NAME} from GitHub..."
curl -L "$URL" -o cf-deploy
chmod +x cf-deploy

echo ""
echo "cf-deploy downloaded successfully!"
echo "To install it globally, run:"
echo "  sudo mv cf-deploy /usr/local/bin/cf-deploy"
echo ""
echo "Then you can run 'cf-deploy init' in any directory."
