#!/usr/bin/env bun
// @bun

// lib/config.ts
import { existsSync, readFileSync } from "fs";
import { join, resolve } from "path";
function readName(text) {
  const m = text.match(/^name\s*=\s*"([^"]+)"/m);
  return m?.[1] || "my-worker";
}
function readAssetsDir(text) {
  const m = text.match(/\[assets\]\s*\n\s*directory\s*=\s*"([^"]+)"/);
  return m?.[1] || "public";
}
function readVersion(dir) {
  if (process.env.APP_VERSION)
    return process.env.APP_VERSION;
  const pkgPath = join(dir, "package.json");
  if (!existsSync(pkgPath))
    return "0.0.0";
  try {
    return JSON.parse(readFileSync(pkgPath, "utf8")).version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}
function loadConfig(opts) {
  const workerDir = resolve(opts?.dir || process.env.CF_DEPLOY_DIR || ".");
  const tomlPath = join(workerDir, "wrangler.toml");
  let toml = "";
  if (existsSync(tomlPath)) {
    toml = readFileSync(tomlPath, "utf8");
  }
  const name = opts?.name || process.env.CF_DEPLOY_NAME || readName(toml);
  const assetsDir = resolve(workerDir, readAssetsDir(toml));
  const domain = opts?.domain || process.env.CF_DEPLOY_DOMAIN || "workers.dev";
  return { name, assetsDir, workerDir, domain };
}

// lib/deploy.ts
import { existsSync as existsSync2, mkdirSync, writeFileSync } from "fs";
import { join as join2 } from "path";

// lib/wrangler.ts
import { execSync } from "child_process";

// web/version-picker.js
var version_picker_default = `/**
 * <cf-version-picker> \u2014 Vanilla Web Component: version badge + dropdown.
 *
 * Zero dependencies. Fetches /api/health and /versions.json on connect,
 * renders a dropdown with all deployed versions, PR previews, and links.
 * Uses light DOM \u2014 inherits page styles (DaisyUI, Tailwind, or any CSS).
 *
 * Usage:
 *   <cf-version-picker></cf-version-picker>
 *
 * Optional attributes:
 *   health-path    \u2014 health endpoint path (default: "/api/health")
 *   manifest-path  \u2014 versions.json path (default: "/versions.json")
 *   local-port     \u2014 local dev port (default: "8788")
 */
class CfVersionPicker extends HTMLElement {
  connectedCallback() {
    this._healthPath = this.getAttribute("health-path") || "/api/health";
    this._manifestPath = this.getAttribute("manifest-path") || "/versions.json";
    this._localPort = this.getAttribute("local-port") || "8788";
    this._isLocal =
      location.hostname === "localhost" || location.hostname === "127.0.0.1";
    this._data = {
      versions: [],
      previews: [],
      production: "",
      github: "",
      generated: "",
    };
    this._current = "?";
    this._loaded = false;
    this._render();
    this._fetchData();
  }

  async _fetchData() {
    try {
      const [health, manifest] = await Promise.all([
        fetch(this._healthPath)
          .then((r) => r.json())
          .catch(() => ({})),
        fetch(this._manifestPath)
          .then((r) => r.json())
          .catch(() => ({ versions: [] })),
      ]);
      this._current = health.version || "?";
      this._data = {
        versions: manifest.versions || [],
        previews: manifest.previews || [],
        production: manifest.production || "",
        github: manifest.github || "",
        generated: manifest.generated || "",
      };
      this._loaded = true;
      this._render();
    } catch {
      /* silent \u2014 badge stays "..." */
    }
  }

  _render() {
    const label = !this._loaded
      ? "..."
      : this._isLocal
        ? "local"
        : "v" + this._current;
    const title = !this._loaded
      ? ""
      : (this._isLocal ? "Local dev" : "v" + this._current) +
        " \u2014 click to switch versions";

    if (!this._loaded || this._data.versions.length === 0) {
      this.innerHTML = \`
        <div class="dropdown dropdown-top dropdown-end">
          <div tabindex="0" role="button"
               class="badge badge-outline hover:badge-primary cursor-pointer font-mono text-xs"
               title="\${this._esc(title)}">\${this._esc(label)}</div>
        </div>\`;
      return;
    }

    const v = this._data;
    const releases = v.versions.map((r) => this._renderRelease(r)).join("");

    const previews =
      v.previews.length > 0
        ? \`<li class="menu-title mt-1 pt-1 border-t border-base-300">
           <span>PR Previews</span>
         </li>\` + v.previews.map((p) => this._renderPreview(p)).join("")
        : "";

    const localUrl = \`http://localhost:\${this._localPort}\`;
    const generated = v.generated ? this._relativeTime(v.generated) : "";

    this.innerHTML = \`
      <div class="dropdown dropdown-top dropdown-end">
        <div tabindex="0" role="button"
             class="badge badge-outline hover:badge-primary cursor-pointer font-mono text-xs"
             title="\${this._esc(title)}">\${this._esc(label)}</div>
        <ul tabindex="0" class="dropdown-content menu bg-base-200 rounded-box z-50 w-72 p-2 shadow-xl text-xs mb-2">

          <li class="menu-title">
            <span>Versions</span>
          </li>
          \${releases}

          \${previews}

          <li class="menu-title mt-1 pt-1 border-t border-base-300">
            <span>Links</span>
          </li>
          <li><a href="\${localUrl}" class="\${this._isLocal ? "active" : ""}">
            \${this._isLocal ? this._dot("success") : this._dot("neutral")}
            Local Dev
            <span class="font-mono opacity-50">:\${this._esc(this._localPort)}</span>
          </a></li>
          \${
            v.production
              ? \`<li><a href="\${this._esc(v.production)}" target="_blank">
            \\u{1F310} Production
          </a></li>\`
              : ""
          }
          \${
            v.github
              ? \`<li><a href="\${this._esc(v.github)}" target="_blank">
            \\u{1F4E6} GitHub
          </a></li>\`
              : ""
          }

          \${
            generated
              ? \`<li class="disabled mt-1 pt-1 border-t border-base-300">
            <span class="opacity-40 text-[0.6rem]">Updated \${this._esc(generated)}</span>
          </li>\`
              : ""
          }
        </ul>
      </div>\`;
  }

  _renderRelease(r) {
    const isCurrent = r.version === this._current;
    const g = r.git;
    const date = r.date ? this._shortDate(r.date) : "";

    const healthDot =
      r.healthy === true
        ? this._dot("success")
        : r.healthy === false
          ? this._dot("error")
          : isCurrent
            ? this._dot("success")
            : this._dot("neutral");

    // Commit hash as span (not <a>) to avoid nested-anchor browser breakage
    const commitHtml = g?.commitSha
      ? \`<span class="font-mono opacity-40 hover:opacity-100 cursor-pointer"
          title="\${this._esc(g.commitMessage || "")}"
          onclick="event.preventDefault();event.stopPropagation();window.open('\${this._esc(g.commitUrl)}','_blank')">\${this._esc(g.commitSha)}</span>\`
      : "";

    return \`<li>
      <a href="\${this._esc(r.url)}"
         target="\${isCurrent ? "" : "_blank"}"
         class="\${isCurrent ? "active" : ""}">
        <span class="flex items-center justify-between w-full gap-2">
          <span class="flex items-center gap-1.5 min-w-0">
            \${healthDot}
            <span>v\${this._esc(r.version)}</span>
            \${isCurrent ? '<span class="badge badge-xs badge-success">live</span>' : ""}
          </span>
          <span class="flex items-center gap-2 shrink-0">
            \${commitHtml}
            <span class="opacity-30">\${this._esc(date)}</span>
          </span>
        </span>
      </a>
    </li>\`;
  }

  _renderPreview(p) {
    const healthDot =
      p.healthy === true
        ? this._dot("success")
        : p.healthy === false
          ? this._dot("error")
          : this._dot("warning");
    const date = p.date ? this._shortDate(p.date) : "";

    const prNum = p.tag?.replace("pr-", "") || "";
    const prLink =
      this._data.github && prNum
        ? \`<span class="opacity-40 hover:opacity-100 cursor-pointer"
          title="View PR on GitHub"
          onclick="event.preventDefault();event.stopPropagation();window.open('\${this._esc(this._data.github + "/pull/" + prNum)}','_blank')">#\${this._esc(prNum)}</span>\`
        : "";

    return \`<li>
      <a href="\${this._esc(p.url)}" target="_blank">
        <span class="flex items-center justify-between w-full gap-2">
          <span class="flex items-center gap-1.5 min-w-0">
            \${healthDot}
            <span>\${this._esc(p.label)}</span>
          </span>
          <span class="flex items-center gap-2 shrink-0">
            \${prLink}
            <span class="opacity-30">\${this._esc(date)}</span>
          </span>
        </span>
      </a>
    </li>\`;
  }

  /** Colored status dot */
  _dot(color) {
    const colors = {
      success: "bg-success",
      error: "bg-error",
      warning: "bg-warning",
      neutral: "bg-base-content opacity-20",
    };
    return \`<span class="inline-block w-1.5 h-1.5 rounded-full shrink-0 \${colors[color] || colors.neutral}"></span>\`;
  }

  /** Short date: "Feb 24" or "Feb 24, 2025" if different year */
  _shortDate(iso) {
    try {
      const d = new Date(iso);
      const now = new Date();
      const opts = { month: "short", day: "numeric" };
      if (d.getFullYear() !== now.getFullYear()) opts.year = "numeric";
      return d.toLocaleDateString("en-US", opts);
    } catch {
      return "";
    }
  }

  /** Relative time: "2m ago", "3h ago", "yesterday" */
  _relativeTime(iso) {
    try {
      const diff = Date.now() - new Date(iso).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return "just now";
      if (mins < 60) return mins + "m ago";
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return hrs + "h ago";
      const days = Math.floor(hrs / 24);
      if (days === 1) return "yesterday";
      return days + "d ago";
    } catch {
      return "";
    }
  }

  /** Escape HTML to prevent XSS from manifest data */
  _esc(s) {
    if (!s) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}

customElements.define("cf-version-picker", CfVersionPicker);
`;

// lib/wrangler.ts
var VERSION_PICKER_JS = `// AUTO-GENERATED by cf-deploy \u2014 do not edit.
// Source: https://github.com/joeblew999/cf-deploy/blob/main/web/version-picker.js

` + version_picker_default;
function workerUrl(config, prefix) {
  return `https://${prefix}-${config.name}.${config.domain}`;
}
function versionAliasUrl(config, version) {
  const slug = version.replaceAll(".", "-").toLowerCase();
  return workerUrl(config, `v${slug}`);
}
function wrangler(config, args, options = {}) {
  const fullArgs = ["bun", "x", "wrangler", ...args, "--name", config.name];
  return execSync(fullArgs.map((a) => `"${a}"`).join(" "), {
    cwd: config.workerDir,
    stdio: "inherit",
    ...options
  });
}
function fetchWranglerVersions(config) {
  const raw = wrangler(config, ["versions", "list"], {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"]
  }).toString();
  return parseWranglerOutput(raw).reverse();
}
function parseWranglerOutput(raw) {
  const entries = [];
  let cur = {};
  for (const line of raw.split(`
`)) {
    const idMatch = line.match(/^Version ID:\s+(.+)/);
    const createdMatch = line.match(/^Created:\s+(.+)/);
    const tagMatch = line.match(/^Tag:\s+(.+)/);
    if (idMatch) {
      cur = { versionId: idMatch[1].trim() };
    } else if (createdMatch && cur.versionId) {
      cur.created = createdMatch[1].trim();
    } else if (tagMatch && cur.versionId) {
      cur.tag = tagMatch[1].trim();
      if (cur.tag !== "-" && cur.created) {
        entries.push(cur);
      }
      cur = {};
    }
  }
  return entries;
}

// lib/deploy.ts
function syncWebAssets(config) {
  if (!existsSync2(config.assetsDir)) {
    mkdirSync(config.assetsDir, { recursive: true });
  }
  writeFileSync(join2(config.assetsDir, "version-picker.js"), VERSION_PICKER_JS);
}
function upload(config, opts) {
  const version = opts.version || readVersion(config.workerDir);
  syncWebAssets(config);
  const args = ["versions", "upload"];
  if (version !== "0.0.0") {
    args.push("--var", `APP_VERSION:${version}`);
  }
  if (opts.pr) {
    const tag = `pr-${opts.pr}`;
    args.push("--tag", tag, "--message", `PR #${opts.pr}`, "--preview-alias", tag);
    console.log(`Uploading PR preview (${tag})...`);
    wrangler(config, args);
    const url2 = workerUrl(config, tag);
    console.log(`
Preview: ${url2}`);
    return url2;
  }
  if (opts.tag) {
    args.push("--tag", opts.tag, "--message", opts.tag, "--preview-alias", opts.tag);
  } else if (version !== "0.0.0") {
    const slug = version.replaceAll(".", "-").toLowerCase();
    args.push("--tag", `v${version}`, "--message", `v${version}`, "--preview-alias", `v${slug}`);
  }
  console.log(`Uploading${version !== "0.0.0" ? ` v${version}` : ""}...`);
  wrangler(config, args);
  const url = opts.tag ? workerUrl(config, opts.tag) : version !== "0.0.0" ? versionAliasUrl(config, version) : "";
  if (url) {
    console.log(`
Preview: ${url}`);
  }
  return url;
}
function promote(config, targetVersion) {
  const versions = fetchWranglerVersions(config);
  let target;
  if (targetVersion) {
    const v = targetVersion.replace(/^v/, "");
    target = versions.find((r) => r.tag === targetVersion || r.tag === `v${v}`);
    if (!target) {
      console.error(`ERROR: Version "${targetVersion}" not found`);
      console.error(`Available: ${versions.map((r) => r.tag).join(", ")}`);
      return process.exit(1);
    }
  } else {
    target = versions.find((v) => /^v\d/.test(v.tag));
    if (!target) {
      console.error("ERROR: No tagged versions found \u2014 upload first");
      return process.exit(1);
    }
  }
  console.log(`Promoting ${target.tag} (${target.versionId}) to 100%...`);
  wrangler(config, ["versions", "deploy", `${target.versionId}@100%`, "--yes"]);
}
function rollback(config) {
  const versions = fetchWranglerVersions(config);
  const tagged = versions.filter((v) => /^v\d/.test(v.tag));
  if (tagged.length < 2) {
    console.error("ERROR: Only one version deployed \u2014 nothing to roll back to");
    return process.exit(1);
  }
  const current = tagged[0];
  const previous = tagged[1];
  console.log(`Rolling back: ${current.tag} \u2192 ${previous.tag}`);
  wrangler(config, ["versions", "deploy", `${previous.versionId}@100%`, "--yes"]);
}

// lib/smoke.ts
async function checkHealth(url, timeoutMs = 1e4) {
  try {
    const res = await fetch(`${url}/api/health`, {
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!res.ok)
      return null;
    const body = await res.json();
    return body.version || null;
  } catch {
    return null;
  }
}
async function checkIndex(url) {
  try {
    const res = await fetch(`${url}/`, { signal: AbortSignal.timeout(1e4) });
    if (!res.ok)
      throw new Error(`HTTP ${res.status}`);
    const body = await res.text();
    console.log(`  index:     OK (HTTP ${res.status}, ${body.length} bytes)`);
  } catch (e) {
    console.error(`  FAIL: index page unreachable (${e.message || e})`);
    process.exit(1);
  }
}
async function smoke(url) {
  console.log(`Smoke testing: ${url}
`);
  const version = await checkHealth(url);
  if (!version) {
    console.error(`  FAIL: /api/health unreachable`);
    process.exit(1);
  }
  console.log(`  health:    OK (v${version})`);
  await checkIndex(url);
  console.log(`
PASS: All checks passed (v${version})`);
}

// lib/versions.ts
import { existsSync as existsSync3, mkdirSync as mkdirSync2, writeFileSync as writeFileSync2 } from "fs";
import { dirname } from "path";
function generateVersionsJson(config, outPath) {
  const output = outPath || `${config.assetsDir}/versions.json`;
  const appVersion = readVersion(config.workerDir);
  const wranglerVersions = fetchWranglerVersions(config);
  const versions = [];
  const previews = [];
  for (const v of wranglerVersions) {
    if (v.tag.startsWith("pr-")) {
      previews.push({
        label: `PR #${v.tag.replace("pr-", "")}`,
        tag: v.tag,
        date: v.created,
        url: workerUrl(config, v.tag)
      });
    } else if (/^v\d/.test(v.tag)) {
      const ver = v.tag.replace("v", "");
      versions.push({
        version: ver,
        tag: v.tag,
        date: v.created,
        url: versionAliasUrl(config, ver)
      });
    }
  }
  const deduped = [
    ...new Map(versions.map((r) => [r.version, r])).values()
  ];
  deduped.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
  if (appVersion !== "0.0.0" && !deduped.find((v) => v.version === appVersion)) {
    deduped.unshift({
      version: appVersion,
      tag: `v${appVersion}`,
      date: new Date().toISOString(),
      url: versionAliasUrl(config, appVersion)
    });
  }
  const out = {
    production: `https://${config.name}.${config.domain}`,
    generated: new Date().toISOString(),
    versions: deduped,
    previews
  };
  const outDir = dirname(output);
  if (!existsSync3(outDir)) {
    mkdirSync2(outDir, { recursive: true });
  }
  writeFileSync2(output, JSON.stringify(out, null, 2) + `
`);
  console.log(`versions.json: ${deduped.length} versions, ${previews.length} PR previews`);
}

// lib/init.ts
import { existsSync as existsSync4, mkdirSync as mkdirSync3, writeFileSync as writeFileSync3 } from "fs";
import { join as join3 } from "path";
function init(name, domain = "workers.dev") {
  const cwd = process.cwd();
  if (existsSync4(join3(cwd, "wrangler.toml"))) {
    console.error("ERROR: wrangler.toml already exists in this directory");
    process.exit(1);
  }
  writeFileSync3(join3(cwd, "wrangler.toml"), `name = "${name}"
main = "src/index.ts"
compatibility_date = "2024-12-01"
workers_dev = true
preview_urls = true

[assets]
directory = "public"

[dev]
port = 8788
`);
  mkdirSync3(join3(cwd, "src"), { recursive: true });
  writeFileSync3(join3(cwd, "src/index.ts"), `import { Hono } from "hono";

type Bindings = { ASSETS: Fetcher; APP_VERSION?: string };

const app = new Hono<{ Bindings: Bindings }>();

app.get("/api/health", (c) =>
  c.json({
    status: "ok",
    version: c.env.APP_VERSION || "dev",
    timestamp: new Date().toISOString(),
  })
);

app.all("*", async (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
`);
  mkdirSync3(join3(cwd, "public"), { recursive: true });
  writeFileSync3(join3(cwd, "public", "version-picker.js"), VERSION_PICKER_JS);
  writeFileSync3(join3(cwd, "public/index.html"), `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${name}</title>
  <link href="https://cdn.jsdelivr.net/npm/daisyui@4/dist/full.min.css" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen bg-base-100 flex items-center justify-center">
  <div class="text-center space-y-6 p-8">
    <h1 class="text-4xl font-bold">${name}</h1>
    <div class="stats shadow">
      <div class="stat">
        <div class="stat-title">Health</div>
        <div class="stat-value text-success" id="health-status">...</div>
        <div class="stat-desc" id="health-version"></div>
      </div>
    </div>
    <div class="flex justify-center">
      <cf-version-picker></cf-version-picker>
    </div>
  </div>
  <script type="module" src="/version-picker.js"></script>
  <script>
    fetch('/api/health')
      .then(r => r.json())
      .then(d => {
        document.getElementById('health-status').textContent = d.status;
        document.getElementById('health-version').textContent = 'v' + d.version;
      })
      .catch(() => {
        document.getElementById('health-status').textContent = 'offline';
        document.getElementById('health-status').classList.replace('text-success', 'text-error');
      });
  </script>
</body>
</html>
`);
  if (!existsSync4(join3(cwd, "package.json"))) {
    writeFileSync3(join3(cwd, "package.json"), JSON.stringify({
      name,
      version: "1.0.0",
      private: true,
      dependencies: { hono: "^4" },
      devDependencies: { wrangler: "^4" }
    }, null, 2) + `
`);
  }
  console.log(`Initialized cf-deploy project: ${name}`);
  console.log(`
Next steps:`);
  console.log(`  bun install`);
  console.log(`  bun x wrangler dev           # local dev at http://localhost:8788`);
  console.log(`  cf-deploy upload`);
  console.log(`  cf-deploy smoke https://${name}.${domain}`);
  console.log(`  cf-deploy promote`);
}
// package.json
var package_default = {
  name: "cf-deploy",
  version: "0.1.0",
  description: "Reusable Cloudflare Workers deploy toolkit \u2014 CLI + versions manifest + version picker web component",
  type: "module",
  bin: {
    "cf-deploy": "./dist/cf-deploy.js"
  },
  files: [
    "dist/",
    "web/"
  ],
  scripts: {
    build: "mkdir -p dist && bun build ./bin/cf-deploy.ts --outfile dist/cf-deploy.js --target bun --bundle",
    typecheck: "bun x tsc --noEmit",
    test: "bun test tests/unit tests/integration",
    "test:e2e": "bun x playwright install --with-deps chromium && bun x playwright test",
    check: "bun run typecheck && bun run test",
    "ci:build": "bun install && bun run build && for d in example examples/from-scratch examples/existing-worker; do (cd $d && bun install); done",
    "ci:deploy": ": ${PROD_URL:?PROD_URL required} && CF=../dist/cf-deploy.js && cd example && bun $CF versions-json && bun $CF upload && bun $CF smoke $PROD_URL && bun $CF promote",
    "ci:e2e": "TARGET_URL=${PROD_URL:?PROD_URL required} bun run test:e2e",
    "ci:full": "bun run check && bun run ci:build && bun run ci:deploy && bun run ci:e2e",
    prepare: "[ -d .git ] && bun run build && git config core.hooksPath .githooks || true"
  },
  license: "MIT",
  devDependencies: {
    "@playwright/test": "^1.58.2",
    "@types/bun": "^1.3.9",
    wrangler: "^4.68.0"
  }
};

// bin/cf-deploy.ts
var args = process.argv.slice(2);
function getFlag(name) {
  const idx = args.indexOf(name);
  if (idx === -1)
    return;
  const val = args[idx + 1];
  if (val === undefined || val.startsWith("--"))
    return;
  return val;
}
if (args.length === 1 && (args[0] === "--version" || args[0] === "-v" || args[0] === "version")) {
  console.log(package_default.version);
  process.exit(0);
}
var command = args[0];
if (!command || command === "--help" || command === "-h") {
  console.log(`cf-deploy \u2014 Cloudflare Workers deploy toolkit

Commands:
  upload [--version X] [--tag T] [--pr N]   Upload a new version
  promote [--version X]                      Promote to 100% traffic
  rollback                                   Revert to previous version
  smoke <URL>                                Health + index check
  versions-json [--out PATH]                 Generate versions manifest
  init --name N [--domain D]                 Scaffold a new project

Options:
  --dir PATH       Worker directory (default: .)
  --name NAME      Override worker name
  --domain DOMAIN  Override domain (default: workers.dev)`);
  process.exit(0);
}
if (command === "init") {
  const name = getFlag("--name");
  if (!name) {
    console.error("Usage: cf-deploy init --name my-worker [--domain example.workers.dev]");
    process.exit(1);
  }
  init(name, getFlag("--domain"));
  process.exit(0);
}
var config = loadConfig({
  dir: getFlag("--dir"),
  name: getFlag("--name"),
  domain: getFlag("--domain")
});
var positionalArg = args.slice(1).find((a) => !a.startsWith("-"));
switch (command) {
  case "upload":
    upload(config, {
      version: getFlag("--version"),
      tag: getFlag("--tag"),
      pr: getFlag("--pr")
    });
    break;
  case "promote":
    promote(config, getFlag("--version"));
    break;
  case "rollback":
    rollback(config);
    break;
  case "smoke":
    if (!positionalArg) {
      console.error("Usage: cf-deploy smoke <URL>");
      process.exit(1);
    }
    await smoke(positionalArg);
    break;
  case "versions-json":
    generateVersionsJson(config, getFlag("--out"));
    break;
  default:
    console.error(`Unknown command: ${command}
Run 'cf-deploy --help' for usage.`);
    process.exit(1);
}
