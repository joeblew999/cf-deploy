import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "fs";
import { join, resolve } from "path";
import { loadConfig, readVersion } from "../../lib/config.ts";
import { syncWebAssets } from "../../lib/deploy.ts";

const ROOT = resolve(import.meta.dir, "../..");
const DIST = join(ROOT, "dist", "cf-deploy.js");
const CF_ARGS = ["bun", DIST];

// Source example dirs (never modified — tests work on copies)
const EXAMPLE_SRC = join(ROOT, "example");
const FROM_SCRATCH_SRC = join(ROOT, "examples", "from-scratch");
const EXISTING_WORKER_SRC = join(ROOT, "examples", "existing-worker");

// Working copies in /tmp (deleted after)
const TMP = join("/tmp", "cf-deploy-integration-test");
const EXAMPLE = join(TMP, "example");
const FROM_SCRATCH = join(TMP, "from-scratch");
const EXISTING_WORKER = join(TMP, "existing-worker");
const INIT_DIR = join(TMP, "init-test");

/**
 * Run a shell command via Bun.spawn, return stdout as string.
 * Uses Bun.spawn instead of execSync to avoid bun test runner + execSync deadlock.
 */
async function run(cmd: string, cwd = ROOT): Promise<string> {
  const proc = Bun.spawn(["sh", "-c", cmd], {
    cwd,
    stdin: null,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  if (exitCode !== 0) {
    throw new Error(`Command failed (exit ${exitCode}): ${cmd}\n${stderr}\n${stdout}`);
  }
  return stdout + stderr;
}

/** Wait for a URL to respond with 200, retrying up to maxRetries times. */
async function waitForWorker(url: string, maxRetries = 10): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`Worker at ${url} not reachable after ${maxRetries} retries`);
}

/** Copy an example dir to /tmp working location, install deps if needed. */
async function copyExample(src: string, dest: string) {
  cpSync(src, dest, { recursive: true });
  // If node_modules wasn't copied (e.g. CI fresh clone), install deps
  if (!existsSync(join(dest, "node_modules"))) {
    await run("bun install", dest);
  }
}

/** Detect wrangler auth — checks API token env OR wrangler OAuth login. */
function hasWranglerAuth(): boolean {
  if (process.env.CLOUDFLARE_API_TOKEN) return true;
  try {
    const { execSync } = require("child_process");
    const out = execSync("bun x wrangler whoami", {
      encoding: "utf8",
      stdio: "pipe",
      timeout: 10_000,
    });
    return out.includes("You are logged in");
  } catch {
    return false;
  }
}

const HAS_AUTH = hasWranglerAuth();
const PROD_URL =
  process.env.PROD_URL || "https://cf-deploy-example.gedw99.workers.dev";

// Full teardown → setup: clean everything, build fresh, copy examples
beforeAll(async () => {
  rmSync(join(ROOT, "dist"), { recursive: true, force: true });
  rmSync(TMP, { recursive: true, force: true });

  await run("bun run build");

  mkdirSync(TMP, { recursive: true });
  await copyExample(EXAMPLE_SRC, EXAMPLE);
  await copyExample(FROM_SCRATCH_SRC, FROM_SCRATCH);
  await copyExample(EXISTING_WORKER_SRC, EXISTING_WORKER);
}, 60_000);

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

// --- Bundle sanity ---

describe("built bundle", () => {
  test("dist/cf-deploy.js exists", () => {
    expect(existsSync(DIST)).toBe(true);
  });

  test("--help prints all commands", async () => {
    const out = await run(`${CF_ARGS.join(" ")} --help`);
    for (const cmd of [
      "upload",
      "promote",
      "rollback",
      "smoke",
      "versions-json",
      "init",
    ]) {
      expect(out).toContain(cmd);
    }
  });

  test("--version prints version", async () => {
    const out = await run(`${CF_ARGS.join(" ")} --version`);
    expect(out.trim()).toMatch(/\d+\.\d+\.\d+/);
  });
});

// =============================================================================
// Init command — scaffolds a new project
// =============================================================================

const CF = CF_ARGS.join(" ");

describe("init command", () => {
  beforeAll(async () => {
    rmSync(INIT_DIR, { recursive: true, force: true });
    mkdirSync(INIT_DIR, { recursive: true });
    await run(`${CF} init --name test-init --domain workers.dev`, INIT_DIR);
  });

  test("scaffolds wrangler.toml, package.json, src, public", () => {
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
// example/ — live deployed project (Hono + DaisyUI)
// Full deploy cycle: versions-json → upload → smoke → promote → verify
// =============================================================================

describe("example/ (live deployed project)", () => {
  test("syncWebAssets generates version-picker.js", () => {
    const cfg = loadConfig({ dir: EXAMPLE });
    syncWebAssets(cfg);
    const vp = readFileSync(
      join(EXAMPLE, "public", "version-picker.js"),
      "utf8",
    );
    expect(vp.startsWith("// AUTO-GENERATED")).toBe(true);
  });

  test("wrangler validates the project (dry-run)", async () => {
    await run(
      `bun x wrangler deploy --dry-run --outdir "${join(TMP, "dry-example")}"`,
      EXAMPLE,
    );
  }, 30_000);

  test.skipIf(!HAS_AUTH)("cf-deploy versions-json", async () => {
    await run(`${CF} versions-json --dir "${EXAMPLE}"`);
    const manifest = JSON.parse(
      readFileSync(join(EXAMPLE, "public", "versions.json"), "utf8"),
    );
    expect(manifest.production).toBeTruthy();
    expect(manifest.generated).toBeTruthy();
    expect(Array.isArray(manifest.versions)).toBe(true);
    expect(manifest.versions.length).toBeGreaterThan(0);
  }, 30_000);

  test.skipIf(!HAS_AUTH)("cf-deploy upload", async () => {
    const out = await run(`${CF} upload --dir "${EXAMPLE}"`);
    expect(out).toContain("Uploading");
  }, 120_000);

  test.skipIf(!HAS_AUTH)("cf-deploy smoke", async () => {
    const out = await run(`${CF} smoke ${PROD_URL}`);
    expect(out).toContain("PASS");
  }, 30_000);

  test.skipIf(!HAS_AUTH)("cf-deploy promote", async () => {
    await run(`${CF} promote --dir "${EXAMPLE}"`);
  }, 120_000);

  test.skipIf(!HAS_AUTH)("/api/health returns ok with correct version", async () => {
    const expectedVersion = readVersion(EXAMPLE);
    const res = await fetch(`${PROD_URL}/api/health`);
    expect(res.ok).toBe(true);
    const body = (await res.json()) as { status: string; version: string };
    expect(body.status).toBe("ok");
    expect(body.version).toBe(expectedVersion);
  });

  test.skipIf(!HAS_AUTH)("/versions.json has current version", async () => {
    const expectedVersion = readVersion(EXAMPLE);
    const res = await fetch(`${PROD_URL}/versions.json`);
    expect(res.ok).toBe(true);
    const data = (await res.json()) as {
      production: string;
      versions: { tag: string }[];
    };
    expect(data.production).toBeTruthy();
    expect(data.versions.length).toBeGreaterThan(0);
    // The version we just deployed should be in the manifest
    const tags = data.versions.map((v) => v.tag);
    expect(tags).toContain(`v${expectedVersion}`);
  });
});

// =============================================================================
// examples/from-scratch/ — new project (Hono)
// Deploy → smoke → verify → delete (cleanup)
// =============================================================================

describe("examples/from-scratch/ (new project)", () => {
  const WORKER_URL = "https://my-new-worker.gedw99.workers.dev";

  afterAll(() => {
    // Cleanup: fire-and-forget delete (bun hook timeout is 5s, wrangler delete takes longer)
    if (HAS_AUTH) {
      Bun.spawn(["bun", "x", "wrangler", "delete", "--name", "my-new-worker", "--force"], {
        cwd: FROM_SCRATCH,
        stdin: null, stdout: "ignore", stderr: "ignore",
      });
    }
  });

  test("syncWebAssets generates version-picker.js", () => {
    const cfg = loadConfig({ dir: FROM_SCRATCH });
    syncWebAssets(cfg);
    const vp = readFileSync(
      join(FROM_SCRATCH, "public", "version-picker.js"),
      "utf8",
    );
    expect(vp.startsWith("// AUTO-GENERATED")).toBe(true);
  });

  test("wrangler validates the project (dry-run)", async () => {
    await run(
      `bun x wrangler deploy --dry-run --outdir "${join(TMP, "dry-from-scratch")}"`,
      FROM_SCRATCH,
    );
  }, 30_000);

  // Initial wrangler deploy establishes the workers.dev route (required for new workers).
  // After this, cf-deploy's versions upload/deploy flow works.
  test.skipIf(!HAS_AUTH)("initial wrangler deploy (establishes route)", async () => {
    await run(`bun x wrangler deploy`, FROM_SCRATCH);
    await waitForWorker(`${WORKER_URL}/api/health`);
  }, 90_000);

  test.skipIf(!HAS_AUTH)("cf-deploy upload", async () => {
    const out = await run(`${CF} upload --dir "${FROM_SCRATCH}"`);
    expect(out).toContain("Uploading");
  }, 120_000);

  test.skipIf(!HAS_AUTH)("cf-deploy promote", async () => {
    await run(`${CF} promote --dir "${FROM_SCRATCH}"`);
  }, 120_000);

  test.skipIf(!HAS_AUTH)("cf-deploy smoke", async () => {
    await waitForWorker(`${WORKER_URL}/api/health`);
    const out = await run(`${CF} smoke ${WORKER_URL}`);
    expect(out).toContain("PASS");
  }, 60_000);

  test.skipIf(!HAS_AUTH)("/api/health returns correct version", async () => {
    const expectedVersion = readVersion(FROM_SCRATCH);
    const res = await fetch(`${WORKER_URL}/api/health`);
    expect(res.ok).toBe(true);
    const body = (await res.json()) as { status: string; version: string };
    expect(body.status).toBe("ok");
    expect(body.version).toBe(expectedVersion);
  });
});

// =============================================================================
// examples/existing-worker/ — existing project (plain fetch, no framework)
// Deploy → smoke → verify → delete (cleanup)
// =============================================================================

describe("examples/existing-worker/ (existing project, no framework)", () => {
  const WORKER_URL = "https://my-existing-app.gedw99.workers.dev";

  afterAll(() => {
    // Cleanup: fire-and-forget delete (bun hook timeout is 5s, wrangler delete takes longer)
    if (HAS_AUTH) {
      Bun.spawn(["bun", "x", "wrangler", "delete", "--name", "my-existing-app", "--force"], {
        cwd: EXISTING_WORKER,
        stdin: null, stdout: "ignore", stderr: "ignore",
      });
    }
  });

  test("syncWebAssets generates version-picker.js", () => {
    const cfg = loadConfig({ dir: EXISTING_WORKER });
    syncWebAssets(cfg);
    const vp = readFileSync(
      join(EXISTING_WORKER, "public", "version-picker.js"),
      "utf8",
    );
    expect(vp.startsWith("// AUTO-GENERATED")).toBe(true);
  });

  test("uses plain fetch handler (no framework)", () => {
    const src = readFileSync(
      join(EXISTING_WORKER, "src", "index.ts"),
      "utf8",
    );
    expect(src).toContain("APP_VERSION");
    expect(src).not.toContain("Hono");
  });

  test("wrangler validates the project (dry-run)", async () => {
    await run(
      `bun x wrangler deploy --dry-run --outdir "${join(TMP, "dry-existing")}"`,
      EXISTING_WORKER,
    );
  }, 30_000);

  test.skipIf(!HAS_AUTH)("initial wrangler deploy (establishes route)", async () => {
    await run(`bun x wrangler deploy`, EXISTING_WORKER);
    await waitForWorker(`${WORKER_URL}/api/health`);
  }, 90_000);

  test.skipIf(!HAS_AUTH)("cf-deploy upload", async () => {
    const out = await run(`${CF} upload --dir "${EXISTING_WORKER}"`);
    expect(out).toContain("Uploading");
  }, 120_000);

  test.skipIf(!HAS_AUTH)("cf-deploy promote", async () => {
    await run(`${CF} promote --dir "${EXISTING_WORKER}"`);
  }, 120_000);

  test.skipIf(!HAS_AUTH)("cf-deploy smoke", async () => {
    await waitForWorker(`${WORKER_URL}/api/health`);
    const out = await run(`${CF} smoke ${WORKER_URL}`);
    expect(out).toContain("PASS");
  }, 60_000);

  test.skipIf(!HAS_AUTH)("/api/health returns correct version", async () => {
    const expectedVersion = readVersion(EXISTING_WORKER);
    const res = await fetch(`${WORKER_URL}/api/health`);
    expect(res.ok).toBe(true);
    const body = (await res.json()) as { status: string; version: string };
    expect(body.status).toBe("ok");
    expect(body.version).toBe(expectedVersion);
  });
});
