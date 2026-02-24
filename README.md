# cf-deploy

Cloudflare Workers deploy toolkit — wraps `wrangler` with versioning, smoke tests, and a version picker UI.

## Install

```sh
# Run directly (no install needed)
bunx cf-deploy --help

# Or add to your project
bun add -d cf-deploy
```

## Quick Start

```sh
# 1. Scaffold a new project
cf-deploy init --name my-worker
cd my-worker && bun install

# 2. Local dev
bun x wrangler dev                    # http://localhost:8788

# 3. Deploy
cf-deploy versions-json               # generate version manifest
cf-deploy upload                       # tagged upload + preview URL
cf-deploy smoke https://my-worker.workers.dev
cf-deploy promote                      # go live
```

No config file needed — cf-deploy reads `wrangler.toml` directly.

## Commands

| Command | What it does |
|---------|-------------|
| `upload [--version X] [--pr N]` | Upload a new version with preview URL |
| `promote [--version X]` | Send version to 100% traffic |
| `rollback` | Revert to previous version |
| `smoke <URL>` | Health + index check |
| `versions-json` | Generate versions manifest for the picker |
| `init --name N [--domain D]` | Scaffold a new project |

Global flags: `--dir PATH`, `--name NAME`, `--domain DOMAIN`

## How It Works

```
package.json "version" field
      │
      ▼
cf-deploy versions-json   → queries wrangler for existing versions
                             writes versions.json to your assets dir
      │
      ▼
cf-deploy upload           → wrangler versions upload --tag v1.2.0
                             injects APP_VERSION binding via --var
                             versions.json ships with the deploy
      │
      ▼
cf-deploy smoke <url>      → checks /api/health and index page
      │
      ▼
cf-deploy promote          → wrangler versions deploy <id>@100%
```

One upload. No double cycle. The version in `/api/health` comes from `APP_VERSION` injected at upload time — no hardcoded version strings.

## Version Picker

Zero-dependency web component, auto-copied into your assets on every upload:

```html
<script type="module" src="/version-picker.js"></script>
<cf-version-picker></cf-version-picker>
```

Shows current version from `/api/health` + version history from `/versions.json`.

## CI

```yaml
# Deploy (push to main)
- run: cf-deploy versions-json
- run: cf-deploy upload
- run: cf-deploy smoke $URL
- run: cf-deploy promote

# PR preview
- run: cf-deploy upload --pr ${{ github.event.pull_request.number }}
```

See [.github/workflows/](.github/workflows/) for complete examples.

## Live Example

See [example/](example/) for a working setup.

| | URL |
|---|---|
| App | https://cf-deploy-example.gedw99.workers.dev |
| Health | https://cf-deploy-example.gedw99.workers.dev/api/health |

## Requirements

- [Bun](https://bun.sh) (or standalone binary from Releases)
- `wrangler` in your worker project (`bun add -d wrangler`)
