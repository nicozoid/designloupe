import path from "node:path";
import { createLogger, createServer, mergeConfig, searchForWorkspaceRoot, type InlineConfig, type Logger, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import fs from "node:fs";
import os from "node:os";
import { createAnalysis, createDiscoverCache, discover } from "@designloupe/core/node";
import type { ResolvedConfig } from "@designloupe/core";
import muiNode from "@designloupe/adapter-mui/node";
import { globDirs, loupePlugin, optimizeEntries } from "./vite-plugin";
import { REPO_ROOT, VIEWER_ROOT } from "./paths";
import { loupeCacheDir } from "./cache-dir";

/**
 * Vite 8 warns, on every server start, that vite-tsconfig-paths is unnecessary now that
 * `resolve.tsconfigPaths` exists natively. We keep the plugin anyway: it pins `config.tsconfig`
 * (the target's own tsconfig, possibly non-default), which the native option can't do. This
 * matches only that specific warning, so every other warning still gets through unchanged.
 */
export function isRedundantTsconfigPathsWarning(msg: string): boolean {
  const plain = msg.replace(/\x1b\[[0-9;]*m/g, "");
  return /vite-tsconfig-paths/.test(plain) && /tsconfigPaths/.test(plain);
}

function createFilteredLogger(): Logger {
  const base = createLogger();
  return {
    ...base,
    warn(msg, options) {
      if (isRedundantTsconfigPathsWarning(msg)) return;
      base.warn(msg, options);
    },
    warnOnce(msg, options) {
      if (isRedundantTsconfigPathsWarning(msg)) return;
      base.warnOnce(msg, options);
    },
  };
}

/**
 * The config folder goes into Vite's fs.allow (the wrapper and loupe files live there). If it is the home folder
 * or the filesystem root, the dev server may serve every file under it: say so.
 */
export function broadConfigDirWarning(configDir: string): string | undefined {
  const real = (p: string) => {
    try {
      return fs.realpathSync(p);
    } catch {
      return path.resolve(p);
    }
  };
  const dir = real(configDir);
  const where = dir === path.parse(dir).root ? "the filesystem root" : dir === real(os.homedir()) ? "your home folder" : undefined;
  return where
    ? `[designloupe] The config folder is ${where} (${dir}), so the dev server may serve any file under it. Move loupe.config.ts into its own folder, e.g. ~/loupe/<app>/.`
    : undefined;
}

export async function createLoupeServer(
  config: ResolvedConfig,
  opts: { port?: number; open?: boolean; middlewareMode?: boolean } = {},
): Promise<ViteDevServer> {
  const adapter = muiNode; // only adapter for now; config.adapter is validated as "mui"
  const logger = createFilteredLogger();
  const broad = broadConfigDirWarning(config.configDir);
  if (broad) logger.warn(broad);
  // One analysis (compiler options, host, resolution cache) and one cache for the server's lifetime: a save only
  // rescans changed files, and only re-runs docgen when a component file (or a file one imports) changed.
  const analysis = createAnalysis(config.root, config.tsconfig);
  const cache = createDiscoverCache();
  const rediscover = (structural: boolean) => discover(config, adapter, { analysis, cache, structural });
  const model = await rediscover(true);

  const base: InlineConfig = {
    configFile: false,
    root: VIEWER_ROOT,
    // Per target: the default (viewer/node_modules/.vite) would hand one target's prebundled React/MUI to the next.
    cacheDir: loupeCacheDir(config.root),
    logLevel: "info",
    customLogger: logger,
    clearScreen: false,
    plugins: [
      loupePlugin({ config, model, rediscover }),
      react(),
      ...(fs.existsSync(config.tsconfig) ? [tsconfigPaths({ projects: [config.tsconfig] })] : []),
    ],
    define: {
      "process.env.NODE_ENV": JSON.stringify("development"),
      "process.env": "{}",
      global: "globalThis",
      ...config.define,
    },
    server: {
      port: opts.port ?? 5179,
      open: opts.open,
      middlewareMode: opts.middlewareMode,
      // An explicit allow list replaces Vite's workspace-root default, so add the target's workspace root back (hoisted deps, linked packages).
      fs: {
        allow: [
          REPO_ROOT,
          config.root,
          searchForWorkspaceRoot(config.root),
          config.configDir,
          ...(config.loupeDir ? [config.loupeDir] : []),
          // Component globs reaching outside the target (a monorepo's ../../packages/ui/src/**).
          ...globDirs(config.componentGlobs, config.root),
        ],
      },
    },
    optimizeDeps: { entries: [path.join(VIEWER_ROOT, "index.html"), ...optimizeEntries(config, model)] },
  };
  return createServer(config.vite ? mergeConfig(base, config.vite) : base);
}
