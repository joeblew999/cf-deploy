import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { execSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "fs";
import { join, resolve } from "path";
import { loadConfig, readVersion } from "../../lib/config.ts";
import { syncWebAssets } from "../../lib/deploy.ts";

const ROOT = resolve(import.meta.dir, "../..");
const DIST = join(ROOT, "dist", "cf-deploy.js");
const EXAMPLE = join(ROOT, "example");
const TMP = join(import.meta.dir, ".tmp-integration-test");
const run = (cmd: string, cwd = ROOT) =>
  execSync(cmd, { cwd, encoding: "utf8", stdio: "pipe" });

// Full teardown → setup: remove stale artifacts, then build fresh
beforeAll(() => {
  rmSync(join(ROOT, "dist"), { recursive: true, force: true });
  rmSync(join(EXAMPLE, "public", "version-picker.js"), { force: true });
  rmSync(join(EXAMPLE, "public", "versions.json"), { force: true });
  run("bun run build");
});

// Clean up generated artifacts
afterAll(() => {
  rmSync(join(EXAMPLE, "public", "version-picker.js"), { force: true });
  rmSync(join(EXAMPLE, "public", "versions.json"), { force: true });
});

// --- Bundle sanity ---

describe("built bundle", () => {
  test("dist/cf-deploy.js exists", () => {
    expect(existsSync(DIST)).toBe(true);
  });

  test("--help prints usage", () => {
    const out = run(`bun ${DIST} --help`);
    expect(out).toContain("upload");
    expect(out).toContain("promote");
    expect(out).toContain("smoke");
  });

  test("--version prints version", () => {
    const out = run(`bun ${DIST} --version`);
    expect(out.trim()).toMatch(/\d+\.\d+\.\d+/);
  });
});

// --- Init scaffolding ---
// init writes into cwd (no subdirectory), so we create TMP first and run init there.

describe("init command", () => {
  beforeAll(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
    run(`bun ${DIST} init --name test-worker --domain workers.dev`, TMP);
  });

  afterAll(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  test("scaffolds all expected files", () => {
    for (const f of [
      "wrangler.toml",
      "package.json",
      "src/index.ts",
      "public/index.html",
      "public/version-picker.js",
    ]) {
      expect(existsSync(join(TMP, f))).toBe(true);
    }
  });

  test("no cf-deploy.yml generated (v2 convention)", () => {
    expect(existsSync(join(TMP, "cf-deploy.yml"))).toBe(false);
  });

  test("wrangler.toml has correct name", () => {
    const toml = readFileSync(join(TMP, "wrangler.toml"), "utf8");
    expect(toml).toContain('name = "test-worker"');
  });

  test("index.ts uses env.APP_VERSION (not hardcoded)", () => {
    const src = readFileSync(join(TMP, "src", "index.ts"), "utf8");
    expect(src).toContain("APP_VERSION");
    expect(src).not.toMatch(/"1\.0\.0"/);
  });

  test("version-picker.js has provenance header", () => {
    const vp = readFileSync(
      join(TMP, "public", "version-picker.js"),
      "utf8",
    );
    expect(vp.startsWith("// AUTO-GENERATED")).toBe(true);
  });

  test("loadConfig reads scaffolded project correctly", () => {
    const cfg = loadConfig({ dir: TMP });
    expect(cfg.name).toBe("test-worker");
    expect(cfg.assetsDir).toEndWith("/public");
  });
});

// --- Example project validation ---

describe("example project", () => {
  // Dogfood: use cf-deploy's own syncWebAssets to generate version-picker.js
  // (the file is gitignored — this is idempotent and mirrors what `upload` does)
  beforeAll(() => {
    const cfg = loadConfig({ dir: EXAMPLE });
    syncWebAssets(cfg);
  });

  test("loadConfig reads example/wrangler.toml correctly", () => {
    const cfg = loadConfig({ dir: EXAMPLE });
    expect(cfg.name).toBe("cf-deploy-example");
    expect(cfg.assetsDir).toEndWith("/public");
  });

  test("readVersion reads example/package.json", () => {
    const v = readVersion(EXAMPLE);
    expect(v).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("example has no cf-deploy.yml", () => {
    expect(existsSync(join(EXAMPLE, "cf-deploy.yml"))).toBe(false);
  });

  test("example index.ts uses env.APP_VERSION", () => {
    const src = readFileSync(join(EXAMPLE, "src", "index.ts"), "utf8");
    expect(src).toContain("APP_VERSION");
  });

  test("example public/ has version-picker.js with provenance header", () => {
    const path = join(EXAMPLE, "public", "version-picker.js");
    expect(existsSync(path)).toBe(true);
    const content = readFileSync(path, "utf8");
    expect(content.startsWith("// AUTO-GENERATED")).toBe(true);
  });

  test("example public/ has index.html with version-picker element", () => {
    const html = readFileSync(join(EXAMPLE, "public", "index.html"), "utf8");
    expect(html).toContain("<cf-version-picker");
  });

  test("versions-json command parses args correctly", () => {
    // versions-json calls wrangler (needs auth) — we just verify it doesn't
    // crash on arg parsing by catching the wrangler auth error
    try {
      run(
        `bun ${DIST} versions-json --dir "${EXAMPLE}" --out "/dev/null"`,
        ROOT,
      );
    } catch (e: any) {
      // Expected: wrangler auth error, NOT a cf-deploy arg parsing error
      const msg = e.stderr?.toString() || e.message || "";
      expect(msg).not.toContain("Unknown command");
      expect(msg).not.toContain("Usage:");
    }
  });
});

// --- Full deploy workflow (requires CLOUDFLARE_API_TOKEN) ---

const HAS_AUTH = !!process.env.CLOUDFLARE_API_TOKEN;
const PROD_URL = process.env.PROD_URL || "https://cf-deploy-example.gedw99.workers.dev";
const CF = `bun ${DIST}`;

describe.skipIf(!HAS_AUTH)("deploy workflow (live)", () => {
  test("versions-json generates manifest", () => {
    run(`${CF} versions-json --dir "${EXAMPLE}"`, ROOT);
    const manifest = JSON.parse(
      readFileSync(join(EXAMPLE, "public", "versions.json"), "utf8"),
    );
    expect(manifest.production).toBeTruthy();
    expect(manifest.generated).toBeTruthy();
    expect(Array.isArray(manifest.versions)).toBe(true);
    expect(manifest.versions.length).toBeGreaterThan(0);
  }, 30_000);

  test("upload creates a new version", () => {
    const out = run(`${CF} upload --dir "${EXAMPLE}"`, ROOT);
    expect(out).toContain("Uploading");
  }, 60_000);

  test("smoke passes against production", () => {
    const out = run(`${CF} smoke ${PROD_URL}`, ROOT);
    expect(out).toContain("PASS");
  }, 30_000);

  test("promote sends latest version to 100%", () => {
    run(`${CF} promote --dir "${EXAMPLE}"`, ROOT);
  }, 60_000);

  test("production /api/health returns ok after promote", async () => {
    const res = await fetch(`${PROD_URL}/api/health`);
    expect(res.ok).toBe(true);
    const body = (await res.json()) as { status: string; version: string };
    expect(body.status).toBe("ok");
    expect(body.version).toBeTruthy();
  });

  test("production /versions.json is valid after deploy", async () => {
    const res = await fetch(`${PROD_URL}/versions.json`);
    expect(res.ok).toBe(true);
    const data = (await res.json()) as {
      production: string;
      versions: unknown[];
    };
    expect(data.production).toBeTruthy();
    expect(data.versions.length).toBeGreaterThan(0);
  });
});
