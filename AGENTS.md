# Agent Instructions (cf-deploy)

Source of truth for AI agents working on this repository.

## What This Is

A CLI that wraps `wrangler` with versioning conventions. Adds: tagged uploads with preview URLs, version manifest, smoke tests, rollback, and a version-picker web component.

## How It Works

```
cf-deploy versions-json   → wrangler versions list → writes versions.json
cf-deploy upload           → wrangler versions upload --tag --var APP_VERSION:X
cf-deploy smoke <url>      → fetch /api/health + /
cf-deploy promote          → wrangler versions list → deploy <id>@100%
cf-deploy rollback         → wrangler versions list → deploy <prev-id>@100%
```

No config file. Reads `wrangler.toml` for worker name and assets dir. Version comes from `package.json`. APP_VERSION is injected as a binding via `--var` at upload time.

versions-json runs BEFORE upload (not after). The manifest contains all previous versions. Current version comes from /api/health. No double-upload cycle.

## Codebase

```
bin/cf-deploy.ts    CLI entry — arg parsing, dispatches to lib/
lib/
  config.ts         Reads wrangler.toml + env/flag overrides → CfDeployConfig
  wrangler.ts       Wrangler exec helper, URL builders, version list parser
  deploy.ts         upload(), promote(), rollback()
  versions.ts       generateVersionsJson() — queries wrangler, writes manifest
  smoke.ts          smoke() — health + index check
  init.ts           Scaffold wrangler.toml + src + public
web/
  version-picker.js Source of the web component (copied to assets on upload)
```

7 source files. ~500 lines total.

## Rules

- **Dogfood (MANDATORY)**: After every push, check CI (`gh run list`) and fix failures before moving on. Tests must use cf-deploy's own code to generate artifacts (e.g. `syncWebAssets`), never assume gitignored files pre-exist. Tests must be idempotent — safe to run from a fresh clone or repeated locally. If CI breaks, you broke it — fix it.
- No config file — everything comes from wrangler.toml, env vars, or CLI flags
- Templates inlined via Bun text imports (`with { type: "text" }`) in deploy.ts and init.ts
- Always use `wrangler()` helper — ensures consistent `--name` and cwd
- All preview alias slugs must be `.toLowerCase()` (Cloudflare API requirement)
- Version-picker component must stay zero-dependency vanilla JS
- Health endpoint reads `env.APP_VERSION` (injected by `--var`), never hardcoded

## Testing

```
tests/
  unit/               bun test (bunfig.toml scopes here)
    wrangler.test.ts  URL builders, parseWranglerOutput
    config.test.ts    loadConfig, readVersion with real temp files
    integration.test.ts  builds bundle, runs init, validates example/
  e2e/                bun x playwright test (needs TARGET_URL)
    deploy.spec.ts    /api/health, /versions.json, version-picker
```

- `bun test` — unit + integration (no network, no auth)
- `bun run test:e2e` — E2E against a live deployment

## Development

1. Edit `lib/`, `bin/`, or `web/`
2. `bun test` — unit + integration (no auth needed)
3. `bun run check` — typecheck + tests

## Full Deploy Cycle (local or CI)

Same commands work everywhere. Set `CLOUDFLARE_API_TOKEN` and `PROD_URL`, then:

```sh
bun run ci:full    # check → build → deploy → e2e (everything)
bun run ci:deploy  # versions-json → upload → smoke → promote
bun run ci:e2e     # playwright against PROD_URL
```

## CI

- `ci.yml` — test (push + PR), deploy (main), PR preview + E2E. Calls `ci:deploy` / `ci:e2e` scripts.
- `release.yml` — cross-compile binaries on tags
