import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { findLockfile, loupeCacheDir, targetHash } from "./cache-dir";
import { REPO_ROOT } from "./paths";

let tmp: string;
beforeAll(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "loupe-cache-")));
  fs.mkdirSync(path.join(tmp, "mono/apps/web"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "other"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "mono/pnpm-lock.yaml"), "lockfileVersion: 9\n");
});
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe("dep cache dir", () => {
  it("finds the lockfile at or above the target", () => {
    expect(findLockfile(path.join(tmp, "mono/apps/web"))).toBe(path.join(tmp, "mono/pnpm-lock.yaml"));
  });

  it("differs per target and per lockfile content, and lives in this repo", () => {
    const web = path.join(tmp, "mono/apps/web");
    const before = targetHash(web);
    expect(targetHash(web)).toBe(before);
    expect(targetHash(path.join(tmp, "other"))).not.toBe(before);
    fs.writeFileSync(path.join(tmp, "mono/pnpm-lock.yaml"), "lockfileVersion: 9\n# changed\n");
    expect(targetHash(web)).not.toBe(before);
    expect(loupeCacheDir(web)).toBe(path.join(REPO_ROOT, "node_modules/.vite", `loupe-${targetHash(web)}`));
  });
});
