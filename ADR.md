# ADR: cf-deploy — Reusable Cloudflare Workers Deploy Toolkit

**Status**: Implemented
**Date**: 2026-02-24

## Problem

Deploying Cloudflare Workers with versioned releases, smoke tests, PR previews, and a version picker UI is a repeating pattern across projects. The logic was originally embedded in go-task infrastructure, which forces every consumer to use go-task.

## Decision

A standalone **Bun CLI toolkit** that wraps wrangler with versioning conventions. Any task runner can call it — task, make, just, npm scripts, shell, or nothing.

## Three Layers

| Layer | When | Where | What |
|-------|------|-------|------|
| **Dev-time CLI** | Developer runs commands | Local / CI | `cf-deploy upload`, `promote`, `rollback`, `smoke` |
| **Build-time codegen** | Deploy pipeline | Local / CI | `cf-deploy versions-json` — manifest from wrangler + git |
| **Runtime component** | Page load | Browser | `<cf-version-picker>` — vanilla Web Component, zero deps |

## Key Design Decisions

1. **Bun, not Node** — runs TypeScript natively, fast startup, already in stack
2. **Config file** — `cf-deploy.yml` is self-documenting, checked into git. Env vars as overrides.
3. **Clone, not npm install** — `.src/cf-deploy/` vendor pattern, no publish step needed
4. **Vanilla Web Component** — zero dependencies, light DOM, works with any CSS framework
5. **CLI, not library** — `cf-deploy upload` is the interface. Internals can change freely.
6. **Static manifest** — `versions.json` generated at dev time, embedded as static asset. Zero runtime Cloudflare API calls.
7. **Git metadata preserved** — each version stores commit hash, message, branch, GitHub URL. Preserved across regenerations.
8. **Promote by tag** — `cf-deploy promote --version v1.2.0` promotes a specific version. Rollback promotes previous from manifest.

## Structure

```
cf-deploy/
  bin/cf-deploy.ts        CLI entry point (16 commands)
  lib/
    config.ts             Reads cf-deploy.yml (CWD-first search)
    upload.ts             wrangler versions upload + tagging
    promote.ts            Promote by tag or latest from versions.json
    smoke.ts              Health + index + custom checks
    versions.ts           Generate versions.json with git metadata
    test.ts               Run Playwright tests against any URL
    preview.ts            PR preview upload
    init.ts               Scaffold new projects
    wrangler.ts           Rollback, canary, status, delete, etc.
    types.ts              TypeScript types
    version-source.ts     Read version from package.json or schema
    list.ts               Display all versions with URLs
  web/
    version-picker.js     Vanilla Web Component (~250 lines)
  example/                Complete deployed Hono worker
  .github/workflows/      CI: deploy.yml + pr-preview.yml
```

## CLI Commands

```
cf-deploy init --name N --domain D    Scaffold new project
cf-deploy upload [--version X]        Tagged upload (auto-reads package.json)
cf-deploy promote [--version X]       Promote specific or latest to 100%
cf-deploy rollback                    Smart rollback using versions.json
cf-deploy smoke [URL]                 Health + index checks
cf-deploy test [URL]                  Playwright tests (auto-detects URL)
cf-deploy versions-json               Generate manifest from wrangler + git
cf-deploy preview --pr N              PR preview upload
cf-deploy list                        Show all versions with URLs
cf-deploy status                      Current deployment info
cf-deploy delete                      Full worker teardown
cf-deploy whoami                      Cloudflare auth info
```

## Version Picker Features

- Health status dots (green/red/neutral) per version
- Git commit hash as clickable link to GitHub
- Truncated commit message per version
- Branch badge
- PR previews with GitHub PR link
- Local dev link with port
- Production + GitHub repo links
- "Updated X ago" timestamp
- Light DOM — inherits page CSS (DaisyUI, Tailwind, etc.)

## Alternatives Considered

| Alternative | Why not |
|-------------|---------|
| go-task remote includes | Experimental, forces go-task |
| git submodules | Complex workflow, poor DX |
| npm package | Publish overhead, registry dependency |
| Lit web component | Adds framework dependency |
| Copy-paste | Drift between projects |

## Consumer Integration

```sh
# Clone
git clone --depth 1 https://github.com/joeblew999/cf-deploy.git .src/cf-deploy

# Use from any runner
bun .src/cf-deploy/bin/cf-deploy.ts upload
bun .src/cf-deploy/bin/cf-deploy.ts promote
```
