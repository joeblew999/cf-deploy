# cf-deploy

Reusable Cloudflare Workers deploy toolkit — **CLI + versions manifest + version picker web component**.

Wraps `wrangler` with versioning conventions: tagged uploads, one-command promote, smoke tests, rollback, versions.json manifest, and a zero-dependency version picker UI component.

## Live Example

The [example/](example/) folder contains a complete, deployed Cloudflare Worker managed by cf-deploy:

| What | URL |
|------|-----|
| **Live app** | https://cf-deploy-example.gedw99.workers.dev |
| **Health endpoint** | https://cf-deploy-example.gedw99.workers.dev/api/health |
| **Versions manifest** | https://cf-deploy-example.gedw99.workers.dev/versions.json |
| **v1.0.0 alias** | https://v1-0-0-cf-deploy-example.gedw99.workers.dev |

Clone the repo and run it locally too:

```sh
cd example
bun install
bun x wrangler dev    # → http://localhost:8788
```

## Why Not Just Use the Cloudflare Dashboard?

The Cloudflare dashboard shows deployments, but:

- **No PR preview URLs in your app** — cf-deploy surfaces every `pr-N` preview directly in your own UI via the version picker
- **No version switching for users** — the `<cf-version-picker>` dropdown lets users (and QA) jump between any deployed version
- **No versions manifest** — `versions.json` is a machine-readable record of every deploy with git metadata, timestamps, and preview URLs
- **No smoke tests** — cf-deploy runs health + index + custom checks before you promote
- **No single-command promote** — `cf-deploy promote` reads versions.json and deploys the latest to 100% traffic
- **Dashboard is per-worker** — cf-deploy config lives in your repo, versioned with your code
- **Full lifecycle** — `cf-deploy delete` tears down the worker when you're done

cf-deploy puts everything you need **in your own web GUI** rather than behind a separate dashboard login.

## How Version Data Works

All version metadata is **generated at dev/build time** and embedded as a static JSON file — zero runtime dependency on Cloudflare's API or infrastructure:

1. `cf-deploy versions-json` queries wrangler + git locally and writes `versions.json` to your static assets
2. `versions.json` is deployed alongside your app as a regular static file
3. The `<cf-version-picker>` reads `versions.json` at page load — no API calls to Cloudflare at runtime
4. Your app's `/api/health` endpoint returns the current version (you implement this)

This means:
- **Offline-capable** — version data works even if Cloudflare's dashboard is down
- **Fast** — no API calls, just a static JSON fetch
- **Auditable** — `versions.json` is in your git history
- **Works locally** — `wrangler dev` serves the same static files on localhost

## Three Layers

| Layer | When | Where | What |
|-------|------|-------|------|
| **Dev-time CLI** | Developer runs commands | Local / CI | `cf-deploy upload`, `promote`, `rollback`, `smoke` — wraps wrangler |
| **Build-time codegen** | Deploy pipeline | Local / CI | `cf-deploy versions-json` — generates manifest from wrangler + git |
| **Runtime component** | Page load | Browser | `<cf-version-picker>` — vanilla Web Component, zero dependencies |

## Quick Start

```sh
# Clone into your project (follows .src/ vendor pattern)
git clone --depth 1 https://github.com/joeblew999/cf-deploy.git .src/cf-deploy

# Copy and customize config
cp .src/cf-deploy/example/cf-deploy.yml ./cf-deploy.yml

# Use
bun .src/cf-deploy/bin/cf-deploy.ts upload --version 1.0.0
bun .src/cf-deploy/bin/cf-deploy.ts versions-json
bun .src/cf-deploy/bin/cf-deploy.ts smoke
bun .src/cf-deploy/bin/cf-deploy.ts promote
```

See [example/](example/) for a complete working setup with Hono, static assets, and the version picker.

## Config: `cf-deploy.yml`

```yaml
worker:
  name: my-worker
  domain: example.workers.dev
  dir: .

urls:
  production: https://my-app.example.com

github:
  repo: myorg/my-project

version:
  source: package.json

output:
  versions_json: public/versions.json

smoke:
  extra: "npm run smoke:extra"   # optional
```

All values can be overridden by env vars (`WORKER_NAME`, `WORKER_DOMAIN`, etc.).

## CLI Commands

```
cf-deploy upload [--version X] [--tag T]   Upload new version (does NOT promote)
cf-deploy promote                          Deploy latest version to 100% traffic
cf-deploy rollback                         Roll back to previous version
cf-deploy canary                           Gradual traffic split (interactive)
cf-deploy smoke [URL]                      Smoke test (health + index + custom)
cf-deploy versions-json                    Generate versions.json manifest
cf-deploy test [URL]                       Run Playwright tests against a URL
cf-deploy preview --pr N                   Upload PR preview
cf-deploy list                             Show all versions with URLs
cf-deploy status                           Current deployment info
cf-deploy versions                         Raw wrangler versions list
cf-deploy delete                           Delete the Worker (full teardown)
cf-deploy tail                             Tail live Worker logs
cf-deploy secrets                          List Worker secrets
cf-deploy whoami                           Cloudflare auth info
```

## Version Picker

Zero-dependency vanilla Web Component. Copy `web/version-picker.js` to your web directory:

```html
<script type="module" src="/version-picker.js"></script>
<cf-version-picker></cf-version-picker>
```

Fetches `/api/health` + `/versions.json`, renders a dropdown with all deployed versions, PR preview URLs, and links to production + GitHub releases. Uses light DOM — inherits your page's CSS (DaisyUI, Tailwind, or anything). Works on localhost and production.

## Task Runner Integration

Works with **any** task runner or none at all:

```yaml
# go-task
"cf:upload":
  cmds: [bun .src/cf-deploy/bin/cf-deploy.ts upload]
```

```json
// npm scripts
{ "deploy:upload": "bun .src/cf-deploy/bin/cf-deploy.ts upload" }
```

```makefile
# Makefile
upload: ; bun .src/cf-deploy/bin/cf-deploy.ts upload
```

## Architecture

See [ADR.md](ADR.md) for the full design rationale.

## Requirements

- [Bun](https://bun.sh/) (runs TypeScript natively)
- [wrangler](https://developers.cloudflare.com/workers/wrangler/) (installed per-project via `bun install`)
