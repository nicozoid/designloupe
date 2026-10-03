import { describe, it, expect } from "vitest";
import path from "node:path";
import type { DiscoveryModel, ResolvedConfig } from "@designloupe/core";
import { globDirs, loupePlugin, sameModel, shouldRediscover, within } from "./vite-plugin";

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

describe("monorepo component globs", () => {
  const ui = path.join(path.sep, "work", "packages", "ui");
  it("watches the folders component globs reach outside the target", () => {
    expect(globDirs(["../packages/ui/src/**/*.tsx", "src/components/**/*.tsx"], at(path.sep, "work", "app"))).toEqual([at(ui, "src"), at(root, "src/components")]);
    const dirs = { root, loupeDir, extra: [at(ui, "src")] };
    expect(shouldRediscover(at(ui, "src/Button.tsx"), dirs)).toBe(true);
    expect(shouldRediscover(at(ui, "src/node_modules/x/y.js"), dirs)).toBe(false);
    expect(shouldRediscover(at(ui, "dist/Button.js"), dirs)).toBe(false);
  });
});

describe("sameModel", () => {
  const model = { name: "A", components: [], generatedAt: "2026-10-02T00:00:00Z" } as unknown as DiscoveryModel;
  it("ignores generatedAt but notices real changes", () => {
    expect(sameModel(model, { ...model, generatedAt: "2026-10-03T00:00:00Z" })).toBe(true);
    expect(sameModel(model, { ...model, name: "B" })).toBe(false);
  });
});

describe("virtual:loupe/icons", () => {
  const config = { root, componentGlobs: ["src/**/*.tsx"], presets: [], shims: {}, configDir: loupeDir, adapter: "mui", themeExport: "theme" } as unknown as ResolvedConfig;
  const icon = (name: string) => ({ name, source: "library" as const, importPath: "@mui/icons-material", sites: [] });
  const model = { components: [], icons: [icon("Delete"), icon("NotAnIcon")] } as unknown as DiscoveryModel;

  it("turns an icon that won't resolve into a rejected import instead of breaking the whole module", async () => {
    const plugin = loupePlugin({ config, model, rediscover: async () => model });
    const ctx = { resolve: async (id: string) => (id.endsWith("/Delete") ? { id: "/nm/Delete.js" } : null) };
    const load = plugin.load as unknown as (this: typeof ctx, id: string) => Promise<string>;
    const code = await load.call(ctx, "\0virtual:loupe/icons");
    expect(code).toContain(`"Delete": () => import("@mui/icons-material/Delete")`);
    expect(code).not.toContain(`import("@mui/icons-material/NotAnIcon")`);
    expect(code).toContain(`"NotAnIcon": () => Promise.reject(new Error("Could not resolve @mui/icons-material/NotAnIcon"))`);
  });
});

describe("watching", () => {
  const config = { root, componentGlobs: ["src/**/*.tsx"], presets: [], shims: {}, configDir: loupeDir, adapter: "mui", themeExport: "theme" } as unknown as ResolvedConfig;
  const model = { components: [], icons: [] } as unknown as DiscoveryModel;
  const fakeServer = () => {
    const on: string[] = [];
    const watcher = { add: () => watcher, on: (ev: string) => (on.push(ev), watcher) };
    return { on, server: { watcher } };
  };
  const configure = (c: ResolvedConfig) => {
    const f = fakeServer();
    (loupePlugin({ config: c, model, rediscover: async () => model }).configureServer as (s: unknown) => void)(f.server);
    return f.on;
  };

  it("rediscovers on file events by default, and not at all with watch: false", () => {
    expect(configure({ ...config, watch: true })).toEqual(["add", "unlink", "change"]);
    expect(configure({ ...config, watch: false })).toEqual([]);
  });
});
