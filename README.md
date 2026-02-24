# cf-deploy

Cloudflare Workers deploy toolkit — wraps `wrangler` with versioning, smoke tests, and a version picker UI.

No config file needed — cf-deploy reads your existing `wrangler.toml` directly.

## Prerequisites

- An existing [Cloudflare Workers](https://developers.cloudflare.com/workers/) project with `wrangler.toml`
- [Bun](https://bun.sh) runtime
- `wrangler` as a dev dependency (`bun add -d wrangler`)

## Install

From your worker project:

```sh
bun add -d github:joeblew999/cf-deploy
bun pm trust cf-deploy && bun install   # allow build script to run
bun x cf-deploy --help
```

Bun blocks lifecycle scripts from git packages by default. `bun pm trust` whitelists cf-deploy so the `prepare` script can build the CLI. You only need to do this once — it's saved in your `package.json`.

To remove:

```sh
bun remove cf-deploy
```

## What It Does

cf-deploy wraps `wrangler` to add:

1. **Tagged versions** — each upload gets a semver tag from your `package.json` and a preview URL
2. **Version manifest** — `versions.json` ships with your deploy, listing all versions + PR previews
3. **Smoke tests** — checks `/api/health` and index page after deploy
4. **Promote/rollback** — send any version to 100% traffic, or revert to the previous one
5. **Version picker** — zero-dependency web component showing deployed versions with links

## Adding to an Existing Project

You already have a wrangler project. Here's what cf-deploy expects:

1. **`wrangler.toml`** — cf-deploy reads `name` and `[assets] directory` from it
2. **`package.json`** with a `version` field — this becomes the deploy tag (e.g. `v1.2.0`)
3. **A `/api/health` endpoint** — your worker should return `{ "status": "ok", "version": env.APP_VERSION }` so smoke tests and the version picker work

That's it. No cf-deploy config file.

### Example health endpoint (Hono)

```ts
app.get("/api/health", (c) => {
  return c.json({
    status: "ok",
    version: c.env.APP_VERSION || "0.0.0",
    timestamp: new Date().toISOString(),
  });
});
```

### Add the version picker (optional)

```html
<script type="module" src="/version-picker.js"></script>
<cf-version-picker></cf-version-picker>
```

The `version-picker.js` file is auto-copied into your assets dir on every upload.

## Commands

| Command | What it does |
|---------|-------------|
| `upload [--version X] [--pr N]` | Upload a new version with preview URL |
| `promote [--version X]` | Send version to 100% traffic |
| `rollback` | Revert to previous version |
| `smoke <URL>` | Health + index check |
| `versions-json` | Generate versions manifest for the picker |
| `init --name N [--domain D]` | Scaffold a new project from scratch |

Global flags: `--dir PATH`, `--name NAME`, `--domain DOMAIN`

## Deploy Flow

```
package.json "version" field
      |
      v
cf-deploy versions-json   -> queries wrangler for existing versions
                              writes versions.json to your assets dir
      |
      v
cf-deploy upload           -> wrangler versions upload --tag v1.2.0
                              injects APP_VERSION binding via --var
                              versions.json ships with the deploy
      |
      v
cf-deploy smoke <url>      -> checks /api/health and index page
      |
      v
cf-deploy promote          -> wrangler versions deploy <id>@100%
```

One upload. No double cycle. `APP_VERSION` is injected at upload time via `--var` — no hardcoded version strings.

## CI Setup

Set `CLOUDFLARE_API_TOKEN` as a GitHub Actions secret ([create one here](https://dash.cloudflare.com/profile/api-tokens) using the "Edit Cloudflare Workers" template).

```yaml
env:
  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

steps:
  # Deploy (push to main)
  - run: bun x cf-deploy versions-json
  - run: bun x cf-deploy upload
  - run: bun x cf-deploy smoke $URL
  - run: bun x cf-deploy promote

  # PR preview
  - run: bun x cf-deploy upload --pr ${{ github.event.pull_request.number }}
```

See [.github/workflows/](.github/workflows/) for complete examples.

## Starting from Scratch

If you don't have an existing project:

```sh
mkdir my-worker && cd my-worker
bun init -y
bun add -d github:joeblew999/cf-deploy wrangler
bun pm trust cf-deploy && bun install
bun x cf-deploy init --name my-worker
bun x wrangler dev              # http://localhost:8788
```

`init` scaffolds into the current directory: `wrangler.toml`, `package.json`, `src/index.ts`, `public/index.html`, and the version picker.

## Examples

Three example projects, all validated by integration tests (`wrangler deploy --dry-run`):

| Example | What it shows |
|---------|---------------|
| [example/](example/) | Live deployed project (Hono + DaisyUI) |
| [examples/from-scratch/](examples/from-scratch/) | New project — same as what `cf-deploy init` scaffolds |
| [examples/existing-worker/](examples/existing-worker/) | Existing project — plain fetch handler, no framework |

### Live URLs

| | URL |
|---|---|
| Production | https://cf-deploy-example.gedw99.workers.dev |
| Health | https://cf-deploy-example.gedw99.workers.dev/api/health |
| Versions manifest | https://cf-deploy-example.gedw99.workers.dev/versions.json |
| Version picker | https://cf-deploy-example.gedw99.workers.dev/version-picker.js |
| v1.1.0 alias | https://v1-1-0-cf-deploy-example.gedw99.workers.dev |
| v1.0.0 alias | https://v1-0-0-cf-deploy-example.gedw99.workers.dev |
