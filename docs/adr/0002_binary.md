# ADR 0002: Binary Distribution

**Status**: Accepted
**Date**: 2026-02-24

## Problem

The current distribution method (cloning into `.src/cf-deploy/`) requires consumers to manage the tool's source code within their own repository. While this avoids registry dependencies, it has several drawbacks:
- Consumers must have Bun installed to execute the `.ts` source.
- Tool updates require `git pull` within the vendored directory.
- The consumer's repository is cluttered with the tool's internal logic and dependencies.

## Decision

Distribute `cf-deploy` as a **standalone compiled binary** via GitHub Releases.

We will leverage Bun's native compilation capabilities (`bun build --compile`) to package the entire CLI, its dependencies, and any required templates into a single executable file.

## Implementation Strategy

### 1. Embedded Templates
To ensure the binary is truly standalone, any "scaffolded" code or templates are embedded using Bun's "Text Imports". For example, the version picker component:

```typescript
import versionPickerSource from "../web/version-picker.js" with { type: "text" };
// ...
writeFileSync(join(cwd, "public", "version-picker.js"), versionPickerSource);
```

### 2. Compilation
The binary will be built using the following command:
```bash
bun build --compile --minify --sourcemap ./bin/cf-deploy.ts --outfile cf-deploy
```

### 3. Distribution
Binaries for different architectures (Linux, macOS) will be attached as assets to GitHub Releases.

## Consequences

- **Zero Installation**: Users can download a single file and run it immediately.
- **Improved Performance**: Pre-compiled bytecode starts faster than parsing TypeScript source on every execution.
- **Decoupled Versioning**: Users can pin to a specific release version by downloading that specific binary, without affecting their git history.
- **Cross-Platform**: Requires a build pipeline to generate binaries for multiple targets (e.g., `x64-linux`, `arm64-darwin`).

## Alternatives Considered

| Alternative | Why not |
|-------------|---------|
| **Tarball via GitHub** | Requires `bun add <url>`, still depends on `node_modules` and local Bun runtime for execution. |
| **npm Registry** | Introduces dependency on a third-party registry and publish overhead. |
| **Current Clone Method** | Retained as an option for developers who want to modify the tool, but binary is preferred for general usage. |

## Consumer Usage

The tool is installed via a one-line shell script that detects the platform and downloads the correct binary from GitHub:

```bash
# Download and install
curl -sSL https://raw.githubusercontent.com/joeblew999/cf-deploy/main/install.sh | bash
sudo mv cf-deploy /usr/local/bin/cf-deploy

# Initialize a project
cf-deploy init --name my-worker --domain example.workers.dev
```
