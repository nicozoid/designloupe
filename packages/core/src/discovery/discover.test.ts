import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ResolvedConfig } from "../config/schema";
import { loadConfig } from "../config/load";
import { createAnalysis, type Analysis } from "../analysis/program";
import type { AdapterNode } from "../adapter";
import { discover } from "./discover";

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
        tsconfig: path.join(root, "tsconfig.json"), shims: {}, presets: [], define: {},
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
