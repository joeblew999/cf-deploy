import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { execSync } from "child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "fs";
import { join, resolve } from "path";
import { loadConfig, readVersion } from "../../lib/config.ts";
import { syncWebAssets } from "../../lib/deploy.ts";

const ROOT = resolve(import.meta.dir, "../..");
const DIST = join(ROOT, "dist", "cf-deploy.js");
const CF = `bun ${DIST}`;

// Source example dirs (never modified — tests work on copies)
const EXAMPLE_SRC = join(ROOT, "example");
const FROM_SCRATCH_SRC = join(ROOT, "examples", "from-scratch");
const EXISTING_WORKER_SRC = join(ROOT, "examples", "existing-worker");

// Working copies in /tmp (tests run against these, deleted after)
// Using /tmp avoids bun workspace resolution issues
const TMP = join("/tmp", "cf-deploy-integration-test");
const EXAMPLE = join(TMP, "example");
const FROM_SCRATCH = join(TMP, "from-scratch");
const EXISTING_WORKER = join(TMP, "existing-worker");
const INIT_DIR = join(TMP, "init-test");

const run = (cmd: string, cwd = ROOT) =>
  execSync(cmd, { cwd, encoding: "utf8", stdio: "pipe" });

/** Copy an example dir to /tmp working location, install deps. */
function copyExample(src: string, dest: string) {
  cpSync(src, dest, {
    recursive: true,
    filter: (s) => !s.includes("node_modules"),
  });
  run("bun install", dest);
}

// Full teardown → setup: clean everything, build fresh, copy examples
beforeAll(() => {
  // Teardown
  rmSync(join(ROOT, "dist"), { recursive: true, force: true });
  rmSync(TMP, { recursive: true, force: true });

  // Build
  run("bun run build");

  // Copy all 3 examples to working dirs
  mkdirSync(TMP, { recursive: true });
  copyExample(EXAMPLE_SRC, EXAMPLE);
  copyExample(FROM_SCRATCH_SRC, FROM_SCRATCH);
  copyExample(EXISTING_WORKER_SRC, EXISTING_WORKER);
});

// Delete all working copies
afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

// --- Bundle sanity ---

describe("built bundle", () => {
  test("dist/cf-deploy.js exists", () => {
    expect(existsSync(DIST)).toBe(true);
  });

  test("--help prints usage", () => {
    const out = run(`${CF} --help`);
    expect(out).toContain("upload");
    expect(out).toContain("promote");
    expect(out).toContain("smoke");
  });

  test("--version prints version", () => {
    const out = run(`${CF} --version`);
    expect(out.trim()).toMatch(/\d+\.\d+\.\d+/);
  });
});

// =============================================================================
// Example 1: example/ — the live deployed project
// =============================================================================

describe("example/ (live deployed project)", () => {
  beforeAll(() => {
    const cfg = loadConfig({ dir: EXAMPLE });
    syncWebAssets(cfg);
  });

  test("loadConfig reads wrangler.toml", () => {
    const cfg = loadConfig({ dir: EXAMPLE });
    expect(cfg.name).toBe("cf-deploy-example");
    expect(cfg.assetsDir).toEndWith("/public");
  });

  test("readVersion reads package.json", () => {
    expect(readVersion(EXAMPLE)).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("index.ts uses env.APP_VERSION", () => {
    const src = readFileSync(join(EXAMPLE, "src", "index.ts"), "utf8");
    expect(src).toContain("APP_VERSION");
  });

  test("version-picker.js has provenance header", () => {
    const content = readFileSync(
      join(EXAMPLE, "public", "version-picker.js"),
      "utf8",
    );
    expect(content.startsWith("// AUTO-GENERATED")).toBe(true);
  });

  test("index.html has version-picker element", () => {
    const html = readFileSync(join(EXAMPLE, "public", "index.html"), "utf8");
    expect(html).toContain("<cf-version-picker");
  });

  test("wrangler validates the project (dry-run)", () => {
    run("bun x wrangler deploy --dry-run --outdir /tmp/wrangler-dry-example", EXAMPLE);
  }, 30_000);

  test("versions-json command parses args correctly", () => {
    try {
      run(`${CF} versions-json --dir "${EXAMPLE}" --out "/dev/null"`, ROOT);
    } catch (e: any) {
      const msg = e.stderr?.toString() || e.message || "";
      expect(msg).not.toContain("Unknown command");
      expect(msg).not.toContain("Usage:");
    }
  }, 15_000);
});

// =============================================================================
// Example 2: examples/from-scratch/ — new project (README: "Starting from Scratch")
// Hono-based worker, same as what `cf-deploy init` scaffolds
// =============================================================================

describe("examples/from-scratch/ (new project)", () => {
  beforeAll(() => {
    const cfg = loadConfig({ dir: FROM_SCRATCH });
    syncWebAssets(cfg);
  });

  test("has all required files", () => {
    for (const f of [
      "wrangler.toml",
      "package.json",
      "src/index.ts",
      "public/index.html",
    ]) {
      expect(existsSync(join(FROM_SCRATCH, f))).toBe(true);
    }
  });

  test("loadConfig reads project", () => {
    const cfg = loadConfig({ dir: FROM_SCRATCH });
    expect(cfg.name).toBe("my-new-worker");
    expect(cfg.assetsDir).toEndWith("/public");
  });

  test("readVersion reads package.json", () => {
    expect(readVersion(FROM_SCRATCH)).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("index.ts uses env.APP_VERSION", () => {
    const src = readFileSync(join(FROM_SCRATCH, "src", "index.ts"), "utf8");
    expect(src).toContain("APP_VERSION");
  });

  test("version-picker.js is generated by syncWebAssets", () => {
    const content = readFileSync(
      join(FROM_SCRATCH, "public", "version-picker.js"),
      "utf8",
    );
    expect(content.startsWith("// AUTO-GENERATED")).toBe(true);
  });

  test("index.html has version-picker element", () => {
    const html = readFileSync(
      join(FROM_SCRATCH, "public", "index.html"),
      "utf8",
    );
    expect(html).toContain("<cf-version-picker");
  });

  test("wrangler validates the project (dry-run)", () => {
    run(
      "bun x wrangler deploy --dry-run --outdir /tmp/wrangler-dry-from-scratch",
      FROM_SCRATCH,
    );
  }, 30_000);
});

// =============================================================================
// Example 3: examples/existing-worker/ — existing project (README: "Adding to an Existing Project")
// Plain fetch handler, no Hono — proves cf-deploy works with any worker
// =============================================================================

describe("examples/existing-worker/ (existing project, no framework)", () => {
  beforeAll(() => {
    const cfg = loadConfig({ dir: EXISTING_WORKER });
    syncWebAssets(cfg);
  });

  test("has all required files", () => {
    for (const f of [
      "wrangler.toml",
      "package.json",
      "src/index.ts",
      "public/index.html",
    ]) {
      expect(existsSync(join(EXISTING_WORKER, f))).toBe(true);
    }
  });

  test("loadConfig reads project", () => {
    const cfg = loadConfig({ dir: EXISTING_WORKER });
    expect(cfg.name).toBe("my-existing-app");
    expect(cfg.assetsDir).toEndWith("/public");
  });

  test("readVersion reads package.json", () => {
    expect(readVersion(EXISTING_WORKER)).toBe("3.2.1");
  });

  test("index.ts uses env.APP_VERSION (no framework required)", () => {
    const src = readFileSync(
      join(EXISTING_WORKER, "src", "index.ts"),
      "utf8",
    );
    expect(src).toContain("APP_VERSION");
    expect(src).not.toContain("Hono");
  });

  test("version-picker.js is generated by syncWebAssets", () => {
    const content = readFileSync(
      join(EXISTING_WORKER, "public", "version-picker.js"),
      "utf8",
    );
    expect(content.startsWith("// AUTO-GENERATED")).toBe(true);
  });

  test("wrangler validates the project (dry-run)", () => {
    run(
      "bun x wrangler deploy --dry-run --outdir /tmp/wrangler-dry-existing",
      EXISTING_WORKER,
    );
  }, 30_000);
});

// =============================================================================
// Init command — verifies cf-deploy init scaffolds correctly
// =============================================================================

describe("init command", () => {
  beforeAll(() => {
    rmSync(INIT_DIR, { recursive: true, force: true });
    mkdirSync(INIT_DIR, { recursive: true });
    run(`${CF} init --name test-init --domain workers.dev`, INIT_DIR);
  });

  test("scaffolds all expected files", () => {
    for (const f of [
      "wrangler.toml",
      "package.json",
      "src/index.ts",
      "public/index.html",
      "public/version-picker.js",
    ]) {
      expect(existsSync(join(INIT_DIR, f))).toBe(true);
    }
  });

  test("no cf-deploy.yml generated", () => {
    expect(existsSync(join(INIT_DIR, "cf-deploy.yml"))).toBe(false);
  });

  test("wrangler.toml has correct name", () => {
    const toml = readFileSync(join(INIT_DIR, "wrangler.toml"), "utf8");
    expect(toml).toContain('name = "test-init"');
  });

  test("loadConfig reads scaffolded project", () => {
    const cfg = loadConfig({ dir: INIT_DIR });
    expect(cfg.name).toBe("test-init");
    expect(cfg.assetsDir).toEndWith("/public");
  });
});

// =============================================================================
// Full deploy workflow (requires CLOUDFLARE_API_TOKEN)
// =============================================================================

const HAS_AUTH = !!process.env.CLOUDFLARE_API_TOKEN;
const PROD_URL =
  process.env.PROD_URL || "https://cf-deploy-example.gedw99.workers.dev";

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
