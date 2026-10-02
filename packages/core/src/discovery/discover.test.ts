import { describe, it, expect } from "vitest";
import path from "node:path";
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
