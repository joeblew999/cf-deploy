/**
 * List all versions and PR previews with their URLs.
 */
import type { CfDeployConfig } from "./config.ts";
import { fetchWranglerVersions } from "./wrangler-versions.ts";
import { workerUrl, versionAliasUrl } from "./urls.ts";

export function list(config: CfDeployConfig) {
  const entries = fetchWranglerVersions(config);

  // Sort by date descending
  entries.sort((a, b) => b.created.localeCompare(a.created));

  const releases = entries.filter((e) => /^v\d/.test(e.tag));
  const previews = entries.filter((e) => e.tag.startsWith("pr-"));

  if (releases.length > 0) {
    console.log("=== Release Versions ===\n");
    for (const e of releases) {
      const ver = e.tag.replace("v", "");
      console.log(`  ${e.tag}  (${e.created})`);
      console.log(`    ${versionAliasUrl(config, ver)}\n`);
    }
  }

  if (previews.length > 0) {
    console.log("=== PR Previews ===\n");
    for (const e of previews) {
      console.log(`  ${e.tag}  (${e.created})`);
      console.log(`    ${workerUrl(config, e.tag)}\n`);
    }
  }

  if (config.urls.production) {
    console.log(`Production:  ${config.urls.production}`);
  }
}
