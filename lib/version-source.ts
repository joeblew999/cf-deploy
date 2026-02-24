/**
 * Read the current app version from the configured source file.
 */
import { existsSync, readFileSync } from "fs";
import type { CfDeployConfig } from "./config.ts";

export function getAppVersion(config: CfDeployConfig): string {
  if (process.env.APP_VERSION) return process.env.APP_VERSION;

  const path = config.version.source;
  if (!existsSync(path)) return "0.0.0";

  try {
    const data = JSON.parse(readFileSync(path, "utf8"));
    return data.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export function getCommandCount(config: CfDeployConfig): number | undefined {
  const path = config.version.source;
  if (!existsSync(path)) return undefined;

  try {
    const data = JSON.parse(readFileSync(path, "utf8"));
    if (data.commands) return Object.keys(data.commands).length;
    return undefined;
  } catch {
    return undefined;
  }
}
