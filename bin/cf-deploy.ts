#!/usr/bin/env bun
/**
 * cf-deploy — Reusable Cloudflare Workers deploy toolkit.
 *
 * Usage:
 *   cf-deploy upload [--version X] [--tag T]
 *   cf-deploy promote
 *   cf-deploy rollback
 *   cf-deploy canary
 *   cf-deploy smoke [URL]
 *   cf-deploy versions-json [--latest | --latest-env] [--health-check]
 *   cf-deploy preview --pr N
 *   cf-deploy list
 *   cf-deploy status
 *   cf-deploy versions
 *   cf-deploy tail
 *   cf-deploy secrets
 *   cf-deploy whoami
 */

import { loadConfig } from "../lib/config.ts";
import { upload } from "../lib/upload.ts";
import { promote } from "../lib/promote.ts";
import { smoke } from "../lib/smoke.ts";
import { generateVersionsJson, printLatest, printLatestEnv } from "../lib/versions.ts";
import { preview } from "../lib/preview.ts";
import { list } from "../lib/list.ts";
import { rollback, canary, status, versionsList, tail, secretList, whoami, deleteWorker } from "../lib/wrangler.ts";
import { runTests } from "../lib/test.ts";

const args = process.argv.slice(2);

function getFlag(name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function hasFlag(name: string): boolean {
  return args.includes(name);
}

const configPath = getFlag("--config");

// Find the command — skip global flags (--config PATH)
let command: string | undefined;
let commandIdx = -1;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--config") { i++; continue; } // skip --config and its value
  if (args[i].startsWith("-")) continue;
  command = args[i];
  commandIdx = i;
  break;
}

/** Get the first positional arg after the command (not a flag) */
function getPositionalArg(): string | undefined {
  for (let i = commandIdx + 1; i < args.length; i++) {
    if (args[i] === "--config") { i++; continue; }
    if (args[i].startsWith("-")) continue;
    return args[i];
  }
  return undefined;
}

if (!command || command === "--help" || command === "-h") {
  console.log(`cf-deploy — Cloudflare Workers deploy toolkit

Commands:
  upload [--version X] [--tag T]   Upload new version (does NOT promote)
  promote                          Deploy latest version to 100% traffic
  rollback                         Roll back to previous version
  canary                           Deploy with gradual traffic split
  smoke [URL]                      Smoke test a deployed URL
  versions-json [--latest|--latest-env]  Generate/query versions.json
  preview --pr N                   Upload PR preview
  list                             Show all versions with URLs
  status                           Show current deployment
  versions                         List recent versions (raw wrangler)
  test [URL]                       Run Playwright tests against a URL
  delete                           Delete the Worker (teardown)
  tail                             Tail live Worker logs
  secrets                          List Worker secrets
  whoami                           Show Cloudflare auth info

Options:
  --config PATH                    Path to cf-deploy.yml (default: auto-detect)
  --health-check                   Health-check preview URLs during versions-json`);
  process.exit(0);
}

const config = loadConfig(configPath);

switch (command) {
  case "upload":
    upload(config, { version: getFlag("--version"), tag: getFlag("--tag") });
    break;

  case "promote":
    promote(config);
    break;

  case "rollback":
    rollback(config);
    break;

  case "canary":
    canary(config);
    break;

  case "smoke":
    smoke(config, getPositionalArg());
    break;

  case "versions-json":
    if (hasFlag("--latest")) {
      printLatest(config);
    } else if (hasFlag("--latest-env")) {
      printLatestEnv(config);
    } else {
      await generateVersionsJson(config, { healthCheck: hasFlag("--health-check") });
    }
    break;

  case "preview":
    const pr = getFlag("--pr");
    if (!pr) {
      console.error("ERROR: --pr N is required");
      process.exit(1);
    }
    preview(config, pr);
    break;

  case "list":
    list(config);
    break;

  case "status":
    status(config);
    break;

  case "versions":
    versionsList(config);
    break;

  case "tail":
    tail(config);
    break;

  case "secrets":
    secretList(config);
    break;

  case "test":
    runTests(config, getPositionalArg());
    break;

  case "delete":
    deleteWorker(config);
    break;

  case "whoami":
    whoami();
    break;

  default:
    console.error(`Unknown command: ${command}\nRun 'cf-deploy --help' for usage.`);
    process.exit(1);
}
