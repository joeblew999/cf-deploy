#!/usr/bin/env bun
/**
 * cf-deploy — Cloudflare Workers deploy toolkit.
 *
 * Commands:
 *   cf-deploy upload [--version X] [--tag T] [--pr N]
 *   cf-deploy promote [--version X]
 *   cf-deploy rollback
 *   cf-deploy smoke <URL>
 *   cf-deploy versions-json [--out PATH]
 *   cf-deploy init --name N [--domain D]
 */
import { loadConfig } from "../lib/config.ts";
import { upload, promote, rollback } from "../lib/deploy.ts";
import { smoke } from "../lib/smoke.ts";
import { generateVersionsJson } from "../lib/versions.ts";
import { init } from "../lib/init.ts";
import pkg from "../package.json";

const args = process.argv.slice(2);

function getFlag(name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  const val = args[idx + 1];
  if (val === undefined || val.startsWith("--")) return undefined;
  return val;
}

// Version check
if (
  args.length === 1 &&
  (args[0] === "--version" || args[0] === "-v" || args[0] === "version")
) {
  console.log(pkg.version);
  process.exit(0);
}

const command = args[0];

// Help
if (!command || command === "--help" || command === "-h") {
  console.log(`cf-deploy — Cloudflare Workers deploy toolkit

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

// Init (no config needed)
if (command === "init") {
  const name = getFlag("--name");
  if (!name) {
    console.error("Usage: cf-deploy init --name my-worker [--domain example.workers.dev]");
    process.exit(1);
  }
  init(name, getFlag("--domain"));
  process.exit(0);
}

// All other commands need config
const config = loadConfig({
  dir: getFlag("--dir"),
  name: getFlag("--name"),
  domain: getFlag("--domain"),
});

const positionalArg = args.slice(1).find((a) => !a.startsWith("-"));

switch (command) {
  case "upload":
    upload(config, {
      version: getFlag("--version"),
      tag: getFlag("--tag"),
      pr: getFlag("--pr"),
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
    console.error(
      `Unknown command: ${command}\nRun 'cf-deploy --help' for usage.`,
    );
    process.exit(1);
}
