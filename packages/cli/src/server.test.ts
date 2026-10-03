import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ViteDevServer } from "vite";
import type { ResolvedConfig } from "@designloupe/core";
import { loadConfig } from "@designloupe/core/node";
import { broadConfigDirWarning, createLoupeServer, isRedundantTsconfigPathsWarning } from "./server";
import { REPO_ROOT } from "./paths";

describe("isRedundantTsconfigPathsWarning", () => {
  it("matches vite's warning about the vite-tsconfig-paths plugin being unnecessary", () => {
    const msg =
      'The plugin "vite-tsconfig-paths" is detected. Vite now supports tsconfig paths resolution natively via the resolve.tsconfigPaths option. You can remove the plugin and set resolve.tsconfigPaths: true in your Vite config instead.';
    expect(isRedundantTsconfigPathsWarning(msg)).toBe(true);
    // Colour codes (picocolors) around the message must not defeat the match.
    expect(isRedundantTsconfigPathsWarning(`\x1b[33m${msg}\x1b[39m`)).toBe(true);
  });

  it("leaves unrelated warnings alone", () => {
    expect(isRedundantTsconfigPathsWarning("Some other warning about tsconfigPaths resolution failing")).toBe(false);
    expect(isRedundantTsconfigPathsWarning('The plugin "vite-tsconfig-paths" crashed while loading')).toBe(false);
    expect(isRedundantTsconfigPathsWarning("Nothing to see here")).toBe(false);
  });
});

describe("broadConfigDirWarning", () => {
  it("warns when the config folder is the home folder or the filesystem root, since Vite may then serve all of it", () => {
    expect(broadConfigDirWarning(os.homedir())).toMatch(/home folder/);
    expect(broadConfigDirWarning(path.parse(process.cwd()).root)).toMatch(/filesystem root/);
    expect(broadConfigDirWarning(path.join(os.homedir(), "loupe", "app"))).toBeUndefined();
  });
});

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

  it("applies next preset shims, @target and @designloupe resolution", async () => {
    const link = await resolve("next/link", path.join(fixture, "src/components/DocsLink.tsx"));
    expect(link?.id).toBe(path.join(REPO_ROOT, "packages/viewer/src/shims/next/link.tsx"));
    const tgt = await resolve("@target/src/i18n", path.join(REPO_ROOT, "examples/fixture-loupe/Wrapper.tsx"));
    expect(tgt?.id).toBe(path.join(fixture, "src/i18n.ts"));
    const core = await resolve("@designloupe/core", "/tmp/elsewhere/x.loupe.tsx");
    expect(core?.id).toBe(path.join(REPO_ROOT, "packages/core/src/index.ts"));
  });
});

/**
 * A target and a config folder outside this repo. The target has its own (stub) packages, so a
 * resolution that wrongly falls back to this repo's node_modules is visible.
 */
describe("loupe server with an out-of-repo target", () => {
  let tmp: string;
  let target: string;
  let cfgDir: string;
  let srv: ViteDevServer;
  const write = (file: string, text: string) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  };
  const stubPkg = (name: string) => {
    write(path.join(target, "node_modules", name, "package.json"), JSON.stringify({ name, version: "0.0.0-stub", main: "index.js" }));
    write(path.join(target, "node_modules", name, "index.js"), "module.exports = {};\n");
  };
  /** Resolve on the client; for a prebundled dep, report the source file the optimiser bundled it from. */
  const res = async (id: string, importer: string) => {
    const r = await srv.environments.client.pluginContainer.resolveId(id, importer);
    const meta = srv.environments.client.depsOptimizer?.metadata;
    if (!r || !meta) return r;
    const file = r.id.split("?")[0];
    const dep = [...Object.values(meta.optimized), ...Object.values(meta.discovered)].find((d) => d.file === file);
    return dep ? { ...r, id: dep.src! } : r;
  };

  beforeAll(async () => {
    // Deliberately not realpath'd: on macOS os.tmpdir() is behind a symlink, which the plugin must see through.
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "loupe-target-"));
    target = path.join(tmp, "app");
    cfgDir = path.join(tmp, "app-loupe");
    write(path.join(target, "package.json"), JSON.stringify({ name: "stub-app", private: true }));
    write(path.join(target, "src/components/Hello.tsx"), "export function Hello() { return null; }\n");
    stubPkg("react");
    stubPkg("react-i18next");
    write(path.join(cfgDir, "Wrapper.tsx"), "export default function W({ children }: { children: unknown }) { return children; }\n");
    const config: ResolvedConfig = {
      name: "Stub", root: target, adapter: "mui", themeExport: "theme",
      componentGlobs: ["src/components/**/*.tsx"], ignoreGlobs: [], usageGlobs: ["src/**/*.tsx"],
      tsconfig: path.join(target, "tsconfig.json"), wrapper: path.join(cfgDir, "Wrapper.tsx"),
      shims: {}, presets: [], define: {}, watch: true,
      configPath: path.join(cfgDir, "loupe.config.ts"), configDir: cfgDir, loupeDir: cfgDir,
      // No prebundling (stubs aren't real packages) and no HMR socket (the fixture server above holds the port).
      vite: { optimizeDeps: { noDiscovery: true }, server: { ws: false } },
    };
    srv = await createLoupeServer(config, { middlewareMode: true });
  }, 120_000);
  afterAll(async () => {
    const cacheDir = srv?.config.cacheDir;
    await srv?.close();
    if (cacheDir) fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  const stub = (name: string) => path.join(fs.realpathSync(target), "node_modules", name, "index.js");

  it("gives the viewer the target's copy of shared packages", async () => {
    expect((await res("react", path.join(REPO_ROOT, "packages/viewer/src/main.tsx")))?.id).toBe(stub("react"));
  });

  it("resolves every bare import in an out-of-repo config folder from the target", async () => {
    const wrapper = path.join(fs.realpathSync(cfgDir), "Wrapper.tsx");
    expect((await res("react", wrapper))?.id).toBe(stub("react"));
    expect((await res("react-i18next", wrapper))?.id).toBe(stub("react-i18next"));
    expect((await res("@designloupe/core", wrapper))?.id).toBe(path.join(REPO_ROOT, "packages/core/src/index.ts"));
  });

  it("never prebundles shared packages via optimizeDeps.include (that path resolves from the viewer, bypassing plugins)", () => {
    const include = srv.environments.client.config.optimizeDeps.include ?? [];
    expect(include.filter((id) => /^(react|react-dom|@mui\/|@emotion\/)/.test(id))).toEqual([]);
  });

  it("keeps its dep cache per target, inside this repo", () => {
    expect(srv.config.cacheDir.startsWith(path.join(REPO_ROOT, "node_modules/.vite/loupe-"))).toBe(true);
  });
});
