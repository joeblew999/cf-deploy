/**
 * Generate versions.json from wrangler versions list.
 * Run BEFORE upload so the manifest ships with the deploy.
 */
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";
import type { CfDeployConfig } from "./config.ts";
import { readVersion } from "./config.ts";
import {
  fetchWranglerVersions,
  versionAliasUrl,
  workerUrl,
} from "./wrangler.ts";

interface VersionEntry {
  version: string;
  tag: string;
  date: string;
  url: string;
}

interface PreviewEntry {
  label: string;
  tag: string;
  date: string;
  url: string;
}

interface VersionsJson {
  production: string;
  generated: string;
  versions: VersionEntry[];
  previews: PreviewEntry[];
}

export function generateVersionsJson(config: CfDeployConfig, outPath?: string) {
  const output = outPath || `${config.assetsDir}/versions.json`;
  const appVersion = readVersion(config.workerDir);

  // Query existing versions from Cloudflare
  const wranglerVersions = fetchWranglerVersions(config);

  const versions: VersionEntry[] = [];
  const previews: PreviewEntry[] = [];

  for (const v of wranglerVersions) {
    if (v.tag.startsWith("pr-")) {
      previews.push({
        label: `PR #${v.tag.replace("pr-", "")}`,
        tag: v.tag,
        date: v.created,
        url: workerUrl(config, v.tag),
      });
    } else if (/^v\d/.test(v.tag)) {
      const ver = v.tag.replace("v", "");
      versions.push({
        version: ver,
        tag: v.tag,
        date: v.created,
        url: versionAliasUrl(config, ver),
      });
    }
  }

  // Dedupe by version (keep latest), sort descending
  const deduped = [
    ...new Map(versions.map((r) => [r.version, r])).values(),
  ];
  deduped.sort((a, b) =>
    b.version.localeCompare(a.version, undefined, { numeric: true }),
  );

  // Ensure current version is present (even if not yet uploaded)
  if (appVersion !== "0.0.0" && !deduped.find((v) => v.version === appVersion)) {
    deduped.unshift({
      version: appVersion,
      tag: `v${appVersion}`,
      date: new Date().toISOString(),
      url: versionAliasUrl(config, appVersion),
    });
  }

  const out: VersionsJson = {
    production: `https://${config.name}.${config.domain}`,
    generated: new Date().toISOString(),
    versions: deduped,
    previews,
  };

  const outDir = dirname(output);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  writeFileSync(output, JSON.stringify(out, null, 2) + "\n");
  console.log(
    `versions.json: ${deduped.length} versions, ${previews.length} PR previews`,
  );
}
