# Agent Instructions (cf-deploy)

Source of truth for AI agents working on this repository.

## What This Is

A CLI tool that wraps `wrangler` with versioning conventions. It adds: tagged uploads with preview URLs, a versions.json manifest, smoke tests, and a version-picker web component. The user's worker code stays normal — cf-deploy only manages the deploy lifecycle.

## How It Works (data flow)

```
package.json (version: "1.2.0")
      │
      ▼
cf-deploy upload ──► wrangler versions upload --tag v1.2.0 --preview-alias v1-2-0
      │                       │
      │                       ▼
      │               Cloudflare (stores version with tag + alias URL)
      │
      ▼
cf-deploy versions-json ──► queries wrangler + git
      │                       │
      │                       ▼
      │               public/versions.json (manifest of all versions + git metadata)
      │
      ▼
cf-deploy upload (again) ──► re-uploads with versions.json now in static assets
      │
      ▼
cf-deploy promote ──► reads versions.json, calls wrangler versions deploy <id>@100%
```

The double upload→versions-json→upload→versions-json cycle exists because:
1. First upload creates the version on Cloudflare (gets a versionId)
2. versions-json queries Cloudflare for that versionId and writes the manifest
3. Second upload includes the manifest in the static assets
4. Second versions-json captures the final versionId

## Codebase Layout

```
bin/cf-deploy.ts      CLI entry point (arg parsing → calls lib functions)
lib/
  config.ts           Reads cf-deploy.yml + env var overrides → CfDeployConfig
  types.ts            Shared interfaces (Release, Preview, VersionsJson) + provenance constants
  manifest.ts         Shared helpers: loadVersionsJson, checkHealth, resolveTargetUrl
  wrangler.ts         Wrangler execution, URL construction, version parsing, passthrough commands
  versions.ts         Reads app version from package.json, generates versions.json
  deploy.ts           Upload, preview, promote, list, deploy workflow
  smoke.ts            Smoke tests (health+index) and Playwright test runner
  init.ts             Project scaffolding (creates cf-deploy.yml, wrangler.toml, src/, public/)
web/
  version-picker.js   Source of the web component (auto-copied to worker's public/ on upload)
```

### Why manifest.ts is separate

`manifest.ts` exists to break a circular dependency: `wrangler.ts` (rollback) and `versions.ts` (generate) both need `loadVersionsJson`, but `versions.ts` needs `wrangler.ts` for `fetchWranglerVersions`. Putting `loadVersionsJson` in either file would create a cycle.

### How version-picker.js flows

```
web/version-picker.js (source, checked into git)
      │
      ├─► deploy.ts:upload() calls syncWebAssets() which copies it to the worker's public/ dir
      │   with a provenance header prepended
      │
      └─► init.ts:init() copies it when scaffolding a new project
```

The copy in `example/public/version-picker.js` is gitignored — it's regenerated on every upload.

## Development

1. Edit files in `lib/`, `bin/`, or `web/`
2. `bun run build-js` — builds the bundle
3. `bun test tests/urls.test.ts` — unit tests
4. `./scripts/test-local.sh` — integration test (bundle + init scaffolding)
5. `./scripts/test-example.sh` — full lifecycle test (needs Cloudflare credentials)

## CI Workflows

- `ci.yml` — build + test on every push/PR, deploy example on push to main
- `pr-preview.yml` — upload PR preview + comment URL on PR
- `release.yml` — cross-compile binaries + create GitHub release on tags

## Rules

- All templates inlined via Bun text imports (`with { type: "text" }`) in `deploy.ts` and `init.ts`
- Always use the `wrangler()` helper in `wrangler.ts` — ensures consistent `--name` and cwd
- All preview alias slugs must be `.toLowerCase()` (Cloudflare API requirement)
- Version-picker component must stay zero-dependency vanilla JS
