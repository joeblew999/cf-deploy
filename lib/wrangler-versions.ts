/**
 * Parse wrangler versions list output into structured data.
 * Shared between versions.ts and list.ts.
 */
import type { CfDeployConfig } from "./config.ts";
import { wrangler } from "./wrangler.ts";

export interface WranglerVersion {
  versionId: string;
  created: string;
  tag: string;
}

/** Run `wrangler versions list` and parse the output into structured entries. */
export function fetchWranglerVersions(
  config: CfDeployConfig,
): WranglerVersion[] {
  const raw = wrangler(config, ["versions", "list"], {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).toString();

  return parseWranglerOutput(raw);
}

/** Parse raw wrangler versions list text output. */
export function parseWranglerOutput(raw: string): WranglerVersion[] {
  const entries: WranglerVersion[] = [];
  let cur: Partial<WranglerVersion> = {};

  for (const line of raw.split("\n")) {
    const idMatch = line.match(/^Version ID:\s+(.+)/);
    const createdMatch = line.match(/^Created:\s+(.+)/);
    const tagMatch = line.match(/^Tag:\s+(.+)/);

    if (idMatch) {
      cur = { versionId: idMatch[1].trim() };
    } else if (createdMatch && cur.versionId) {
      cur.created = createdMatch[1].trim();
    } else if (tagMatch && cur.versionId) {
      cur.tag = tagMatch[1].trim();
      if (cur.tag !== "-" && cur.created) {
        entries.push(cur as WranglerVersion);
      }
      cur = {};
    }
  }

  return entries;
}
