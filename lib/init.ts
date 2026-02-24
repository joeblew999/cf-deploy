/**
 * Scaffold a new cf-deploy project.
 * Creates wrangler.toml, src/index.ts, public/index.html, and version picker.
 */
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { VERSION_PICKER_JS } from "./wrangler.ts";

export function init(name: string, domain = "workers.dev") {
  const cwd = process.cwd();

  if (existsSync(join(cwd, "wrangler.toml"))) {
    console.error("ERROR: wrangler.toml already exists in this directory");
    process.exit(1);
  }

  // wrangler.toml
  writeFileSync(
    join(cwd, "wrangler.toml"),
    `name = "${name}"
main = "src/index.ts"
compatibility_date = "2024-12-01"
workers_dev = true
preview_urls = true

[assets]
directory = "public"

[dev]
port = 8788
`,
  );

  // src/index.ts
  mkdirSync(join(cwd, "src"), { recursive: true });
  writeFileSync(
    join(cwd, "src/index.ts"),
    `import { Hono } from "hono";

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
`,
  );

  // public/
  mkdirSync(join(cwd, "public"), { recursive: true });
  writeFileSync(
    join(cwd, "public", "version-picker.js"),
    VERSION_PICKER_JS,
  );

  // index.html
  writeFileSync(
    join(cwd, "public/index.html"),
    `<!DOCTYPE html>
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
`,
  );

  // package.json
  if (!existsSync(join(cwd, "package.json"))) {
    writeFileSync(
      join(cwd, "package.json"),
      JSON.stringify(
        {
          name,
          version: "1.0.0",
          private: true,
          dependencies: { hono: "^4" },
          devDependencies: { wrangler: "^4" },
        },
        null,
        2,
      ) + "\n",
    );
  }

  console.log(`Initialized cf-deploy project: ${name}`);
  console.log(`\nNext steps:`);
  console.log(`  bun install`);
  console.log(`  bun x wrangler dev           # local dev at http://localhost:8788`);
  console.log(`  cf-deploy upload`);
  console.log(`  cf-deploy smoke https://${name}.${domain}`);
  console.log(`  cf-deploy promote`);
}
