import { z } from "zod";

export const PRESETS = ["next"] as const;

export const ConfigSchema = z.object({
  name: z.string().default("Design system"),
  root: z.string(),
  adapter: z.literal("mui").default("mui"),
  themeEntry: z.string().optional(),
  themeExport: z.string().default("theme"),
  componentGlobs: z.array(z.string()).min(1, "list at least one glob"),
  ignoreGlobs: z
    .array(z.string())
    .default(["**/*.test.*", "**/*.spec.*", "**/*.stories.*", "**/__tests__/**", "**/*.d.ts"]),
  usageGlobs: z.array(z.string()).default(["src/**/*.{ts,tsx,js,jsx}"]),
  tsconfig: z.string().default("tsconfig.json"),
  wrapper: z.string().optional(),
  shims: z.record(z.string(), z.string()).default({}),
  presets: z.array(z.enum(PRESETS)).default([]),
  loupeDir: z.string().optional(),
  define: z.record(z.string(), z.string()).default({}),
  vite: z.record(z.string(), z.any()).optional(),
});

/** What users write in loupe.config.ts. */
export type LoupeConfig = z.input<typeof ConfigSchema>;

/** Every path absolute; defaults applied. */
export type ResolvedConfig = Omit<z.output<typeof ConfigSchema>, "root"> & {
  root: string;
  configPath: string;
  configDir: string;
  /** absolute, or undefined when themeEntry is not set */
  themeEntry?: string;
  /** absolute; may not exist (analysis then falls back to default compiler options) */
  tsconfig: string;
  wrapper?: string;
  loupeDir?: string;
  /** module id → absolute file path or bare module id */
  shims: Record<string, string>;
};

export function defineConfig(config: LoupeConfig): LoupeConfig {
  return config;
}
