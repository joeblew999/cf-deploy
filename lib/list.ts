/**
 * List all versions and PR previews with their URLs.
 */
import { execSync } from "child_process";
import type { CfDeployConfig } from "./config.ts";

export function list(config: CfDeployConfig) {
  const raw = execSync("bun x wrangler versions list 2>&1", {
    cwd: config.worker.dir,
    encoding: "utf8",
  });

  // Parse version entries
  interface Entry { versionId: string; created: string; tag: string; }
  const entries: Entry[] = [];
  let cur: Partial<Entry> = {};

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
        entries.push(cur as Entry);
      }
      cur = {};
    }
  }

  // Sort by date descending
  entries.sort((a, b) => b.created.localeCompare(a.created));

  const releases = entries.filter((e) => /^v\d/.test(e.tag));
  const previews = entries.filter((e) => e.tag.startsWith("pr-"));

  if (releases.length > 0) {
    console.log("=== Release Versions ===\n");
    for (const e of releases) {
      const slug = e.tag.replace("v", "").replaceAll(".", "-");
      console.log(`  ${e.tag}  (${e.created})`);
      console.log(`    https://v${slug}-${config.worker.name}.${config.worker.domain}\n`);
    }
  }

  if (previews.length > 0) {
    console.log("=== PR Previews ===\n");
    for (const e of previews) {
      console.log(`  ${e.tag}  (${e.created})`);
      console.log(`    https://${e.tag}-${config.worker.name}.${config.worker.domain}\n`);
    }
  }

  if (config.urls.production) {
    console.log(`Production:  ${config.urls.production}`);
  }
}
