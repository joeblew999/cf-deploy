import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { loadConfig, readVersion } from "../../lib/config.ts";

const TMP = join(import.meta.dir, ".tmp-config-test");

beforeEach(() => {
  mkdirSync(TMP, { recursive: true });
  // Clear env overrides
  delete process.env.APP_VERSION;
  delete process.env.CF_DEPLOY_NAME;
  delete process.env.CF_DEPLOY_DOMAIN;
  delete process.env.CF_DEPLOY_DIR;
});

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

// --- readVersion ---

describe("readVersion", () => {
  test("reads version from package.json", () => {
    writeFileSync(
      join(TMP, "package.json"),
      JSON.stringify({ version: "2.5.0" }),
    );
    expect(readVersion(TMP)).toBe("2.5.0");
  });

  test("returns 0.0.0 if no package.json", () => {
    expect(readVersion(TMP)).toBe("0.0.0");
  });

  test("returns 0.0.0 if package.json has no version field", () => {
    writeFileSync(join(TMP, "package.json"), JSON.stringify({ name: "foo" }));
    expect(readVersion(TMP)).toBe("0.0.0");
  });

  test("returns 0.0.0 if package.json is invalid JSON", () => {
    writeFileSync(join(TMP, "package.json"), "not json{{{");
    expect(readVersion(TMP)).toBe("0.0.0");
  });

  test("APP_VERSION env overrides package.json", () => {
    writeFileSync(
      join(TMP, "package.json"),
      JSON.stringify({ version: "1.0.0" }),
    );
    process.env.APP_VERSION = "override-version";
    expect(readVersion(TMP)).toBe("override-version");
  });
});

// --- loadConfig ---

describe("loadConfig", () => {
  test("reads name and assets dir from wrangler.toml", () => {
    writeFileSync(
      join(TMP, "wrangler.toml"),
      `name = "my-app"\nmain = "src/index.ts"\n\n[assets]\ndirectory = "dist"\n`,
    );
    const cfg = loadConfig({ dir: TMP });
    expect(cfg.name).toBe("my-app");
    expect(cfg.assetsDir).toEndWith("/dist");
    expect(cfg.workerDir).toBe(TMP);
    expect(cfg.domain).toBe("workers.dev");
  });

  test("defaults name to my-worker when wrangler.toml missing", () => {
    const cfg = loadConfig({ dir: TMP });
    expect(cfg.name).toBe("my-worker");
  });

  test("defaults assets dir to public when not in wrangler.toml", () => {
    writeFileSync(join(TMP, "wrangler.toml"), `name = "app"\n`);
    const cfg = loadConfig({ dir: TMP });
    expect(cfg.assetsDir).toEndWith("/public");
  });

  test("CLI name flag overrides wrangler.toml", () => {
    writeFileSync(join(TMP, "wrangler.toml"), `name = "from-toml"\n`);
    const cfg = loadConfig({ dir: TMP, name: "from-flag" });
    expect(cfg.name).toBe("from-flag");
  });

  test("CLI domain flag overrides default", () => {
    const cfg = loadConfig({ dir: TMP, domain: "example.com" });
    expect(cfg.domain).toBe("example.com");
  });

  test("env CF_DEPLOY_NAME overrides wrangler.toml", () => {
    writeFileSync(join(TMP, "wrangler.toml"), `name = "from-toml"\n`);
    process.env.CF_DEPLOY_NAME = "from-env";
    const cfg = loadConfig({ dir: TMP });
    expect(cfg.name).toBe("from-env");
  });

  test("env CF_DEPLOY_DOMAIN overrides default", () => {
    process.env.CF_DEPLOY_DOMAIN = "custom.dev";
    const cfg = loadConfig({ dir: TMP });
    expect(cfg.domain).toBe("custom.dev");
  });
});
