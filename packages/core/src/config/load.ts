import fs from "node:fs";
import { isBuiltin } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { ConfigSchema, type ResolvedConfig } from "./schema";

export class ConfigError extends Error {
  override name = "ConfigError";
  constructor(public field: string, message: string) {
    super(`${field}: ${message}`);
  }
}

const CORE_ENTRY = fileURLToPath(new URL("../index.ts", import.meta.url));

const isRelativeOrAbsolute = (p: string) => p.startsWith(".") || path.isAbsolute(p);

/** Bare specifiers the config file imports (`from "x"`, `import("x")`, `require("x")`, `import "x"`). */
function bareImports(text: string): string[] {
  const re = /\bfrom\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)|\brequire\s*\(\s*["']([^"']+)["']\s*\)|\bimport\s*["']([^"']+)["']/g;
  const out = new Set<string>();
  for (const m of text.matchAll(re)) {
    const spec = m[1] ?? m[2] ?? m[3] ?? m[4]!;
    if (!isRelativeOrAbsolute(spec) && !spec.includes(":") && !isBuiltin(spec)) out.add(spec);
  }
  return [...out];
}

const packageName = (spec: string) => spec.split("/").slice(0, spec.startsWith("@") ? 2 : 1).join("/");

/** Whether `node_modules/<pkg>` exists in `dir` or any folder above it. */
function packageVisibleFrom(pkg: string, dir: string): boolean {
  for (let d = dir; ; d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, "node_modules", pkg, "package.json"))) return true;
    if (path.dirname(d) === d) return false;
  }
}

/**
 * Config folders usually live outside this repo, with no node_modules of their own, yet the docs tell users to
 * install Vite plugins (vite-plugin-svgr, ...) here. Packages the config imports that aren't visible from its
 * folder are loaded from this repo instead and handed to jiti as pre-loaded modules.
 */
async function packagesFromThisRepo(configFile: string): Promise<Record<string, unknown>> {
  const dir = path.dirname(configFile);
  const out: Record<string, unknown> = {};
  for (const spec of bareImports(fs.readFileSync(configFile, "utf8"))) {
    if (spec === "@designloupe/core" || packageVisibleFrom(packageName(spec), dir)) continue;
    try {
      out[spec] = await import(spec); // resolves from this package, i.e. this repo's node_modules
    } catch {
      // Not here either: leave it to jiti, whose "Cannot find module" names it.
    }
  }
  return out;
}

export async function loadConfig(configPath: string): Promise<ResolvedConfig> {
  const abs = path.resolve(configPath);
  if (!fs.existsSync(abs)) throw new ConfigError("config", `file not found: ${abs}`);
  const configDir = path.dirname(abs);

  // Config files may live outside this repo, so `@designloupe/core` is aliased explicitly.
  let raw: unknown;
  try {
    const jiti = createJiti(import.meta.url, {
      alias: { "@designloupe/core": CORE_ENTRY },
      virtualModules: await packagesFromThisRepo(abs),
      moduleCache: false,
    });
    raw = await jiti.import(abs, { default: true });
  } catch (e) {
    throw new ConfigError("config", `could not load ${abs}: ${(e as Error).message}`);
  }

  const parsed = ConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    throw new ConfigError(String(issue.path[0] ?? "config"), issue.message);
  }
  const c = parsed.data;

  const fromConfig = (p: string) => path.resolve(configDir, p);
  const root = fromConfig(c.root);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new ConfigError("root", `directory not found: ${root}`);
  }
  const fromRoot = (p: string) => path.resolve(root, p);

  const themeEntry = c.themeEntry ? fromRoot(c.themeEntry) : undefined;
  if (themeEntry && !fs.existsSync(themeEntry)) throw new ConfigError("themeEntry", `file not found: ${themeEntry}`);
  const wrapper = c.wrapper ? fromConfig(c.wrapper) : undefined;
  if (wrapper && !fs.existsSync(wrapper)) throw new ConfigError("wrapper", `file not found: ${wrapper}`);
  const loupeDir = c.loupeDir ? fromConfig(c.loupeDir) : undefined;
  if (loupeDir && !fs.existsSync(loupeDir)) throw new ConfigError("loupeDir", `directory not found: ${loupeDir}`);

  const shims = Object.fromEntries(
    Object.entries(c.shims).map(([id, target]) => [id, isRelativeOrAbsolute(target) ? fromConfig(target) : target]),
  );

  return { ...c, root, configPath: abs, configDir, themeEntry, tsconfig: fromRoot(c.tsconfig), wrapper, loupeDir, shims };
}
