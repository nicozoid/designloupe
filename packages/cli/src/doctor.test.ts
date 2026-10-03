import { it, expect } from "vitest";
import path from "node:path";
import { loadConfig } from "@designloupe/core/node";
import { runDoctor } from "./doctor";
import { REPO_ROOT } from "./paths";

it("passes on the fixture and lists every component module", async () => {
  const lines: string[] = [];
  const code = await runDoctor(await loadConfig(path.join(REPO_ROOT, "examples/fixture-loupe/loupe.config.ts")), (l) => lines.push(l));
  const out = lines.join("\n");
  expect(code).toBe(0);
  expect(out).toContain("✓ theme");
  expect(out).toContain("✓ wrapper");
  expect(out).toContain("✓ src/components/DocsLink.tsx");
  expect(out).toMatch(/9 components/);
}, 120_000);

it("fails with exit 1 and a clear message when the theme export is wrong", async () => {
  const lines: string[] = [];
  const code = await runDoctor(await loadConfig(path.join(REPO_ROOT, "packages/cli/test-fixtures/bad-theme.config.ts")), (l) => lines.push(l));
  expect(code).toBe(1);
  expect(lines.join("\n")).toMatch(/✗ theme[\s\S]*Export nope not found/);
}, 120_000);
