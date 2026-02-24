# cf-deploy

Cloudflare Workers deploy toolkit — wraps `wrangler` with versioning, smoke tests, and a version picker UI.

## Install

**With Bun** (recommended — works as npx-style runner or project dependency):

```sh
# Run directly (no install needed)
bunx cf-deploy --help

# Or add to your project
bun add -d cf-deploy
```

**Standalone binary** (no Bun required):

```sh
curl -sSL https://raw.githubusercontent.com/joeblew999/cf-deploy/main/install.sh | bash
sudo mv cf-deploy /usr/local/bin/
```

## Quick Start

```sh
# 1. Scaffold a new project
cf-deploy init --name my-worker --domain my-org.workers.dev
cd my-worker && bun install

# 2. Local dev
bun x wrangler dev                    # → http://localhost:8788

# 3. Deploy (upload + smoke test + preview URL)
cf-deploy deploy

# 4. Go live
cf-deploy promote
```

That's it. Every version gets a permanent preview URL (e.g. `v1-2-0-my-worker.my-org.workers.dev`).

## Config

Create `cf-deploy.yml` in your project root (or let `cf-deploy init` generate it):

```yaml
worker:
  name: my-worker
  domain: my-org.workers.dev
  dir: .

urls:
  production: https://my-worker.my-org.workers.dev

github:
  repo: myorg/my-project

version:
  source: package.json

output:
  versions_json: public/versions.json
```

All values can be overridden by env vars (`WORKER_NAME`, `WORKER_DOMAIN`, etc.).

## Commands

| Command | What it does |
|---------|-------------|
| `deploy [--version X] [--tag T]` | Upload + smoke test + show preview URL |
| `upload [--version X] [--tag T]` | Upload new version (does NOT promote) |
| `promote [--version X]` | Send version to 100% traffic |
| `rollback` | Revert to previous version |
| `canary` | Gradual traffic split (interactive) |
| `smoke [URL]` | Health + index + custom checks |
| `test [URL]` | Run Playwright tests |
| `versions-json [--latest\|--latest-env]` | Generate versions manifest |
| `preview --pr N` | Upload PR preview |
| `list` | Show all versions with URLs |
| `status` | Current deployment info |
| `delete [--yes]` | Tear down the worker |
| `init --name N --domain D` | Scaffold a new project |

## Version Picker

Zero-dependency web component, auto-copied into your assets on every upload:

```html
<script type="module" src="/version-picker.js"></script>
<cf-version-picker></cf-version-picker>
```

Reads `/versions.json` + `/api/health` at page load. Shows a dropdown of all deployed versions and PR previews with git metadata. Uses light DOM — inherits your page's CSS.

## CI Integration

```yaml
# Deploy job (push to main)
- run: cf-deploy upload
- run: cf-deploy versions-json
- run: cf-deploy upload            # re-upload with manifest included
- run: cf-deploy versions-json     # regenerate with final version ID
- run: cf-deploy smoke
- run: cf-deploy test
- run: cf-deploy promote

# PR previews
- run: cf-deploy preview --pr ${{ github.event.pull_request.number }}
- run: cf-deploy smoke $PREVIEW_URL
- run: cf-deploy test $PREVIEW_URL
```

See [.github/workflows/](.github/workflows/) for the complete working examples.

## Live Example

See [example/](example/) for a complete working setup.

| | URL |
|---|---|
| App | https://cf-deploy-example.gedw99.workers.dev |
| Health | https://cf-deploy-example.gedw99.workers.dev/api/health |
| Manifest | https://cf-deploy-example.gedw99.workers.dev/versions.json |

## Requirements

- [Bun](https://bun.sh) (or use the standalone binary)
- `wrangler` in your worker project (`bun add -d wrangler`)
