import { expect, test } from "bun:test";
import { versionAliasUrl } from "../lib/wrangler.ts";

test("versionAliasUrl lowercases and replaces dots", () => {
  const config: any = {
    worker: { name: "my-worker", domain: "workers.dev" }
  };
  expect(versionAliasUrl(config, "1.2.3")).toBe("https://v1-2-3-my-worker.workers.dev");
  expect(versionAliasUrl(config, "v1.2.3")).toBe("https://vv1-2-3-my-worker.workers.dev");
  expect(versionAliasUrl(config, "TEST.1")).toBe("https://vtest-1-my-worker.workers.dev");
});
