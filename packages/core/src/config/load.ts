import fs from "node:fs";
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

export async function loadConfig(configPath: string): Promise<ResolvedConfig> {
  const abs = path.resolve(configPath);
  if (!fs.existsSync(abs)) throw new ConfigError("config", `file not found: ${abs}`);
  const configDir = path.dirname(abs);

  // Config files may live outside this repo, so `@designloupe/core` is aliased explicitly.
  const jiti = createJiti(import.meta.url, { alias: { "@designloupe/core": CORE_ENTRY }, moduleCache: false });
  let raw: unknown;
  try {
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
