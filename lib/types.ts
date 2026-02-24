/**
 * Shared types — the versions.json contract.
 */

export interface GitInfo {
  commitSha: string;
  commitFull: string;
  commitMessage: string;
  branch: string;
  commitUrl: string;
}

export interface Release {
  version: string;
  tag: string;
  date: string;
  versionId: string;
  url: string; // alias URL (e.g. v0-7-0-myapp...) — latest upload for this tag
  previewUrl: string; // immutable URL (e.g. cf3bdf37-myapp...) — this exact upload
  healthy?: boolean;
  git?: GitInfo;
  commandCount?: number;
}

export interface Preview {
  label: string;
  tag: string;
  date: string;
  versionId: string;
  url: string;
  healthy?: boolean;
}

export interface VersionsJson {
  production: string;
  github: string;
  generated: string;
  versions: Release[];
  previews: Preview[];
}
