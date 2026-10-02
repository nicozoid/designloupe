import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import type { ViteDevServer } from "vite";
import { loadConfig } from "@designloupe/core/node";
import { createLoupeServer } from "./server";
import { REPO_ROOT } from "./paths";

const fixture = path.join(REPO_ROOT, "examples/mui-fixture");
let server: ViteDevServer;

beforeAll(async () => {
  const config = await loadConfig(path.join(REPO_ROOT, "examples/fixture-loupe/loupe.config.ts"));
  server = await createLoupeServer(config, { middlewareMode: true });
}, 120_000);
afterAll(() => server?.close());

const resolve = (id: string, importer: string) => server.environments.client.pluginContainer.resolveId(id, importer);

describe("loupe server", () => {
  it("serves the discovery model and a lazy import per component", async () => {
    const model = (await server.ssrLoadModule("virtual:loupe/model")).default;
    expect(model.components).toHaveLength(9);
    const comps = (await server.ssrLoadModule("virtual:loupe/components")).default;
    expect(Object.keys(comps)).toContain("src/components/PrimaryButton.tsx#PrimaryButton");
    const mod = await comps["src/components/PrimaryButton.tsx#PrimaryButton"]();
    expect(typeof mod.PrimaryButton).toBe("function");
  });

  it("loads the theme, wrapper, loupe files and adapter", async () => {
    const { loadTheme } = await server.ssrLoadModule("virtual:loupe/theme");
    const theme = await loadTheme();
    expect(theme.palette).toBeDefined();
    const { loadWrapper } = await server.ssrLoadModule("virtual:loupe/wrapper");
    expect(typeof (await loadWrapper())).toBe("function");
    const files = await server.ssrLoadModule("virtual:loupe/loupe-files");
    expect(files.componentDocs).toHaveLength(2);
    expect((await files.loadAnomalies())[0].id).toBe("h001");
    expect((await files.loadTokenNotes())["palette.primary.main"]).toContain("Forest green");
    const adapter = (await server.ssrLoadModule("virtual:loupe/adapter")).default;
    expect(adapter.id).toBe("mui");
  });

  it("applies next preset shims, @target, and shared-package resolution", async () => {
    const link = await resolve("next/link", path.join(fixture, "src/components/DocsLink.tsx"));
    expect(link?.id).toBe(path.join(REPO_ROOT, "packages/viewer/src/shims/next/link.tsx"));
    const tgt = await resolve("@target/src/i18n", path.join(REPO_ROOT, "examples/fixture-loupe/Wrapper.tsx"));
    expect(tgt?.id).toBe(path.join(fixture, "src/i18n.ts"));
    const core = await resolve("@designloupe/core", "/tmp/elsewhere/x.loupe.tsx");
    expect(core?.id).toBe(path.join(REPO_ROOT, "packages/core/src/index.ts"));
    const react = await resolve("react", path.join(REPO_ROOT, "packages/viewer/src/main.tsx"));
    // The client environment hands back Vite's pre-bundled copy once the dep optimiser has run.
    expect(react?.id).toMatch(/node_modules[\\/](react[\\/]|\.vite[\\/]deps[\\/]react\.js)/);
  });
});
