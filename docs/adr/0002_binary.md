# ADR 0002: Binary Distribution

**Status**: Accepted
**Date**: 2026-02-24

## Problem

The current distribution method (cloning into `.src/cf-deploy/`) requires consumers to manage the tool's source code within their own repository. While this avoids registry dependencies, it has several drawbacks:

- Consumers must have Bun installed to execute the `.ts` source.
- Tool updates require `git pull` within the vendored directory.
- The consumer's repository is cluttered with the tool's internal logic and dependencies.

## Decision

Distribute `cf-deploy` in two formats:
1.  **Tiny JS Bundle (~40KB)**: The primary format for developers who already have Bun installed. Fast, lean, and easily run via `bun x`.
2.  **Standalone Compiled Binary (~58MB)**: For "Zero-Bun" environments (like minimal CI containers). Leverages Bun's native compilation (`bun build --compile`) to package the entire CLI and runtime into a single executable.

## Implementation Strategy

### 1. Embedded Templates
To ensure both formats are truly standalone, any scaffolded code or templates are embedded using Bun's "Text Imports". This ensures the tool carries its own assets regardless of its location on disk.

```typescript
import versionPickerSource from "../web/version-picker.js" with { type: "text" };
// ...
writeFileSync(join(cwd, "public", "version-picker.js"), versionPickerSource);
```

### 2. Compilation & Bundling
- **JS Bundle**: `bun build ./bin/cf-deploy.ts --outfile dist/cf-deploy.js --target bun --bundle`
- **Binary**: `bun build --compile --minify --sourcemap ./bin/cf-deploy.ts --outfile cf-deploy`

### 3. Distribution
Both formats will be attached as assets to GitHub Releases.

## Consequences

- **Developer Efficiency**: Bun users get a near-instant, tiny tool.
- **Zero Installation**: Non-Bun users can download a single file and run it immediately.
- **Improved Performance**: Pre-compiled bytecode or bundled JS starts faster than parsing multiple TypeScript files.
- **Cross-Platform**: Standing binaries require a build pipeline for multiple targets (e.g., `x64-linux`, `arm64-darwin`).

## Alternatives Considered

| Alternative | Why not |
|-------------|---------|
| **NPM Registry** | While standard, `bun x` from a GitHub-hosted bundle is often faster and avoids registry overhead. |
| **Source Only** | Requires Bun + manages source complexity for the consumer. |

## Consumer Usage

### For Bun Users (Preferred)
```bash
bun x cf-deploy init ...
```

### For Non-Bun Users
```bash
curl -sSL https://raw.githubusercontent.com/joeblew999/cf-deploy/main/install.sh | bash
./cf-deploy init ...
```
