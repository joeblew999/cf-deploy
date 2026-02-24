/**
 * Config reader — loads cf-deploy.yml and merges with env var overrides.
 */
import { existsSync, readFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { execSync } from "child_process";

export interface CfDeployConfig {
  worker: {
    name: string;
    domain: string;
    dir: string;
  };
  urls: {
    production: string;
  };
  github: {
    repo: string;
  };
  version: {
    source: string;
  };
  output: {
    versions_json: string;
  };
  smoke: {
    extra?: string;
  };
  assets: {
    dir: string;
  };
  rootDir: string;
}

/** Read [assets].directory from wrangler.toml, if present */
function readAssetsDirFromWrangler(workerDir: string): string | undefined {
  const tomlPath = join(workerDir, "wrangler.toml");
  if (!existsSync(tomlPath)) return undefined;
  const text = readFileSync(tomlPath, "utf8");
  const match = text.match(/\[assets\]\s*\n\s*directory\s*=\s*"([^"]+)"/);
  return match?.[1];
}

/** Find repo root via git from given dir, fallback to cwd */
function findRoot(fromDir?: string): string {
  try {
    const opts = fromDir ? { encoding: "utf8" as const, cwd: fromDir } : { encoding: "utf8" as const };
    return execSync("git rev-parse --show-toplevel", opts).trim();
  } catch {
    return process.cwd();
  }
}

/** Parse a simple YAML-like config file (flat or one-level nested) */
function parseSimpleYaml(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  let currentSection = "";

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const sectionMatch = line.match(/^(\w+):\s*$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      continue;
    }

    const topMatch = line.match(/^(\w+):\s+(.+)/);
    if (topMatch) {
      result[topMatch[1]] = topMatch[2].trim().replace(/^["']|["']$/g, "");
      currentSection = "";
      continue;
    }

    const nestedMatch = line.match(/^\s+(\w+):\s+(.+)/);
    if (nestedMatch && currentSection) {
      result[`${currentSection}.${nestedMatch[1]}`] = nestedMatch[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  return result;
}

/**
 * Load config from cf-deploy.yml + env var overrides.
 * Searches: explicit --config, then CWD, then git root.
 */
export function loadConfig(configPath?: string): CfDeployConfig {
  const cwd = process.cwd();
  const gitRoot = findRoot();

  const candidates = configPath
    ? [resolve(configPath)]
    : [
        join(cwd, "cf-deploy.yml"),
        join(cwd, "cf-deploy.yaml"),
        join(gitRoot, "cf-deploy.yml"),
        join(gitRoot, "cf-deploy.yaml"),
      ];

  let yaml: Record<string, string> = {};
  let configDir = cwd;
  for (const p of candidates) {
    if (existsSync(p)) {
      yaml = parseSimpleYaml(readFileSync(p, "utf8"));
      configDir = dirname(p);
      break;
    }
  }

  const workerDir = resolve(configDir, process.env.WORKER_DIR || yaml["worker.dir"] || ".");

  return {
    worker: {
      name: process.env.WORKER_NAME || yaml["worker.name"] || "my-worker",
      domain: process.env.WORKER_DOMAIN || yaml["worker.domain"] || "workers.dev",
      dir: workerDir,
    },
    urls: {
      production: process.env.PRODUCTION_URL || yaml["urls.production"] || "",
    },
    github: {
      repo: process.env.GITHUB_REPO || yaml["github.repo"] || "",
    },
    version: {
      source: resolve(configDir, process.env.SCHEMA_FILE || yaml["version.source"] || "package.json"),
    },
    output: {
      versions_json: resolve(configDir, process.env.OUTPUT_FILE || yaml["output.versions_json"] || "versions.json"),
    },
    smoke: {
      extra: process.env.SMOKE_EXTRA_CMD || yaml["smoke.extra"],
    },
    assets: {
      dir: resolve(workerDir, yaml["assets.dir"] || readAssetsDirFromWrangler(workerDir) || "public"),
    },
    rootDir: process.env.ROOT_DIR || findRoot(workerDir),
  };
}
