/**
 * Simple wrangler pass-through commands.
 */
import { execSync } from "child_process";
import type { CfDeployConfig } from "./config.ts";

export function rollback(config: CfDeployConfig) {
  execSync("bun x wrangler rollback", { cwd: config.worker.dir, stdio: "inherit" });
}

export function canary(config: CfDeployConfig) {
  execSync("bun x wrangler versions deploy", { cwd: config.worker.dir, stdio: "inherit" });
}

export function status(config: CfDeployConfig) {
  execSync("bun x wrangler deployments list", { cwd: config.worker.dir, stdio: "inherit" });
}

export function versionsList(config: CfDeployConfig) {
  execSync("bun x wrangler versions list", { cwd: config.worker.dir, stdio: "inherit" });
}

export function tail(config: CfDeployConfig) {
  execSync("bun x wrangler tail", { cwd: config.worker.dir, stdio: "inherit" });
}

export function whoami() {
  execSync("bun x wrangler whoami", { stdio: "inherit" });
}

export function secretList(config: CfDeployConfig) {
  execSync("bun x wrangler secret list", { cwd: config.worker.dir, stdio: "inherit" });
}

export function deleteWorker(config: CfDeployConfig) {
  console.log(`Deleting worker: ${config.worker.name}`);
  execSync(`bun x wrangler delete --name ${config.worker.name}`, { cwd: config.worker.dir, stdio: "inherit" });
}
