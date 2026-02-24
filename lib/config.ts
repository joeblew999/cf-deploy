/**
 * Config — reads wrangler.toml for worker name and assets dir.
 * No custom config file needed.
 */
import { existsSync, readFileSync } from "fs";
import { join, resolve } from "path";

export interface CfDeployConfig {
  name: string;
  assetsDir: string;
  workerDir: string;
  domain: string;
}

/** Parse worker name from wrangler.toml */
function readName(text: string): string {
  const m = text.match(/^name\s*=\s*"([^"]+)"/m);
  return m?.[1] || "my-worker";
}

/** Parse [assets].directory from wrangler.toml */
function readAssetsDir(text: string): string {
  const m = text.match(/\[assets\]\s*\n\s*directory\s*=\s*"([^"]+)"/);
  return m?.[1] || "public";
}

/** Read version from package.json in a directory */
export function readVersion(dir: string): string {
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  const pkgPath = join(dir, "package.json");
  if (!existsSync(pkgPath)) return "0.0.0";
  try {
    return JSON.parse(readFileSync(pkgPath, "utf8")).version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/**
 * Load config from wrangler.toml + env/flag overrides.
 * Looks for wrangler.toml in --dir or CWD.
 */
export function loadConfig(opts?: {
  dir?: string;
  name?: string;
  domain?: string;
}): CfDeployConfig {
  const workerDir = resolve(opts?.dir || process.env.CF_DEPLOY_DIR || ".");
  const tomlPath = join(workerDir, "wrangler.toml");

  let toml = "";
  if (existsSync(tomlPath)) {
    toml = readFileSync(tomlPath, "utf8");
  }

  const name = opts?.name || process.env.CF_DEPLOY_NAME || readName(toml);
  const assetsDir = resolve(workerDir, readAssetsDir(toml));
  const domain =
    opts?.domain || process.env.CF_DEPLOY_DOMAIN || "workers.dev";

  return { name, assetsDir, workerDir, domain };
}
