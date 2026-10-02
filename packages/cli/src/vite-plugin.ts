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
const real = (p: string) => {
  try {
    return fs.realpathSync(p);
  } catch {
    return p;
  }
};
/** `file` is `dir` or inside it (a bare prefix check would count `/a/repo-config` as inside `/a/repo`). */
export const within = (file: string, dir: string) => file === dir || file.startsWith(dir + path.sep);
/** A package specifier, not a relative/absolute path or a scheme (`virtual:`, `node:`, `\0...`). */
const isBare = (s: string) => !s.startsWith(".") && !s.startsWith("\0") && !path.isAbsolute(s) && !s.includes(":");

/** Build output, caches and dot-dirs: changes there never affect discovery. */
const IGNORED_DIRS = new Set(["node_modules", "dist", "build", "out", "coverage"]);

/** Whether a watcher event for `file` should trigger rediscovery. */
export function shouldRediscover(file: string, dirs: { root: string; loupeDir?: string }): boolean {
  if (!/\.(tsx?|jsx?)$/.test(file)) return false;
  const base = [dirs.root, dirs.loupeDir].find((d): d is string => !!d && within(file, d));
  if (!base) return false;
  const segments = path.relative(base, file).split(path.sep).slice(0, -1);
  return !segments.some((d) => d.startsWith(".") || IGNORED_DIRS.has(d));
}

/** Two models describe the same thing (ignoring when they were generated). */
export function sameModel(a: DiscoveryModel, b: DiscoveryModel): boolean {
  return JSON.stringify({ ...a, generatedAt: "" }) === JSON.stringify({ ...b, generatedAt: "" });
}

export function loupePlugin(opts: { config: ResolvedConfig; model: DiscoveryModel; rediscover: () => Promise<DiscoveryModel> }): Plugin {
  const { config } = opts;
  let model = opts.model;
  // Real paths: Vite hands us symlink-resolved importers (e.g. macOS /tmp is /private/tmp).
  const root = real(config.root);
  const configDir = real(config.configDir);
  const loupeDir = config.loupeDir ? real(config.loupeDir) : undefined;
  // Importer for "resolve as if from the target". Vite only bases resolution on an importer's folder when the
  // importer exists or ends in "*" (otherwise it silently falls back to the Vite root, i.e. the viewer).
  const anchor = path.join(root, "*");
  const nm = `${path.sep}node_modules${path.sep}`;
  const inTarget = (f: string) => within(f, root) && !f.includes(nm);
  const inRepo = (f: string) => within(f, REPO_ROOT);
  /** Config folder / loupe files living outside both this repo and the target: they have no node_modules of their own. */
  const inOutsideConfig = (f: string) =>
    (within(f, configDir) || (!!loupeDir && within(f, loupeDir))) && !inRepo(f) && !within(f, root);
  const shims: Record<string, string> = {
    ...(config.presets.includes("next") ? Object.fromEntries(Object.entries(NEXT_PRESET).map(([k, f]) => [k, path.join(NEXT_SHIMS_DIR, f)])) : {}),
    ...config.shims,
  };

  const loupeFiles = () => {
    if (!loupeDir) return { docs: [] as string[], anomalies: undefined, tokens: undefined };
    const opt = { cwd: loupeDir, absolute: true, ignore: ["**/node_modules/**"] };
    return {
      docs: fg.sync("**/*.loupe.{ts,tsx}", opt).sort(),
      anomalies: fg.sync("anomalies.{ts,tsx}", opt)[0],
      tokens: fg.sync("tokens.{ts,tsx}", opt)[0],
    };
  };

  const modules: Record<string, () => string> = {
    model: () => `export default ${JSON.stringify(model)};`,
    components: () => {
      const entries = model.components.map((c) => `  ${JSON.stringify(c.id)}: ${imp(path.join(root, c.file))},`);
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
  let generation = 0;
  const watch = (server: ViteDevServer) => {
    const onChange = (file: string) => {
      if (!shouldRediscover(real(file), { root, loupeDir })) return;
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const gen = ++generation;
        let next: DiscoveryModel;
        try {
          next = await opts.rediscover();
        } catch (e) {
          server.config.logger.error(`[designloupe] rediscovery failed: ${(e as Error).message}`);
          return;
        }
        // A newer run started meanwhile: its result wins, never this older one.
        if (gen !== generation) return;
        // Ordinary edits leave the model unchanged; Vite's own HMR covers them.
        if (sameModel(next, model)) return;
        model = next;
        for (const name of Object.keys(modules)) {
          const mod = server.moduleGraph.getModuleById(`\0${PREFIX}${name}`);
          if (mod) server.moduleGraph.invalidateModule(mod);
        }
        server.ws.send({ type: "full-reload" });
      }, 300);
    };
    server.watcher.add([root, ...(loupeDir ? [loupeDir] : [])]);
    server.watcher.on("add", onChange).on("unlink", onChange).on("change", onChange);
  };

  return {
    name: "designloupe",
    enforce: "pre",
    configureServer: watch,
    configResolved(resolved) {
      // Vite resolves optimizeDeps.include ids (plugin-react adds react, react-dom, react/jsx-dev-runtime) from the
      // Vite root without running plugins, so they would be prebundled from this repo's copy, not the target's.
      // Drop them: the scanner and runtime discovery go through resolveId below and so prebundle the target's copy.
      const strip = (o?: { include?: string[] }) => {
        if (o?.include) o.include.splice(0, o.include.length, ...o.include.filter((id) => !isShared(id)));
      };
      strip(resolved.optimizeDeps);
      for (const env of Object.values(resolved.environments)) strip(env.optimizeDeps);
    },
    async resolveId(source, importer, options) {
      if (source.startsWith(PREFIX)) return `\0${source}`;
      if (source in shims) {
        const t = shims[source]!;
        return path.isAbsolute(t) ? t : this.resolve(t, anchor, { ...options, skipSelf: true });
      }
      if (source === "@target" || source.startsWith("@target/")) {
        return this.resolve(path.join(root, source.slice("@target".length)), importer, { ...options, skipSelf: true });
      }
      if (source.startsWith("@designloupe/") && importer && !inRepo(importer)) {
        return this.resolve(source, path.join(REPO_ROOT, "package.json"), { ...options, skipSelf: true });
      }
      // Out-of-repo config/loupe files import as if they lived in the target (react-i18next, @tanstack/react-query, ...).
      if (isBare(source) && importer && inOutsideConfig(importer)) {
        return this.resolve(source, anchor, { ...options, skipSelf: true });
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
