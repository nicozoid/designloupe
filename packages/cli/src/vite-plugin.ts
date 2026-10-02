import fs from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import type { Plugin, ViteDevServer } from "vite";
import type { DiscoveryModel, ResolvedConfig } from "@designloupe/core";
import { NEXT_SHIMS_DIR, REPO_ROOT } from "./paths";
import { rewriteNextFontImports } from "./next-font";

/** Packages that must be a single copy shared by the viewer and the target: resolved from the target. */
const SHARED = ["react", "react-dom", "@mui/material", "@mui/system", "@mui/styled-engine", "@mui/lab", "@mui/icons-material", "@emotion/react", "@emotion/styled", "@emotion/cache"];
const isShared = (id: string) => SHARED.some((p) => id === p || id.startsWith(`${p}/`));

const NEXT_PRESET: Record<string, string> = {
  "next/link": "link.tsx",
  "next/image": "image.tsx",
  "next/navigation": "navigation.ts",
  "next/router": "router.tsx",
  "next/dynamic": "dynamic.tsx",
  "next/head": "head.tsx",
};

const PREFIX = "virtual:loupe/";
const posix = (p: string) => p.split(path.sep).join("/");
const fsUrl = (abs: string) => `/@fs${posix(abs).startsWith("/") ? "" : "/"}${posix(abs)}`;
const imp = (abs: string) => `() => import(${JSON.stringify(fsUrl(abs))})`;

export function loupePlugin(opts: { config: ResolvedConfig; model: DiscoveryModel; rediscover: () => Promise<DiscoveryModel> }): Plugin {
  const { config } = opts;
  let model = opts.model;
  const anchor = path.join(config.root, "__loupe_anchor__.js");
  const nm = `${path.sep}node_modules${path.sep}`;
  const inTarget = (f: string) => f.startsWith(config.root + path.sep) && !f.includes(nm);
  const shims: Record<string, string> = {
    ...(config.presets.includes("next") ? Object.fromEntries(Object.entries(NEXT_PRESET).map(([k, f]) => [k, path.join(NEXT_SHIMS_DIR, f)])) : {}),
    ...config.shims,
  };

  const loupeFiles = () => {
    if (!config.loupeDir) return { docs: [] as string[], anomalies: undefined, tokens: undefined };
    const opt = { cwd: config.loupeDir, absolute: true, ignore: ["**/node_modules/**"] };
    return {
      docs: fg.sync("**/*.loupe.{ts,tsx}", opt).sort(),
      anomalies: fg.sync("anomalies.{ts,tsx}", opt)[0],
      tokens: fg.sync("tokens.{ts,tsx}", opt)[0],
    };
  };

  const modules: Record<string, () => string> = {
    model: () => `export default ${JSON.stringify(model)};`,
    components: () => {
      const entries = model.components.map((c) => `  ${JSON.stringify(c.id)}: ${imp(path.join(config.root, c.file))},`);
      return `export default {\n${entries.join("\n")}\n};`;
    },
    theme: () => {
      if (!config.themeEntry) return "export const loadTheme = null;";
      const name = JSON.stringify(config.themeExport);
      return `export const loadTheme = () => import(${JSON.stringify(fsUrl(config.themeEntry))}).then((m) => {
  let t = m[${name}];
  if (t === undefined) throw new Error("Export " + ${name} + " not found in themeEntry. Available: " + Object.keys(m).join(", "));
  if (typeof t === "function" && !t.palette) t = t();
  return t;
});`;
    },
    wrapper: () =>
      config.wrapper ? `export const loadWrapper = () => import(${JSON.stringify(fsUrl(config.wrapper))}).then((m) => m.default);` : "export const loadWrapper = null;",
    "loupe-files": () => {
      const f = loupeFiles();
      const one = (p?: string) => (p ? `() => import(${JSON.stringify(fsUrl(p))}).then((m) => m.default)` : "null");
      return [
        `export const componentDocs = [${f.docs.map(imp).join(", ")}];`,
        `export const loadAnomalies = ${one(f.anomalies)};`,
        `export const loadTokenNotes = ${one(f.tokens)};`,
      ].join("\n");
    },
    adapter: () => `export { default } from "@designloupe/adapter-${config.adapter}/browser";`,
    icons: () => {
      // Library icons by per-icon module path (barrel imports are huge); custom icons come via virtual:loupe/components.
      const lib = model.icons.filter((i) => i.source === "library");
      const spec = (i: (typeof lib)[number]) => (i.importPath.endsWith(`/${i.name}`) ? i.importPath : `${i.importPath}/${i.name}`);
      const entries = lib.map((i) => `  ${JSON.stringify(i.name)}: () => import(${JSON.stringify(spec(i))}),`);
      return `export default {\n${entries.join("\n")}\n};`;
    },
    "next-font": () => `export const loupeFont = () => ({ className: "", variable: "", style: { fontFamily: "inherit" } });`,
  };

  let timer: NodeJS.Timeout | undefined;
  const watch = (server: ViteDevServer) => {
    const onChange = (file: string) => {
      if (!/\.(tsx?|jsx?)$/.test(file)) return;
      const inLoupe = config.loupeDir && file.startsWith(config.loupeDir + path.sep);
      if (!inTarget(file) && !inLoupe) return;
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          model = await opts.rediscover();
        } catch (e) {
          server.config.logger.error(`[designloupe] rediscovery failed: ${(e as Error).message}`);
          return;
        }
        for (const name of Object.keys(modules)) {
          const mod = server.moduleGraph.getModuleById(`\0${PREFIX}${name}`);
          if (mod) server.moduleGraph.invalidateModule(mod);
        }
        server.ws.send({ type: "full-reload" });
      }, 300);
    };
    server.watcher.add([config.root, ...(config.loupeDir ? [config.loupeDir] : [])]);
    server.watcher.on("add", onChange).on("unlink", onChange).on("change", onChange);
  };

  return {
    name: "designloupe",
    enforce: "pre",
    configureServer: watch,
    async resolveId(source, importer, options) {
      if (source.startsWith(PREFIX)) return `\0${source}`;
      if (source in shims) {
        const t = shims[source]!;
        return path.isAbsolute(t) ? t : this.resolve(t, anchor, { ...options, skipSelf: true });
      }
      if (source === "@target" || source.startsWith("@target/")) {
        return this.resolve(path.join(config.root, source.slice("@target".length)), importer, { ...options, skipSelf: true });
      }
      if (source.startsWith("@designloupe/") && importer && !importer.startsWith(REPO_ROOT)) {
        return this.resolve(source, path.join(REPO_ROOT, "package.json"), { ...options, skipSelf: true });
      }
      // Virtual modules count as "not target" too, so e.g. virtual:loupe/icons gets the target's @mui/icons-material.
      if (isShared(source) && importer && !inTarget(importer)) {
        return this.resolve(source, anchor, { ...options, skipSelf: true });
      }
      return null;
    },
    load(id) {
      if (!id.startsWith(`\0${PREFIX}`)) return null;
      const make = modules[id.slice(1 + PREFIX.length)];
      return make ? make() : null;
    },
    transform(code, id) {
      if (!config.presets.includes("next") || id.includes(nm)) return null;
      const out = rewriteNextFontImports(code);
      return out ? { code: out, map: null } : null;
    },
  };
}

export function optimizeEntries(config: ResolvedConfig, model: DiscoveryModel): string[] {
  const files = [
    ...model.components.map((c) => path.join(config.root, c.file)),
    ...(config.themeEntry ? [config.themeEntry] : []),
    ...(config.wrapper ? [config.wrapper] : []),
  ];
  return [...new Set(files)].filter((f) => fs.existsSync(f));
}
