import { describe, it, expect } from "vitest";
import path from "node:path";
import type { DiscoveryModel } from "@designloupe/core";
import { sameModel, shouldRediscover, within } from "./vite-plugin";

const root = path.join(path.sep, "work", "app");
const loupeDir = path.join(path.sep, "work", "app-loupe");
const at = (...p: string[]) => path.join(...p);

describe("within", () => {
  it("needs a separator, not just a shared prefix", () => {
    expect(within(root, root)).toBe(true);
    expect(within(at(root, "src/a.ts"), root)).toBe(true);
    expect(within(at(loupeDir, "a.ts"), root)).toBe(false);
  });
});

describe("shouldRediscover", () => {
  const dirs = { root, loupeDir };
  it("accepts source files in the target and the loupe dir", () => {
    expect(shouldRediscover(at(root, "src/components/Button.tsx"), dirs)).toBe(true);
    expect(shouldRediscover(at(loupeDir, "components/Button.loupe.tsx"), dirs)).toBe(true);
  });
  it("ignores non-source files, other folders, build output and dot-dirs", () => {
    expect(shouldRediscover(at(root, "src/styles.css"), dirs)).toBe(false);
    expect(shouldRediscover(at(path.sep, "elsewhere/x.ts"), dirs)).toBe(false);
    for (const d of ["node_modules/pkg", ".next/server", "dist", "build", "out", "coverage", "src/.cache"]) {
      expect(shouldRediscover(at(root, d, "x.js"), dirs), d).toBe(false);
    }
  });
});

describe("sameModel", () => {
  const model = { name: "A", components: [], generatedAt: "2026-10-02T00:00:00Z" } as unknown as DiscoveryModel;
  it("ignores generatedAt but notices real changes", () => {
    expect(sameModel(model, { ...model, generatedAt: "2026-10-03T00:00:00Z" })).toBe(true);
    expect(sameModel(model, { ...model, name: "B" })).toBe(false);
  });
});
