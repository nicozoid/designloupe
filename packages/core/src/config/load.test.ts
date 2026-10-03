import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig, ConfigError } from "./load";

const dir = path.resolve(import.meta.dirname, "../../test-fixtures/config");

describe("loadConfig", () => {
  it("resolves target-relative and config-relative paths and applies defaults", async () => {
    const c = await loadConfig(path.join(dir, "good.config.ts"));
    expect(c.name).toBe("Fixture");
    expect(c.root).toBe(path.join(dir, "target"));
    expect(c.themeEntry).toBe(path.join(dir, "target/src/theme.ts"));
    expect(c.tsconfig).toBe(path.join(dir, "target/tsconfig.json"));
    expect(c.wrapper).toBe(path.join(dir, "Wrapper.tsx"));
    expect(c.shims["next/link"]).toBe(path.join(dir, "shim.tsx"));
    expect(c.shims["some-pkg"]).toBe("other-pkg"); // bare ids pass through
    expect(c.themeExport).toBe("theme");
    expect(c.adapter).toBe("mui");
    expect(c.usageGlobs).toEqual(["src/**/*.{ts,tsx,js,jsx}"]);
    expect(c.ignoreGlobs).toContain("**/*.stories.*");
    expect(c.presets).toEqual([]);
    expect(c.configDir).toBe(dir);
  });

  it("names the field when root does not exist", async () => {
    await expect(loadConfig(path.join(dir, "bad-root.config.ts"))).rejects.toMatchObject({
      name: "ConfigError",
      field: "root",
    });
  });

  it("names the field when the shape is invalid", async () => {
    const err = await loadConfig(path.join(dir, "bad-shape.config.ts")).catch((e) => e);
    expect(err).toBeInstanceOf(ConfigError);
    expect(err.field).toBe("componentGlobs");
  });

  it("fails clearly when the config file is missing", async () => {
    await expect(loadConfig(path.join(dir, "nope.config.ts"))).rejects.toMatchObject({ field: "config" });
  });

  it("lets an out-of-repo config import packages installed in this repo (e.g. vite plugins)", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "loupe-config-"));
    try {
      const file = path.join(tmp, "loupe.config.ts");
      fs.writeFileSync(
        file,
        [
          'import { defineConfig } from "@designloupe/core";',
          'import { version } from "vite";',
          'export default defineConfig({ name: `vite ${version}`, root: ".", componentGlobs: ["**/*.tsx"] });',
        ].join("\n"),
      );
      const c = await loadConfig(file);
      expect(c.name).toMatch(/^vite \d+\./);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
