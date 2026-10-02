import path from "node:path";
import { createServer, mergeConfig, type InlineConfig, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import fs from "node:fs";
import { discover } from "@designloupe/core/node";
import type { ResolvedConfig } from "@designloupe/core";
import muiNode from "@designloupe/adapter-mui/node";
import { loupePlugin, optimizeEntries } from "./vite-plugin";
import { REPO_ROOT, VIEWER_ROOT } from "./paths";

export async function createLoupeServer(
  config: ResolvedConfig,
  opts: { port?: number; open?: boolean; middlewareMode?: boolean } = {},
): Promise<ViteDevServer> {
  const adapter = muiNode; // only adapter for now; config.adapter is validated as "mui"
  const rediscover = () => discover(config, adapter);
  const model = await rediscover();

  const base: InlineConfig = {
    configFile: false,
    root: VIEWER_ROOT,
    logLevel: "info",
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
      fs: { allow: [REPO_ROOT, config.root, config.configDir, ...(config.loupeDir ? [config.loupeDir] : [])] },
    },
    optimizeDeps: { entries: [path.join(VIEWER_ROOT, "index.html"), ...optimizeEntries(config, model)] },
  };
  return createServer(config.vite ? mergeConfig(base, config.vite) : base);
}
