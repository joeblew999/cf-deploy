# Agent Instructions (cf-deploy)

This file serves as the "source of truth" for AI agents (like Gemini) working on this repository.

## 🚀 Development Workflow

1.  **Modify**: Apply changes to `lib/`, `bin/`, or `web/`.
2.  **Test Locally**: Run `./scripts/test-local.sh`. This verifies the bundle, template inlining, and scaffolding without polluting your OS.
3.  **Comprehensive Check**: Run `./scripts/test-example.sh` if you have Cloudflare credentials. This verifies the full upload/promote/rollback lifecycle.
4.  **Commit & Push**: Commit with descriptive messages.
5.  **Watch CI**: Immediately use the GitHub CLI (`gh`) to monitor the Actions:
    - Run `gh run watch` to follow the progress live.
    - Run `gh run list --limit 5` to see the recent history.
    - Run `gh run view <ID> --log` if a job fails to diagnose the error.
    - Workflows to watch: `ci.yml` (build/test), `deploy.yml` (production), `pr-preview.yml`.
6.  **Verify Web**: Check the live state at:
    - Production: https://cf-deploy-example.gedw99.workers.dev
    - Health: https://cf-deploy-example.gedw99.workers.dev/api/health
    - Manifest: https://cf-deploy-example.gedw99.workers.dev/versions.json

## 🛠 Project Constants

- **Inlined Assets**: All templates must be inlined in `lib/upload.ts` and `lib/init.ts` using Bun's text imports (`with { type: "text" }`).
- **Wrangler Wrapper**: Always use the `wrangler()` helper in `lib/wrangler.ts` to ensure consistent `--name` and directory handling.
- **Naming**: All preview alias slugs must be `.toLowerCase()` to prevent Cloudflare API errors.

## 📝 To-Do / Maintenance

- [ ] Monitor `wrangler` updates and ensure compatibility.
- [ ] Keep `install.sh` in sync with the release workflow patterns.
- [ ] Ensure the version picker component remains zero-dependency.
