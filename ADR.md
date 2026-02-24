# ADR-0022: cf-deploy — Reusable Cloudflare Workers Deploy Toolkit

**Author**: Claude (Anthropic) + Joe
**Date**: 2026-02-24

## Status

**Proposed**

## Problem

Both plat-trunk and remy-sport deploy to Cloudflare Workers using the same pattern: wrangler versions upload with tags, promote, smoke test, rollback, versions.json manifest, version-picker UI component. This pattern is currently embedded in plat-trunk's go-task infrastructure (`taskfiles/Taskfile.cloudflare.yml` + `scripts/versions-json.ts` + `web/gui/version-picker.js`).

The pattern works, but it's not reusable:

- **Taskfile lock-in**: go-task remote includes exist (experimental) but force every consumer to use go-task. Task is the wrong abstraction — it's a task runner, not a distribution mechanism.
- **Copy-paste drift**: remy-sport has its own versions of these files that diverge from plat-trunk's.
- **Lit dependency**: The version-picker vendors Lit.js, adding a framework dependency where none is needed.
- **No single source of truth**: Two projects, two copies, no shared upstream.

## Decision

Extract the deploy pattern into a standalone **Bun CLI toolkit** (`cf-deploy`) in its own GitHub repo. The value is in the **scripts and conventions**, not the task runner. Any task runner can call the CLI — task, make, just, npm scripts, shell, or nothing.

### Three Layers

The toolkit spans three execution contexts:

| Layer | When | Where | What |
|-------|------|-------|------|
| **Dev-time CLI** | Developer runs commands | Local machine / CI | `cf-deploy upload`, `promote`, `rollback`, `smoke` — wraps wrangler with versioning conventions |
| **Build-time codegen** | Deploy pipeline | Local machine / CI | `cf-deploy versions-json` — parses wrangler output, enriches with git metadata, writes `versions.json` manifest |
| **Runtime component** | Page load in browser | End user's browser | `<cf-version-picker>` — vanilla Web Component, zero dependencies, consumes `versions.json` |

The CLI and codegen depend on Bun + wrangler. The runtime component has **zero dependencies** — just a single JS file that any browser can load.

### Repo Structure: `joeblew999/cf-deploy`

```
cf-deploy/
  bin/cf-deploy.ts              # CLI entry point (Bun)
  lib/
    config.ts                   # Reads cf-deploy.yml
    upload.ts                   # wrangler versions upload + version tagging
    promote.ts                  # Read versions.json → find latest → wrangler deploy
    smoke.ts                    # Health + index + optional custom checks
    versions.ts                 # Generate versions.json manifest
    rollback.ts                 # wrangler rollback
    preview.ts                  # PR preview upload
    status.ts                   # wrangler deployments list
    list.ts                     # Parse + display all versions/previews
  web/
    version-picker.js           # Vanilla Web Component (zero dependencies)
  cf-deploy.example.yml         # Template config
  package.json
  README.md
```

### CLI Interface

```sh
cf-deploy upload [--version 0.7.0] [--tag pr-42]
cf-deploy promote
cf-deploy rollback
cf-deploy smoke [URL]
cf-deploy versions-json
cf-deploy preview --pr 42
cf-deploy status
cf-deploy list
cf-deploy whoami
```

All commands read config from `cf-deploy.yml` (or `--config path`), with env var overrides.

### Config File: `cf-deploy.yml`

One per project, checked into git:

```yaml
worker:
  name: truck-cad
  domain: gedw99.workers.dev
  dir: systems/truck/worker       # relative to repo root

urls:
  production: https://cad.ubuntusoftware.net

github:
  repo: joeblew999/plat-trunk

version:
  source: web/cad-schema.json     # JSON file with .version field
  # OR: source: package.json

output:
  versions_json: web/gui/versions.json

smoke:
  extra: "task truck:smoke:extra"  # optional project-specific checks
```

### Version Picker: Vanilla Web Component

Rewrite as zero-dependency vanilla Web Component:

- No Lit — `HTMLElement` + `innerHTML`
- Same DaisyUI dropdown rendering (light DOM — inherits page CSS)
- Reads all URLs from `versions.json` manifest (no hardcoded values)
- Configurable via HTML attributes: `health-path`, `manifest-path`, `local-port`
- Element name: `<cf-version-picker>` (generic)
- ~120 lines, zero external dependencies

## Consumer Integration

### Installation

Follows the existing `.src/` clone pattern (same as `.src/truck`, `.src/ifc-lite`):

```sh
git clone --depth 1 https://github.com/joeblew999/cf-deploy.git .src/cf-deploy
```

### From go-task

```yaml
tasks:
  "cf:upload":
    cmds: [bun .src/cf-deploy/bin/cf-deploy.ts upload]
  "cf:promote":
    cmds: [bun .src/cf-deploy/bin/cf-deploy.ts promote]
```

### From npm scripts

```json
{ "scripts": { "deploy:upload": "cf-deploy upload" } }
```

### From Makefile

```makefile
upload:
	bun .src/cf-deploy/bin/cf-deploy.ts upload
```

### From shell (no task runner)

```sh
bun .src/cf-deploy/bin/cf-deploy.ts upload --version 0.7.0
```

## Alternatives Considered

| Alternative | Why not |
|-------------|---------|
| **go-task remote includes** | Experimental, forces go-task on all consumers |
| **go-task local includes** | Current state — not reusable without go-task |
| **git submodules** | Complex workflow, poor DX |
| **npm package** | Publishing overhead, registry dependency, overkill for 2-3 projects |
| **Template repo + cherry-pick** | Manual sync, drift, doesn't scale |
| **Vendoring Lit** | Adds framework dependency where none is needed |
| **Just keep copying files** | Leads to drift between projects |

## Impact on plat-trunk

| File | Change |
|------|--------|
| `taskfiles/Taskfile.cloudflare.yml` | Becomes thin adapter calling CLI, or removed |
| `scripts/versions-json.ts` | Replaced by `.src/cf-deploy/lib/versions.ts` |
| `web/gui/version-picker.js` | Replaced by vanilla version from `.src/cf-deploy/web/` |
| `web/gui/vendor/lit.js` | Can be removed if version-picker was its only consumer |
| `cf-deploy.yml` | NEW — project config |
| `systems/truck/Taskfile.truck.yml` | `gui:deploy` calls CLI instead of `:cf:upload` |

## Implementation Order

1. Create `joeblew999/cf-deploy` repo with CLI structure
2. Port `versions-json.ts` → `lib/versions.ts` (already parameterized)
3. Port `Taskfile.cloudflare.yml` logic → individual `lib/*.ts` modules
4. Write `bin/cf-deploy.ts` CLI entry point (subcommand dispatch)
5. Write `lib/config.ts` to read `cf-deploy.yml`
6. Rewrite version-picker as vanilla Web Component
7. Create `cf-deploy.yml` in plat-trunk
8. Update plat-trunk to consume from `.src/cf-deploy/`
9. Update docs (CONTEXT.md, CLAUDE.md)

## Key Design Decisions

1. **Bun, not Node** — already in the stack, runs TypeScript natively, fast startup
2. **Config file, not env vars** — `cf-deploy.yml` is self-documenting and checked into git. Env vars still work as overrides.
3. **Clone, not npm install** — `.src/cf-deploy/` follows existing vendor pattern, no publish step
4. **Vanilla Web Component** — zero dependencies, works with any CSS framework
5. **CLI, not library** — `cf-deploy upload` is the interface. Internals can change without breaking consumers.

## Verification

```sh
# CLI works standalone
bun .src/cf-deploy/bin/cf-deploy.ts --help
bun .src/cf-deploy/bin/cf-deploy.ts upload --version 0.7.0
bun .src/cf-deploy/bin/cf-deploy.ts versions-json
bun .src/cf-deploy/bin/cf-deploy.ts smoke

# Full deploy cycle
task truck:gui:deploy    # builds + calls cf-deploy upload
task cf:smoke            # calls cf-deploy smoke
task cf:promote          # calls cf-deploy promote

# Version picker (Playwright)
# Navigate to localhost:8788, verify <cf-version-picker> dropdown
```

## References

- ADR-0017: Versioned Deployments via Cloudflare Workers (the pattern being extracted)
- `taskfiles/Taskfile.cloudflare.yml` — current task-based implementation
- `scripts/versions-json.ts` — current manifest generator
- `web/gui/version-picker.js` — current Lit-based version picker
