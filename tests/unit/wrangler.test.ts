import { describe, expect, test } from "bun:test";
import {
  workerUrl,
  versionAliasUrl,
  parseWranglerOutput,
} from "../../lib/wrangler.ts";

// --- URL builders ---

describe("workerUrl", () => {
  const config: any = { name: "my-worker", domain: "workers.dev" };

  test("builds URL with prefix", () => {
    expect(workerUrl(config, "pr-42")).toBe(
      "https://pr-42-my-worker.workers.dev",
    );
  });

  test("uses custom domain", () => {
    const c: any = { name: "app", domain: "example.com" };
    expect(workerUrl(c, "v1")).toBe("https://v1-app.example.com");
  });
});

describe("versionAliasUrl", () => {
  const config: any = { name: "my-worker", domain: "workers.dev" };

  test("lowercases and replaces dots", () => {
    expect(versionAliasUrl(config, "1.2.3")).toBe(
      "https://v1-2-3-my-worker.workers.dev",
    );
  });

  test("prefixes with v", () => {
    expect(versionAliasUrl(config, "v1.2.3")).toBe(
      "https://vv1-2-3-my-worker.workers.dev",
    );
  });

  test("lowercases uppercase versions", () => {
    expect(versionAliasUrl(config, "TEST.1")).toBe(
      "https://vtest-1-my-worker.workers.dev",
    );
  });
});

// --- Version list parsing ---

describe("parseWranglerOutput", () => {
  test("parses typical wrangler versions list output", () => {
    const raw = `
Version ID:  abc-123
Created:     2025-01-15T10:30:00Z
Tag:         v1.0.0

Version ID:  def-456
Created:     2025-01-16T11:00:00Z
Tag:         v1.1.0
`;
    const versions = parseWranglerOutput(raw);
    expect(versions).toHaveLength(2);
    expect(versions[0]).toEqual({
      versionId: "abc-123",
      created: "2025-01-15T10:30:00Z",
      tag: "v1.0.0",
    });
    expect(versions[1]).toEqual({
      versionId: "def-456",
      created: "2025-01-16T11:00:00Z",
      tag: "v1.1.0",
    });
  });

  test("skips entries with tag = '-' (untagged)", () => {
    const raw = `
Version ID:  abc-123
Created:     2025-01-15T10:30:00Z
Tag:         v1.0.0

Version ID:  no-tag-id
Created:     2025-01-15T09:00:00Z
Tag:         -
`;
    const versions = parseWranglerOutput(raw);
    expect(versions).toHaveLength(1);
    expect(versions[0].versionId).toBe("abc-123");
  });

  test("returns empty array for empty input", () => {
    expect(parseWranglerOutput("")).toEqual([]);
  });

  test("returns empty array for noise-only input", () => {
    const raw = `
 ⛅️ wrangler 4.0.0
Some random output
No version info here
`;
    expect(parseWranglerOutput(raw)).toEqual([]);
  });

  test("handles entries missing created date gracefully", () => {
    // Version ID followed immediately by tag (no Created line)
    const raw = `
Version ID:  abc-123
Tag:         v1.0.0
`;
    const versions = parseWranglerOutput(raw);
    // Should be skipped because created is missing
    expect(versions).toEqual([]);
  });

  test("handles multiple versions with mixed tagged/untagged", () => {
    const raw = `
Version ID:  v1
Created:     2025-01-01
Tag:         v1.0.0

Version ID:  v2
Created:     2025-01-02
Tag:         -

Version ID:  v3
Created:     2025-01-03
Tag:         v1.1.0

Version ID:  v4
Created:     2025-01-04
Tag:         -
`;
    const versions = parseWranglerOutput(raw);
    expect(versions).toHaveLength(2);
    expect(versions[0].tag).toBe("v1.0.0");
    expect(versions[1].tag).toBe("v1.1.0");
  });

  test("trims whitespace from parsed values", () => {
    const raw = `
Version ID:   abc-123
Created:      2025-01-15T10:30:00Z
Tag:          v1.0.0
`;
    const versions = parseWranglerOutput(raw);
    expect(versions).toHaveLength(1);
    expect(versions[0].versionId).toBe("abc-123");
    expect(versions[0].created).toBe("2025-01-15T10:30:00Z");
    expect(versions[0].tag).toBe("v1.0.0");
  });
});
