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
    dir: string; // absolute path
  };
  urls: {
    production: string;
  };
  github: {
    repo: string;
  };
  version: {
    source: string; // absolute path to JSON file with .version
  };
  output: {
    versions_json: string; // absolute path
  };
  smoke: {
    extra?: string; // optional shell command for project-specific checks
  };
  rootDir: string; // absolute path to repo root
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

/**
 * Parse a simple YAML-like config file.
 * Handles nested keys (one level) like:
 *   worker:
 *     name: truck-cad
 * Returns flat dotted keys: { "worker.name": "truck-cad" }
 */
function parseSimpleYaml(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  let currentSection = "";

  for (const line of text.split("\n")) {
    // Skip comments and blank lines
    if (/^\s*#/.test(line) || /^\s*$/.test(line)) continue;

    // Top-level key (no leading whitespace, ends with colon)
    const sectionMatch = line.match(/^(\w+):\s*$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      continue;
    }

    // Top-level key with value
    const topMatch = line.match(/^(\w+):\s+(.+)/);
    if (topMatch) {
      result[topMatch[1]] = topMatch[2].trim().replace(/^["']|["']$/g, "");
      currentSection = "";
      continue;
    }

    // Nested key (indented)
    const nestedMatch = line.match(/^\s+(\w+):\s+(.+)/);
    if (nestedMatch && currentSection) {
      const key = `${currentSection}.${nestedMatch[1]}`;
      result[key] = nestedMatch[2].trim().replace(/^["']|["']$/g, "");
    }
  }

  return result;
}

/**
 * Load config from cf-deploy.yml + env var overrides.
 * Searches: explicit --config, then CWD, then git root.
 * Relative paths in config resolve from the config file's directory.
 */
export function loadConfig(configPath?: string): CfDeployConfig {
  const cwd = process.cwd();
  const gitRoot = findRoot();

  // Search for config: explicit path → CWD → git root
  const candidates = configPath
    ? [resolve(configPath)]
    : [
        join(cwd, "cf-deploy.yml"),
        join(cwd, "cf-deploy.yaml"),
        ...(cwd !== gitRoot ? [join(gitRoot, "cf-deploy.yml"), join(gitRoot, "cf-deploy.yaml")] : []),
      ];

  let yaml: Record<string, string> = {};
  let configDir = cwd; // base directory for resolving relative paths
  for (const p of candidates) {
    if (existsSync(p)) {
      yaml = parseSimpleYaml(readFileSync(p, "utf8"));
      configDir = dirname(p);
      break;
    }
  }

  // Build config with env var overrides
  const workerName = process.env.WORKER_NAME || yaml["worker.name"] || "my-worker";
  const workerDomain = process.env.WORKER_DOMAIN || yaml["worker.domain"] || "workers.dev";
  const workerDirRel = process.env.WORKER_DIR || yaml["worker.dir"] || ".";
  const workerDir = resolve(configDir, workerDirRel);

  // rootDir: prefer ROOT_DIR env, then worker dir's git root, fallback to config dir
  const rootDir = process.env.ROOT_DIR || findRoot(workerDir);

  const productionUrl = process.env.PRODUCTION_URL || yaml["urls.production"] || "";
  const githubRepo = process.env.GITHUB_REPO || yaml["github.repo"] || "";

  const versionSourceRel = process.env.SCHEMA_FILE || yaml["version.source"] || "package.json";
  const versionSource = resolve(configDir, versionSourceRel);

  const outputRel = process.env.OUTPUT_FILE || yaml["output.versions_json"] || "versions.json";
  const outputFile = resolve(configDir, outputRel);

  const smokeExtra = process.env.SMOKE_EXTRA_CMD || yaml["smoke.extra"] || undefined;

  return {
    worker: { name: workerName, domain: workerDomain, dir: workerDir },
    urls: { production: productionUrl },
    github: { repo: githubRepo },
    version: { source: versionSource },
    output: { versions_json: outputFile },
    smoke: { extra: smokeExtra },
    rootDir,
  };
}
