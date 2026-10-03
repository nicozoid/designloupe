import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ResolvedConfig } from "../config/schema";
import { loadConfig } from "../config/load";
import { createAnalysis, type Analysis } from "../analysis/program";
import type { AdapterNode } from "../adapter";
import type { DiscoveryModel } from "../model";
import { createDiscoverCache, discover, needsDocgen } from "./discover";

const configPath = path.resolve(import.meta.dirname, "../../../../examples/fixture-loupe/loupe.config.ts");

/** Minimal adapter stub: this test only cares about docgen isolation, not classification. */
const fakeAdapter: AdapterNode = {
  id: "fake",
  libraryName: "Fake",
  packageName: "nonexistent-pkg-xyz",
  classifyImport: () => null,
  classifyIconImport: () => null,
  layoutPrimitives: [],
};

describe("discover: per-file docgen isolation", () => {
  it(
    "falls back to per-file parsing when the batch throws, and warns only for the file that still fails",
    async () => {
      const config = await loadConfig(configPath);
      const real = createAnalysis(config.root, config.tsconfig);
      const flaky: Analysis = {
        resolve: real.resolve,
        parseProps(files) {
          if (files.length > 1) throw new Error("batch boom");
          if (files[0]?.endsWith("StatusPill.tsx")) throw new Error("boom on StatusPill");
          return real.parseProps(files);
        },
      };

      const model = await discover(config, fakeAdapter, { analysis: flaky });

      const names = model.components.map((c) => c.name).sort();
      expect(names).not.toContain("StatusPill");
      expect(names).toContain("PrimaryButton");
      expect(names).toContain("InfoCard");
      expect(names).toContain("TextInput");

      const propsWarnings = model.warnings.filter((w) => w.startsWith("Props extraction failed"));
      expect(propsWarnings).toHaveLength(1);
      expect(propsWarnings[0]).toContain("src/components/StatusPill.tsx");
    },
    120_000,
  );
});

describe("discover: monorepo workspace package", () => {
  it("finds usages of design-system components that live in a symlinked workspace package", async () => {
    // Real path: on macOS os.tmpdir() is behind a symlink, and TS hands back real paths for node_modules lookups.
    const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "loupe-mono-")));
    const write = (file: string, text: string) => {
      fs.mkdirSync(path.dirname(path.join(tmp, file)), { recursive: true });
      fs.writeFileSync(path.join(tmp, file), text);
    };
    try {
      write("packages/ui/package.json", JSON.stringify({ name: "@acme/ui", version: "0.0.0", types: "src/index.ts", main: "src/index.ts" }));
      write("packages/ui/src/index.ts", 'export { Button } from "./Button";\n');
      write("packages/ui/src/Button.tsx", "/** A button. */\nexport function Button(props: { label: string }) { return <button>{props.label}</button>; }\n");
      write("apps/web/package.json", JSON.stringify({ name: "web", private: true }));
      write("apps/web/tsconfig.json", JSON.stringify({ compilerOptions: { jsx: "react-jsx", moduleResolution: "bundler", module: "esnext", strict: true } }));
      write("apps/web/src/Page.tsx", 'import { Button } from "@acme/ui";\n\nexport const Page = () => <Button label="Go" />;\n');
      fs.mkdirSync(path.join(tmp, "apps/web/node_modules/@acme"), { recursive: true });
      fs.symlinkSync(path.join(tmp, "packages/ui"), path.join(tmp, "apps/web/node_modules/@acme/ui"), "dir");

      const root = path.join(tmp, "apps/web");
      const config = {
        name: "Mono", root, adapter: "mui", themeExport: "theme",
        componentGlobs: ["../../packages/ui/src/**/*.tsx"], ignoreGlobs: [], usageGlobs: ["src/**/*.tsx"],
        tsconfig: path.join(root, "tsconfig.json"), shims: {}, presets: [], define: {}, watch: false,
        configPath: path.join(tmp, "loupe.config.ts"), configDir: tmp,
      } as ResolvedConfig;
      const model = await discover(config, fakeAdapter);
      expect(model.components.map((c) => c.id)).toEqual(["../../packages/ui/src/Button.tsx#Button"]);
      expect(model.components[0]!.usages).toEqual([{ file: "src/Page.tsx", line: 3 }]);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }, 120_000);
});

describe("discover: reuse between runs", () => {
  const stamps = new Map([["/r/A.tsx", "1:10"], ["/r/B.tsx", "1:20"], ["/r/types.ts", "1:5"], ["/r/feature.tsx", "1:7"]]);
  const prev = { componentFiles: ["/r/A.tsx", "/r/B.tsx"], inputs: new Map([["/r/A.tsx", "1:10"], ["/r/B.tsx", "1:20"], ["/r/types.ts", "1:5"]]), docs: [], warnings: [] };
  const stampOf = (over: Record<string, string> = {}) => (f: string) => over[f] ?? stamps.get(f) ?? "missing";

  it("re-runs docgen only when a component file, or a file one imports, changed or the component list changed", () => {
    expect(needsDocgen(undefined, prev.componentFiles, stampOf())).toBe(true);
    expect(needsDocgen(prev, prev.componentFiles, stampOf())).toBe(false);
    expect(needsDocgen(prev, prev.componentFiles, stampOf({ "/r/feature.tsx": "2:7" }))).toBe(false); // usage-only file
    expect(needsDocgen(prev, prev.componentFiles, stampOf({ "/r/B.tsx": "2:21" }))).toBe(true);
    expect(needsDocgen(prev, prev.componentFiles, stampOf({ "/r/types.ts": "2:6" }))).toBe(true); // imported props type
    expect(needsDocgen(prev, ["/r/A.tsx"], stampOf())).toBe(true);
    expect(needsDocgen(prev, [...prev.componentFiles, "/r/C.tsx"], stampOf())).toBe(true);
  });

  it("reuses props and scans when nothing they depend on changed, with identical results", async () => {
    const config = await loadConfig(configPath);
    const real = createAnalysis(config.root, config.tsconfig);
    let docgenRuns = 0;
    let invalidations = 0;
    const counting: Analysis = {
      resolve: real.resolve,
      parseProps: (files) => (docgenRuns++, real.parseProps(files)),
      invalidate: () => invalidations++,
    };
    const cache = createDiscoverCache();
    const strip = (m: DiscoveryModel) => ({ ...m, generatedAt: "" });

    const first = await discover(config, fakeAdapter, { analysis: counting, cache });
    expect(docgenRuns).toBe(1);
    const second = await discover(config, fakeAdapter, { analysis: counting, cache, structural: false });
    expect(docgenRuns).toBe(1);
    expect(strip(second)).toEqual(strip(first));

    // A component file was saved: docgen runs again.
    const file = path.join(config.root, "src/components/PrimaryButton.tsx");
    const { atime, mtime } = fs.statSync(file);
    try {
      fs.utimesSync(file, atime, new Date(mtime.getTime() + 5000));
      const third = await discover(config, fakeAdapter, { analysis: counting, cache, structural: false });
      expect(docgenRuns).toBe(2);
      expect(strip(third)).toEqual(strip(first));
    } finally {
      fs.utimesSync(file, atime, mtime);
    }

    // A file was added or removed: resolution may differ, so everything is redone.
    const before = invalidations;
    await discover(config, fakeAdapter, { analysis: counting, cache, structural: true });
    expect(docgenRuns).toBe(3);
    expect(invalidations).toBe(before + 1);
  }, 120_000);
});
