# Design Loupe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local CLI (`designloupe dev --config …`) that serves a browser viewer of a MUI-based React app's design system: tokens, theme overrides, components, icons and anomalies. It reads the target repo in place and never modifies it.

**Architecture:**
- An npm-workspaces monorepo.
- `core` holds the generic model, config, discovery and maths. `adapter-mui` holds everything MUI-specific. `viewer` is a Vite + React UI with plain-CSS chrome. `cli` starts Vite with a plugin that exposes the discovery model and target modules as virtual modules.
- Shared packages (react, MUI, emotion) resolve from the target's `node_modules`.
- `examples/mui-fixture` is the realistic test target. `examples/fixture-loupe` is its Loupe config folder.

**Tech Stack:** Node 24, npm workspaces, TypeScript 6.0.3 (pinned), React 19, MUI 9 (`@mui/material` 9.x), Vite 8, `@vitejs/plugin-react` 6, `vite-tsconfig-paths` 6, `react-docgen-typescript` 2.4, zod 4, jiti 2, cac 7, fast-glob 3, Vitest 5, Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-10-02-design-loupe-design.md`. Read it, including **Plan-time amendments**, which override earlier sections.

## Global Constraints

- **Local only.** Never write into the target repo. All generated state lives in memory or in this repo.
- **TypeScript is `6.0.3` exactly, repo-wide** (root devDependency). Do not add TypeScript to any workspace package. TS 7 lacks the JS compiler API.
- **No Tailwind, no shadcn, no cva.** Viewer chrome is plain CSS with `dl-`-prefixed classes and `--dl-*` custom properties.
- **The viewer imports target code only through `virtual:loupe/*` modules.** Only `adapter-mui` imports `@mui/*`; `core` and `viewer` never do.
- **`@designloupe/core` (the `.` export) must stay browser-safe:** no `node:*`, `fs`, `typescript` or `fast-glob` imports. Node-only code goes in `@designloupe/core/node`.
- **Packages ship TypeScript source** (`exports` point at `src/*.ts`). There is no build step; the CLI runs via `tsx`.
- **Licence MIT.** Package scope `@designloupe/*`, all `"private": true` for now.
- **Copy voice:** plain, specific, British spelling in UI copy ("colour"), as in the trains2somewhere design-system `CLAUDE.md`.
- **Commits:** small, one per task minimum. End every commit message with:
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`

---

## File structure

```
designloupe/
├─ package.json                 # workspaces, scripts, root devDeps (typescript 6.0.3, vitest, tsx, @playwright/test)
├─ tsconfig.base.json / tsconfig.json
├─ vitest.config.ts  playwright.config.ts  .gitignore  LICENSE  README.md  CLAUDE.md
├─ packages/
│  ├─ core/
│  │  ├─ package.json          # exports "." and "./node"
│  │  └─ src/
│  │     ├─ index.ts            # browser-safe barrel
│  │     ├─ node.ts             # node barrel
│  │     ├─ model.ts            # DiscoveryModel, ComponentInfo, PropInfo, … (shared types)
│  │     ├─ adapter.ts          # AdapterNode, AdapterBrowser, TokenModel, OverrideEntry, Mode
│  │     ├─ loupe-files.ts      # defineComponentDoc, defineAnomalies, defineTokenNotes + types
│  │     ├─ config/schema.ts    # zod schema, defineConfig, LoupeConfig, ResolvedConfig
│  │     ├─ config/load.ts      # loadConfig(path) → ResolvedConfig (jiti), ConfigError
│  │     ├─ analysis/program.ts # createAnalysis(root, tsconfig) → resolver + docgen parser
│  │     ├─ analysis/scan-file.ts  # scanSource() → imports, JSX tags, styled targets, exports
│  │     ├─ discovery/discover.ts  # discover(config, adapterNode) → DiscoveryModel
│  │     ├─ discovery/props.ts     # docgen ComponentDoc → PropInfo[]
│  │     ├─ anomalies/codes.ts     # anomalyCode(), fnv1a
│  │     ├─ anomalies/static-rules.ts # findStaticIssues(file, text) → StaticFinding[]
│  │     ├─ anomalies/merge.ts     # mergeAnomalies(auto, authored) → AnomalyRow[]
│  │     ├─ anomalies/meta.ts      # categoryInfo, statusInfo
│  │     ├─ a11y/a11y.ts  a11y/wcag-meta.ts   # ported from trains2somewhere
│  │     └─ demo/plan.ts           # planAutoDemo(component) → DemoPlan
│  ├─ adapter-mui/
│  │  └─ src/ node.ts  browser.tsx  tokens.ts  overrides.ts  serialise.ts
│  ├─ viewer/
│  │  ├─ index.html
│  │  └─ src/ main.tsx  App.tsx  router.ts  state.tsx  styles.css  virtual.d.ts
│  │        shell/ Shell.tsx Sidebar.tsx
│  │        ui/ CopyChip.tsx Panel.tsx Badge.tsx PageHeader.tsx Preview.tsx ErrorCard.tsx to-hex.ts
│  │        pages/ Overview.tsx Colour.tsx Typography.tsx Layout.tsx Elevation.tsx Motion.tsx
│  │               Overrides.tsx Components.tsx ComponentSection.tsx AutoDemo.tsx
│  │               LibraryUsage.tsx Icons.tsx Anomalies.tsx Search.tsx
│  │        shims/next/ link.tsx image.tsx navigation.ts router.ts dynamic.tsx head.tsx font.ts
│  └─ cli/
│     └─ src/ bin.ts  server.ts  vite-plugin.ts  doctor.ts  paths.ts
├─ examples/
│  ├─ mui-fixture/              # the target app (runnable on its own: npm run dev -w mui-fixture)
│  └─ fixture-loupe/            # loupe.config.ts, Wrapper.tsx, loupe files for the fixture
├─ e2e/viewer.spec.ts
└─ docs/ config.md loupe-files.md adapters.md claude/onboarding-a-target.md
```

---

### Task 1: Monorepo scaffold and config loading

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `LICENSE`
- Create: `packages/core/package.json`, `packages/core/src/index.ts`, `packages/core/src/node.ts`
- Create: `packages/core/src/config/schema.ts`, `packages/core/src/config/load.ts`
- Create: `packages/adapter-mui/package.json`, `packages/viewer/package.json`, `packages/cli/package.json` (stubs filled in later tasks)
- Test: `packages/core/src/config/load.test.ts`, fixtures in `packages/core/test-fixtures/config/`

**Interfaces:**
- Produces:
  - `defineConfig(c: LoupeConfig): LoupeConfig`
  - `loadConfig(configPath: string): Promise<ResolvedConfig>`
  - `class ConfigError extends Error { field: string }`
  - `type ResolvedConfig` (fields below)

- [ ] **Step 1: Root scaffold**

`package.json`:
```json
{
  "name": "designloupe",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*", "examples/*"],
  "scripts": {
    "loupe": "tsx packages/cli/src/bin.ts",
    "loupe:fixture": "tsx packages/cli/src/bin.ts dev --config examples/fixture-loupe/loupe.config.ts",
    "doctor:fixture": "tsx packages/cli/src/bin.ts doctor --config examples/fixture-loupe/loupe.config.ts",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "devDependencies": {
    "typescript": "6.0.3",
    "vitest": "^5.0.3",
    "tsx": "^4.23.15",
    "@playwright/test": "^1.63.0",
    "@types/node": "^24.0.0",
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0"
  },
  "engines": { "node": ">=22" }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "allowImportingTsExtensions": false,
    "types": ["node"]
  }
}
```

`tsconfig.json`:
```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": { "noEmit": true, "types": ["node", "vite/client"] },
  "include": [
    "packages/*/src", "e2e", "vitest.config.ts", "playwright.config.ts",
    "examples/mui-fixture/src/theme/augment.d.ts", "examples/mui-fixture/src/next-env.d.ts"
  ]
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.{ts,tsx}"],
    environment: "node",
    testTimeout: 60_000,
  },
});
```

`.gitignore`:
```
node_modules
dist
.DS_Store
test-results
playwright-report
*.log
```

`LICENSE`: the standard MIT text, `Copyright (c) 2026 Nicolas Holzapfel`.

`packages/core/package.json`:
```json
{
  "name": "@designloupe/core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts", "./node": "./src/node.ts" },
  "dependencies": {
    "zod": "^4.6.5",
    "jiti": "^2.7.0",
    "fast-glob": "^3.3.3",
    "react-docgen-typescript": "^2.4.0"
  },
  "peerDependencies": { "react": ">=18" }
}
```

Stub packages. They're filled later, but they must exist so `npm i` links them.

`packages/adapter-mui/package.json`:
```json
{
  "name": "@designloupe/adapter-mui",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": { "./node": "./src/node.ts", "./browser": "./src/browser.tsx" },
  "dependencies": { "@designloupe/core": "0.1.0" },
  "peerDependencies": { "@mui/material": ">=7", "@emotion/react": ">=11", "@emotion/styled": ">=11", "react": ">=18" },
  "devDependencies": { "@mui/material": "^9.4.0", "@emotion/react": "^11.14.0", "@emotion/styled": "^11.14.1", "react": "^19.3.0", "react-dom": "^19.3.0" }
}
```

`packages/viewer/package.json`:
```json
{
  "name": "@designloupe/viewer",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "dependencies": { "@designloupe/core": "0.1.0", "@designloupe/adapter-mui": "0.1.0" },
  "devDependencies": { "react": "^19.3.0", "react-dom": "^19.3.0" }
}
```

`packages/cli/package.json`:
```json
{
  "name": "@designloupe/cli",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": { "designloupe": "./src/bin.ts" },
  "dependencies": {
    "@designloupe/core": "0.1.0",
    "@designloupe/adapter-mui": "0.1.0",
    "@designloupe/viewer": "0.1.0",
    "vite": "^8.3.2",
    "@vitejs/plugin-react": "^6.1.1",
    "vite-tsconfig-paths": "^6.1.1",
    "cac": "^7.0.0",
    "fast-glob": "^3.3.3"
  }
}
```

Create empty barrels `packages/core/src/index.ts` and `packages/core/src/node.ts` (filled in Step 3).

Run: `npm install`
Expected: installs without errors. `ls node_modules/@designloupe` shows `adapter-mui cli core viewer`.

- [ ] **Step 2: Write the failing tests**

Create `packages/core/test-fixtures/config/target/tsconfig.json` containing `{}`. Also create `packages/core/test-fixtures/config/target/src/theme.ts` containing `export const theme = {};`.

`packages/core/test-fixtures/config/good.config.ts`:
```ts
import { defineConfig } from "@designloupe/core";

export default defineConfig({
  name: "Fixture",
  root: "./target",
  themeEntry: "src/theme.ts",
  componentGlobs: ["src/**/*.tsx"],
  wrapper: "./Wrapper.tsx",
  shims: { "next/link": "./shim.tsx", "some-pkg": "other-pkg" },
});
```
Also create empty `packages/core/test-fixtures/config/Wrapper.tsx` (`export default ({ children }: any) => children;`) and `shim.tsx` (`export default () => null;`).

`packages/core/test-fixtures/config/bad-root.config.ts`:
```ts
export default { root: "./does-not-exist", componentGlobs: ["src/**/*.tsx"] };
```

`packages/core/test-fixtures/config/bad-shape.config.ts`:
```ts
export default { root: "./target", componentGlobs: [] };
```

`packages/core/src/config/load.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import path from "node:path";
import { loadConfig, ConfigError } from "./load";

const dir = path.resolve(import.meta.dirname, "../../test-fixtures/config");

describe("loadConfig", () => {
  it("resolves target-relative and config-relative paths and applies defaults", async () => {
    const c = await loadConfig(path.join(dir, "good.config.ts"));
    expect(c.name).toBe("Fixture");
    expect(c.root).toBe(path.join(dir, "target"));
    expect(c.themeEntry).toBe(path.join(dir, "target/src/theme.ts"));
    expect(c.tsconfig).toBe(path.join(dir, "target/tsconfig.json"));
    expect(c.wrapper).toBe(path.join(dir, "Wrapper.tsx"));
    expect(c.shims["next/link"]).toBe(path.join(dir, "shim.tsx"));
    expect(c.shims["some-pkg"]).toBe("other-pkg"); // bare ids pass through
    expect(c.themeExport).toBe("theme");
    expect(c.adapter).toBe("mui");
    expect(c.usageGlobs).toEqual(["src/**/*.{ts,tsx,js,jsx}"]);
    expect(c.ignoreGlobs).toContain("**/*.stories.*");
    expect(c.presets).toEqual([]);
    expect(c.configDir).toBe(dir);
  });

  it("names the field when root does not exist", async () => {
    await expect(loadConfig(path.join(dir, "bad-root.config.ts"))).rejects.toMatchObject({
      name: "ConfigError",
      field: "root",
    });
  });

  it("names the field when the shape is invalid", async () => {
    const err = await loadConfig(path.join(dir, "bad-shape.config.ts")).catch((e) => e);
    expect(err).toBeInstanceOf(ConfigError);
    expect(err.field).toBe("componentGlobs");
  });

  it("fails clearly when the config file is missing", async () => {
    await expect(loadConfig(path.join(dir, "nope.config.ts"))).rejects.toMatchObject({ field: "config" });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run packages/core/src/config`
Expected: FAIL, because `./load` cannot be resolved.

- [ ] **Step 4: Implement the schema and loader**

`packages/core/src/config/schema.ts`:
```ts
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
```

`packages/core/src/config/load.ts`:
```ts
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
```

`packages/core/src/node.ts`:
```ts
export { loadConfig, ConfigError } from "./config/load";
```

`packages/core/src/index.ts`:
```ts
export { defineConfig } from "./config/schema";
export type { LoupeConfig, ResolvedConfig } from "./config/schema";
```

Note: `schema.ts` imports zod, which is browser-safe. `load.ts` is Node-only and is exported only from `node.ts`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run packages/core/src/config`
Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold monorepo; feat(core): config schema and loader"
```

---

### Task 2: The MUI fixture app and its Loupe config folder

This is the test target for every later task. It deliberately includes awkward cases.

**Files:**
- Create: `examples/mui-fixture/{package.json,tsconfig.json,vite.config.ts,index.html}`
- Create: `examples/mui-fixture/src/{main.tsx,App.tsx,i18n.ts,next-env.d.ts}`
- Create: `examples/mui-fixture/src/theme/{index.ts,augment.d.ts}`
- Create: `examples/mui-fixture/src/components/{PrimaryButton.tsx,TextInput.tsx,InfoCard.tsx,StatusPill.tsx,EmptyState.tsx,NavLinkButton.tsx,DocsLink.tsx,Broken.tsx}`
- Create: `examples/mui-fixture/src/components/icons/SparkIcon.tsx`
- Create: `examples/mui-fixture/src/features/{Dashboard.tsx,Settings.tsx}`
- Create: `examples/fixture-loupe/{loupe.config.ts,Wrapper.tsx,anomalies.ts,tokens.ts,tsconfig.json}`
- Create: `examples/fixture-loupe/components/{PrimaryButton.loupe.tsx,InfoCard.loupe.tsx}`

**Interfaces:**
- Produces the facts later tests assert. Keep these exact:
  - **9 components:** PrimaryButton (wraps Button), TextInput (wraps TextField), InfoCard (wraps Card; built from own StatusPill), StatusPill (custom), EmptyState (custom; needs i18n), NavLinkButton (wraps Button; needs router), DocsLink (custom; imports `next/link`), Broken (custom; throws), SparkIcon (wraps SvgIcon; icon).
  - **PrimaryButton** has 3 call sites: Settings ×2, Dashboard ×1.
  - **Raw MUI usage in `src/features/Dashboard.tsx`:** Button, Chip, Stack.
  - **Icons:** `Delete` (from `@mui/icons-material/Delete`) and `SparkIcon` (custom).
  - **Static findings:**
    - StatusPill: colour literal `#e8f5e9`, px spacing `6px`.
    - Dashboard: colour literal `rgb(10, 20, 30)`.
  - **Theme:**
    - `colorSchemes` light and dark, `cssVariables` with `colorSchemeSelector: "class"`;
    - custom palette key `brand`; custom typography variant `eyebrow`;
    - overrides for MuiButton (defaultProps, styleOverrides, custom `dashed` variant), MuiCard and MuiTextField;
    - light `warning` main `#f5c518` with contrastText `#ffffff`, a planted contrast failure.

- [ ] **Step 1: Fixture package and app shell**

`examples/mui-fixture/package.json`:
```json
{
  "name": "mui-fixture",
  "private": true,
  "type": "module",
  "scripts": { "dev": "vite", "typecheck": "tsc -p tsconfig.json --noEmit" },
  "dependencies": {
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.1",
    "@mui/icons-material": "^9.4.0",
    "@mui/material": "^9.4.0",
    "i18next": "^26.4.2",
    "react": "^19.3.0",
    "react-dom": "^19.3.0",
    "react-i18next": "^17.0.15",
    "react-router-dom": "^7.18.4"
  },
  "devDependencies": { "vite": "^8.3.2", "@vitejs/plugin-react": "^6.1.1" }
}
```

`examples/mui-fixture/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["src/*"] }, "types": ["vite/client"] },
  "include": ["src"]
}
```

`examples/mui-fixture/vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
});
```

`examples/mui-fixture/index.html`:
```html
<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8" /><title>MUI fixture</title></head>
  <body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>
```

`examples/mui-fixture/src/next-env.d.ts` (`next` is deliberately not installed; Loupe shims it):
```ts
declare module "next/link" {
  import type { AnchorHTMLAttributes, ReactElement, ReactNode } from "react";
  const Link: (props: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }) => ReactElement;
  export default Link;
}
```

`examples/mui-fixture/src/i18n.ts`:
```ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

i18n.use(initReactI18next).init({
  lng: "en",
  resources: { en: { translation: { empty: { title: "Nothing here yet", body: "Items you add will appear here." } } } },
  interpolation: { escapeValue: false },
});

export default i18n;
```

`examples/mui-fixture/src/main.tsx`:
```tsx
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { theme } from "@/theme";
import "@/i18n";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <BrowserRouter><App /></BrowserRouter>
  </ThemeProvider>,
);
```

`examples/mui-fixture/src/App.tsx`:
```tsx
import { Dashboard } from "@/features/Dashboard";
import { Settings } from "@/features/Settings";

export default function App() {
  return (<><Dashboard /><Settings /></>);
}
```

- [ ] **Step 2: Theme**

`examples/mui-fixture/src/theme/augment.d.ts`:
```ts
import type { CSSProperties } from "react";
import "@mui/material/styles";
import "@mui/material/Button";

declare module "@mui/material/styles" {
  interface Palette { brand: Palette["primary"] }
  interface PaletteOptions { brand?: PaletteOptions["primary"] }
  interface TypographyVariants { eyebrow: CSSProperties }
  interface TypographyVariantsOptions { eyebrow?: CSSProperties }
}
declare module "@mui/material/Typography" {
  interface TypographyPropsVariantOverrides { eyebrow: true }
}
declare module "@mui/material/Button" {
  interface ButtonPropsVariantOverrides { dashed: true }
}
```

`examples/mui-fixture/src/theme/index.ts`:
```ts
import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: "class" },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: "#2f6544", contrastText: "#f7f4ec" },
        secondary: { main: "#5b4b8a" },
        brand: { main: "#c2410c", light: "#fb923c", dark: "#9a3412", contrastText: "#ffffff" },
        // Planted failure: white on yellow is ~1.6:1.
        warning: { main: "#f5c518", contrastText: "#ffffff" },
        background: { default: "#f2efe6", paper: "#ffffff" },
      },
    },
    dark: {
      palette: {
        primary: { main: "#8fd1a8", contrastText: "#10261a" },
        secondary: { main: "#b9a8ee" },
        brand: { main: "#fb923c", light: "#fdba74", dark: "#c2410c", contrastText: "#1c1917" },
        background: { default: "#121412", paper: "#1b1e1b" },
      },
    },
  },
  typography: {
    fontFamily: "Inter, system-ui, sans-serif",
    h1: { fontSize: "2.5rem", fontWeight: 700, letterSpacing: "-0.02em" },
    eyebrow: { fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { textTransform: "none", fontWeight: 600 } },
      variants: [
        {
          props: { variant: "dashed" },
          style: ({ theme }) => ({ border: `1px dashed ${theme.palette.primary.main}` }),
        },
      ],
    },
    MuiCard: { defaultProps: { variant: "outlined" } },
    MuiTextField: { defaultProps: { size: "small", fullWidth: true } },
  },
});
```

- [ ] **Step 3: Components**

`src/components/PrimaryButton.tsx`:
```tsx
import Button, { type ButtonProps } from "@mui/material/Button";

export interface PrimaryButtonProps extends ButtonProps {
  /** Brand uses the brand palette; neutral uses primary. */
  tone?: "brand" | "neutral";
}

/** The main call-to-action button. */
export function PrimaryButton({ tone = "neutral", ...rest }: PrimaryButtonProps) {
  return <Button variant="contained" color={tone === "brand" ? "brand" as never : "primary"} {...rest} />;
}
```

`src/components/TextInput.tsx`:
```tsx
import { TextField } from "@mui/material";

export interface TextInputProps {
  /** Visible label. */
  label: string;
  helperText?: string;
  type?: "text" | "email" | "password";
}

/** Single-line text input with the house defaults. */
export function TextInput({ label, helperText, type = "text" }: TextInputProps) {
  return <TextField label={label} helperText={helperText} type={type} />;
}
```

`src/components/StatusPill.tsx`:
```tsx
import { Box } from "@mui/material";

export interface StatusPillProps {
  status: "ok" | "warn" | "error";
  label: string;
}

/** Small status indicator. */
export function StatusPill({ status, label }: StatusPillProps) {
  return (
    <Box
      component="span"
      // Planted anomalies: hard-coded colour and px spacing.
      sx={{ bgcolor: "#e8f5e9", px: "6px", borderRadius: 1, fontSize: 12, opacity: status === "error" ? 0.6 : 1 }}
    >
      {label}
    </Box>
  );
}
```

`src/components/InfoCard.tsx`:
```tsx
import { Card, CardContent, Typography } from "@mui/material";
import { StatusPill } from "./StatusPill";

export interface InfoCardProps {
  title: string;
  body?: string;
  status?: "ok" | "warn" | "error";
}

/** Summary card with an optional status pill. */
export function InfoCard({ title, body, status }: InfoCardProps) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6">{title}</Typography>
        {body && <Typography variant="body2">{body}</Typography>}
        {status && <StatusPill status={status} label={status} />}
      </CardContent>
    </Card>
  );
}
```

`src/components/EmptyState.tsx`:
```tsx
import { Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

/** Placeholder for empty lists. Needs i18n context. */
export function EmptyState() {
  const { t } = useTranslation();
  return (
    <Stack spacing={1} alignItems="center">
      <Typography variant="h6">{t("empty.title")}</Typography>
      <Typography variant="body2">{t("empty.body")}</Typography>
    </Stack>
  );
}
```

`src/components/NavLinkButton.tsx`:
```tsx
import type { ReactNode } from "react";
import Button from "@mui/material/Button";
import { useNavigate } from "react-router-dom";

export interface NavLinkButtonProps {
  to: string;
  children: ReactNode;
}

/** Button that navigates. Needs router context. */
export function NavLinkButton({ to, children }: NavLinkButtonProps) {
  const navigate = useNavigate();
  return <Button onClick={() => navigate(to)}>{children}</Button>;
}
```

`src/components/DocsLink.tsx`:
```tsx
import type { ReactNode } from "react";
import NextLink from "next/link";

export interface DocsLinkProps {
  href: string;
  children: ReactNode;
}

/** Link to docs. Imports next/link, which Loupe must shim. */
export function DocsLink({ href, children }: DocsLinkProps) {
  return <NextLink href={href}>{children}</NextLink>;
}
```

`src/components/Broken.tsx`:
```tsx
import type { ReactElement } from "react";

/** Throws on render so the viewer's error boundary can be tested. */
export function Broken(): ReactElement {
  throw new Error("Broken on purpose");
}
```

`src/components/icons/SparkIcon.tsx`:
```tsx
import SvgIcon, { type SvgIconProps } from "@mui/material/SvgIcon";

/** House icon: a small spark. */
export function SparkIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M12 2l2.4 7.2H22l-6 4.4 2.3 7.4L12 16.6 5.7 21l2.3-7.4-6-4.4h7.6z" />
    </SvgIcon>
  );
}
```

- [ ] **Step 4: Feature files (usage, raw MUI, icons, a styled literal)**

`src/features/Dashboard.tsx`:
```tsx
import { Button, Chip, Stack } from "@mui/material";
import { styled } from "@mui/material/styles";
import DeleteIcon from "@mui/icons-material/Delete";
import { PrimaryButton } from "@/components/PrimaryButton";
import { InfoCard } from "@/components/InfoCard";
import { SparkIcon } from "@/components/icons/SparkIcon";

const Note = styled("div")({ color: "rgb(10, 20, 30)" });

export function Dashboard() {
  return (
    <Stack spacing={2}>
      <InfoCard title="Today" body="3 trips" status="ok" />
      <Chip label="beta" />
      <Button startIcon={<DeleteIcon />}>Remove</Button>
      <PrimaryButton startIcon={<SparkIcon />}>Plan trip</PrimaryButton>
      <Note>Raw MUI usage lives here on purpose.</Note>
    </Stack>
  );
}
```

`src/features/Settings.tsx`:
```tsx
import { PrimaryButton } from "@/components/PrimaryButton";
import { TextInput } from "@/components/TextInput";
import { EmptyState } from "@/components/EmptyState";

export function Settings() {
  return (
    <form>
      <TextInput label="Email" type="email" />
      <EmptyState />
      <PrimaryButton type="submit">Save</PrimaryButton>
      <PrimaryButton tone="brand">Upgrade</PrimaryButton>
    </form>
  );
}
```

- [ ] **Step 5: The fixture's Loupe folder**

`examples/fixture-loupe/loupe.config.ts`:
```ts
import { defineConfig } from "@designloupe/core";

export default defineConfig({
  name: "MUI fixture",
  root: "../mui-fixture",
  themeEntry: "src/theme/index.ts",
  themeExport: "theme",
  componentGlobs: ["src/components/**/*.tsx"],
  usageGlobs: ["src/**/*.{ts,tsx}"],
  tsconfig: "tsconfig.json",
  wrapper: "./Wrapper.tsx",
  presets: ["next"],
  loupeDir: ".",
});
```

`examples/fixture-loupe/Wrapper.tsx`:
```tsx
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "@target/src/i18n";

/** Providers every preview needs. Never add a ThemeProvider here: Loupe supplies the theme. */
export default function Wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </MemoryRouter>
  );
}
```

`examples/fixture-loupe/tsconfig.json` (editor support for files outside the target):
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@target/*": ["../mui-fixture/*"], "@/*": ["../mui-fixture/src/*"] },
    "types": ["vite/client"]
  },
  "include": [".", "../mui-fixture/src/theme/augment.d.ts", "../mui-fixture/src/next-env.d.ts"]
}
```

The loupe files themselves (`components/*.loupe.tsx`, `anomalies.ts`, `tokens.ts`) are written in Task 4, once `defineComponentDoc` exists. Until then, create `examples/fixture-loupe/components/.gitkeep`.

- [ ] **Step 6: Verify the fixture runs on its own**

Run: `npm install && npx tsc -p examples/mui-fixture/tsconfig.json --noEmit`
Expected: no type errors.

Run: `npm run dev -w mui-fixture -- --port 5180` in the background. Then `curl -s localhost:5180 | grep root`. Expected: prints the `<div id="root">` line. Stop the server.
(Rendering in a browser fails on `next/link`, which is expected; the fixture exists to be loaded by Loupe.)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "test: add MUI fixture app and its loupe config folder"
```

---

### Task 3: Core types, the analysis program and the file scanner

**Files:**
- Create: `packages/core/src/model.ts`, `packages/core/src/adapter.ts`
- Create: `packages/core/src/analysis/program.ts`, `packages/core/src/analysis/scan-file.ts`
- Modify: `packages/core/src/index.ts`, `packages/core/src/node.ts`
- Test: `packages/core/src/analysis/scan-file.test.ts`, `packages/core/src/analysis/program.test.ts`

**Interfaces:**
- Produces (`model.ts`, browser-safe types):
```ts
export type Mode = "light" | "dark";
export interface CallSite { file: string; line: number }            // file relative to target root
export interface PropInfo {
  name: string; type: string; required: boolean; defaultValue?: string; description?: string;
  enumValues?: string[];   // unquoted string literal members, when the type is a string-literal union
  inherited: boolean;      // declared in node_modules (e.g. MUI ButtonProps or DOM attributes)
}
export type ComponentSource = { kind: "wraps"; library: string; component: string } | { kind: "custom" };
export interface ComponentInfo {
  id: string;              // `${file}#${exportName}`, e.g. "src/components/PrimaryButton.tsx#PrimaryButton"
  name: string;            // display name
  exportName: string;      // named export or "default"
  file: string;            // relative to target root, posix separators
  folder: string;          // relative dir of file, e.g. "src/components/icons"
  description?: string;
  source: ComponentSource;
  props: PropInfo[];       // own props first, then inherited ones
  inheritedPropCount: number;
  builtFrom: { library: string[]; own: string[] }; // own = component ids
  usages: CallSite[];
  isIcon: boolean;
}
export interface LibraryUsage { component: string; sites: CallSite[] }
export interface IconInfo { name: string; source: "library" | "custom"; importPath: string; componentId?: string; sites: CallSite[] }
export interface StaticFinding { code: string; rule: "colour-literal" | "px-spacing"; file: string; line: number; snippet: string; message: string }
export interface DiscoveryModel {
  name: string; root: string; adapter: string; libraryName: string; libraryVersion?: string;
  themeEntry?: string; themeExport: string;
  components: ComponentInfo[]; libraryUsage: LibraryUsage[]; icons: IconInfo[];
  findings: StaticFinding[]; warnings: string[]; generatedAt: string;
}
```
- Produces (`analysis/scan-file.ts`):
```ts
export interface ImportBinding { local: string; imported: string; specifier: string; resolvedFile?: string } // imported: name | "default" | "*"
export interface JsxUse { tag: string; line: number }        // root identifier of the tag ("Foo" for <Foo.Bar>)
export interface ReExport { exported: string; imported: string; specifier: string; resolvedFile?: string } // exported/imported "*" for export *
export interface FileScan { file: string; imports: ImportBinding[]; jsx: JsxUse[]; styledTargets: string[]; exports: string[]; reExports: ReExport[] }
export function scanSource(file: string, text: string, resolve?: (specifier: string, fromFile: string) => string | undefined): FileScan
```
- Produces (`analysis/program.ts`):
```ts
export interface Analysis {
  resolve(specifier: string, fromFile: string): string | undefined; // absolute .ts/.tsx/.js/.jsx path inside root (not node_modules, not .d.ts)
  parseProps(files: string[]): import("react-docgen-typescript").ComponentDoc[];
}
export function createAnalysis(root: string, tsconfigPath: string): Analysis
```

- [ ] **Step 1: Write the types**

Create `packages/core/src/model.ts` with exactly the `model.ts` block above.

Create `packages/core/src/adapter.ts`:
```ts
import type { ComponentType, ReactNode } from "react";
import type { Mode } from "./model";

/** Node-side half of an adapter: used during discovery. */
export interface AdapterNode {
  id: string;            // "mui"
  libraryName: string;   // "MUI"
  packageName: string;   // "@mui/material", for reading the version from the target
  /** e.g. ("@mui/material", "Button") → "Button"; ("@mui/material/Button", "default") → "Button"; non-components → null */
  classifyImport(specifier: string, imported: string): string | null;
  /** e.g. ("@mui/icons-material/Delete", "default") → "Delete" */
  classifyIconImport(specifier: string, imported: string): string | null;
  /** Library components that never make a component "wrap" them (layout/text primitives), e.g. Box, Stack, Typography. */
  layoutPrimitives: string[];
}

export interface ColourToken { path: string; value: string }
export interface PaletteGroup { name: string; tokens: ColourToken[] }
export interface TypographyToken { variant: string; style: Record<string, string | number>; responsive: { query: string; style: Record<string, string | number> }[] }
export interface TokenModel {
  schemes: { mode: Mode; groups: PaletteGroup[] }[];
  typography: TypographyToken[];
  spacing: { factor: number; value: string }[];
  shape: { name: string; value: string }[];
  shadows: string[];
  zIndex: { name: string; value: number }[];
  transitions: { durations: { name: string; ms: number }[]; easings: { name: string; value: string }[] };
  breakpoints: { name: string; min: number }[];
}
export interface OverrideEntry {
  key: string;           // "MuiButton"
  component: string;     // "Button"
  defaultProps?: string; // serialised source
  styleOverrides?: string;
  variants?: { props: string; style: string }[];
}
export interface ContrastPair { mode: Mode; label: string; fg: string; bg: string; kind: "text" | "ui" }

/** Browser-side half of an adapter: used by the viewer. */
export interface AdapterBrowser {
  id: string;
  libraryName: string;
  isTheme(value: unknown): boolean;
  hasDarkScheme(theme: unknown): boolean;
  readTokens(theme: unknown): TokenModel;
  readOverrides(theme: unknown): OverrideEntry[];
  /** Token path ("palette.primary.main") → colour string for a mode. */
  resolveColour(theme: unknown, mode: Mode, path: string): string | undefined;
  /** Pairs worth checking for contrast. Colours are token paths. */
  contrastPairs(theme: unknown): ContrastPair[];
  PreviewRoot: ComponentType<{ theme: unknown; mode: Mode; children: ReactNode }>;
  PreviewFrame: ComponentType<{ children: ReactNode }>;
  DefaultThemeFrame: ComponentType<{ children: ReactNode }>;
  TypographySample: ComponentType<{ variant: string; children: ReactNode }>;
}
```

Append to `packages/core/src/index.ts`:
```ts
export type * from "./model";
export type * from "./adapter";
```

- [ ] **Step 2: Write the failing scanner test**

`packages/core/src/analysis/scan-file.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { scanSource } from "./scan-file";

const src = `
import Button, { type ButtonProps } from "@mui/material/Button";
import { Card as MuiCard, Typography } from "@mui/material";
import * as Icons from "@mui/icons-material";
import { styled } from "@mui/material/styles";
import { StatusPill } from "./StatusPill";

const Wrap = styled(MuiCard)({});
export const A = () => <MuiCard><Typography.Root /><Button /><StatusPill status="ok" label="x" /></MuiCard>;
export default function B() { return <Icons.Delete />; }
export { A as Alias };
`;

describe("scanSource", () => {
  it("collects imports, jsx tags with lines, styled targets and exports", () => {
    const s = scanSource("/r/src/x.tsx", src, (spec) => (spec === "./StatusPill" ? "/r/src/StatusPill.tsx" : undefined));
    expect(s.imports).toEqual([
      { local: "Button", imported: "default", specifier: "@mui/material/Button" },
      { local: "ButtonProps", imported: "ButtonProps", specifier: "@mui/material/Button" },
      { local: "MuiCard", imported: "Card", specifier: "@mui/material" },
      { local: "Typography", imported: "Typography", specifier: "@mui/material" },
      { local: "Icons", imported: "*", specifier: "@mui/icons-material" },
      { local: "styled", imported: "styled", specifier: "@mui/material/styles" },
      { local: "StatusPill", imported: "StatusPill", specifier: "./StatusPill", resolvedFile: "/r/src/StatusPill.tsx" },
    ]);
    expect(s.jsx.map((j) => j.tag)).toEqual(["MuiCard", "Typography", "Button", "StatusPill", "Icons"]);
    expect(s.jsx[0]!.line).toBe(9);
    expect(s.styledTargets).toEqual(["MuiCard"]);
    expect(s.exports.sort()).toEqual(["A", "Alias", "default"]);
    expect(s.reExports).toEqual([]);
  });

  it("records re-exports from barrel files", () => {
    const barrel = `export { PrimaryButton as Btn } from "./PrimaryButton";\nexport * from "./InfoCard";\n`;
    const s = scanSource("/r/src/index.ts", barrel, (spec) => `/r/src/${spec.slice(2)}.tsx`);
    expect(s.reExports).toEqual([
      { exported: "Btn", imported: "PrimaryButton", specifier: "./PrimaryButton", resolvedFile: "/r/src/PrimaryButton.tsx" },
      { exported: "*", imported: "*", specifier: "./InfoCard", resolvedFile: "/r/src/InfoCard.tsx" },
    ]);
    expect(s.exports).toEqual(["Btn"]);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run packages/core/src/analysis/scan-file.test.ts`
Expected: FAIL, because the module was not found.

- [ ] **Step 4: Implement the scanner**

Add `"typescript": "6.0.3"` to `packages/core/package.json` `peerDependencies` (it's provided by the root devDependency). Don't add it to `dependencies`.

`packages/core/src/analysis/scan-file.ts`:
```ts
import ts from "typescript";

export interface ImportBinding { local: string; imported: string; specifier: string; resolvedFile?: string }
export interface JsxUse { tag: string; line: number }
export interface ReExport { exported: string; imported: string; specifier: string; resolvedFile?: string }
export interface FileScan { file: string; imports: ImportBinding[]; jsx: JsxUse[]; styledTargets: string[]; exports: string[]; reExports: ReExport[] }

const scriptKind = (file: string) =>
  file.endsWith(".tsx") ? ts.ScriptKind.TSX : file.endsWith(".jsx") ? ts.ScriptKind.JSX : file.endsWith(".js") ? ts.ScriptKind.JS : ts.ScriptKind.TS;

export function parse(file: string, text: string): ts.SourceFile {
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind(file));
}

function rootIdentifier(name: ts.JsxTagNameExpression): string | undefined {
  let n: ts.Node = name;
  while (ts.isPropertyAccessExpression(n)) n = n.expression;
  return ts.isIdentifier(n) ? n.text : undefined;
}

export function scanSource(
  file: string,
  text: string,
  resolve?: (specifier: string, fromFile: string) => string | undefined,
): FileScan {
  const sf = parse(file, text);
  const out: FileScan = { file, imports: [], jsx: [], styledTargets: [], exports: [], reExports: [] };
  const lineOf = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

  for (const stmt of sf.statements) {
    if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
      const specifier = stmt.moduleSpecifier.text;
      const resolvedFile = resolve?.(specifier, file);
      const add = (local: string, imported: string) =>
        out.imports.push(resolvedFile ? { local, imported, specifier, resolvedFile } : { local, imported, specifier });
      const clause = stmt.importClause;
      if (!clause) continue;
      if (clause.name) add(clause.name.text, "default");
      const nb = clause.namedBindings;
      if (nb && ts.isNamespaceImport(nb)) add(nb.name.text, "*");
      if (nb && ts.isNamedImports(nb))
        for (const el of nb.elements) add(el.name.text, (el.propertyName ?? el.name).text);
    }
    // exports
    const mods = ts.canHaveModifiers(stmt) ? ts.getModifiers(stmt) : undefined;
    const isExported = mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    const isDefault = mods?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
    if (isExported && isDefault) out.exports.push("default");
    else if (isExported && (ts.isFunctionDeclaration(stmt) || ts.isClassDeclaration(stmt)) && stmt.name) out.exports.push(stmt.name.text);
    else if (isExported && ts.isVariableStatement(stmt))
      for (const d of stmt.declarationList.declarations) if (ts.isIdentifier(d.name)) out.exports.push(d.name.text);
    if (ts.isExportAssignment(stmt) && !stmt.isExportEquals) out.exports.push("default");
    if (ts.isExportDeclaration(stmt)) {
      const spec = stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier) ? stmt.moduleSpecifier.text : undefined;
      const resolvedFile = spec ? resolve?.(spec, file) : undefined;
      const addRe = (exported: string, imported: string) =>
        out.reExports.push(resolvedFile ? { exported, imported, specifier: spec!, resolvedFile } : { exported, imported, specifier: spec! });
      if (stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
        for (const el of stmt.exportClause.elements) {
          out.exports.push(el.name.text);
          if (spec) addRe(el.name.text, (el.propertyName ?? el.name).text);
        }
      } else if (!stmt.exportClause && spec) addRe("*", "*");
    }
  }

  const visit = (n: ts.Node) => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const tag = rootIdentifier(n.tagName);
      // Lower-case tags are intrinsic DOM elements.
      if (tag && /^[A-Z]/.test(tag)) out.jsx.push({ tag, line: lineOf(n) });
    }
    // styled(X)(…) / styled(X, opts)
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "styled") {
      const first = n.arguments[0];
      if (first && ts.isIdentifier(first)) out.styledTargets.push(first.text);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}
```

- [ ] **Step 5: Run the scanner test**

Run: `npx vitest run packages/core/src/analysis/scan-file.test.ts`
Expected: PASS. If `jsx[0].line` is off by one, the template literal starts with a newline (line 1 is empty); the test's line numbers already account for that.

- [ ] **Step 6: Write the failing program test (against the fixture)**

`packages/core/src/analysis/program.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import path from "node:path";
import { createAnalysis } from "./program";

const root = path.resolve(import.meta.dirname, "../../../../examples/mui-fixture");

describe("createAnalysis", () => {
  const a = createAnalysis(root, path.join(root, "tsconfig.json"));

  it("resolves tsconfig path aliases and relative imports to source files", () => {
    const from = path.join(root, "src/features/Settings.tsx");
    expect(a.resolve("@/components/PrimaryButton", from)).toBe(path.join(root, "src/components/PrimaryButton.tsx"));
    expect(a.resolve("./Settings", path.join(root, "src/features/Dashboard.tsx"))).toBe(from);
  });

  it("does not resolve packages into node_modules", () => {
    expect(a.resolve("@mui/material", path.join(root, "src/App.tsx"))).toBeUndefined();
  });

  it("extracts props with docgen", () => {
    const docs = a.parseProps([path.join(root, "src/components/TextInput.tsx")]);
    const doc = docs.find((d) => d.displayName === "TextInput")!;
    expect(doc.description).toContain("Single-line text input");
    expect(doc.props.label!.required).toBe(true);
    expect(doc.props.type!.type.name).toBe("enum");
  });
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npx vitest run packages/core/src/analysis/program.test.ts`
Expected: FAIL, because the module was not found.

- [ ] **Step 8: Implement the program**

`packages/core/src/analysis/program.ts`:
```ts
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import * as docgen from "react-docgen-typescript";

export interface Analysis {
  resolve(specifier: string, fromFile: string): string | undefined;
  parseProps(files: string[]): docgen.ComponentDoc[];
}

const FALLBACK: ts.CompilerOptions = {
  jsx: ts.JsxEmit.ReactJSX,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  target: ts.ScriptTarget.ES2022,
  allowJs: true,
  esModuleInterop: true,
  skipLibCheck: true,
};

function readCompilerOptions(root: string, tsconfigPath: string): ts.CompilerOptions {
  if (!fs.existsSync(tsconfigPath)) return FALLBACK;
  const read = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (read.error) return FALLBACK;
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, path.dirname(tsconfigPath), undefined, tsconfigPath);
  return { ...FALLBACK, ...parsed.options, noEmit: true };
}

export function createAnalysis(root: string, tsconfigPath: string): Analysis {
  const options = readCompilerOptions(root, tsconfigPath);
  const host = ts.createCompilerHost(options);
  const cache = ts.createModuleResolutionCache(root, (f) => f, options);
  const SOURCE = /\.(tsx?|jsx?|mjs|cjs)$/;

  const resolve = (specifier: string, fromFile: string) => {
    const r = ts.resolveModuleName(specifier, fromFile, options, host, cache).resolvedModule;
    if (!r || r.isExternalLibraryImport) return undefined;
    const f = path.resolve(r.resolvedFileName);
    if (f.endsWith(".d.ts") || f.includes(`${path.sep}node_modules${path.sep}`) || !SOURCE.test(f)) return undefined;
    return f;
  };

  const parser = docgen.withCompilerOptions(options, {
    savePropValueAsString: true,
    shouldExtractLiteralValuesFromEnum: true,
    shouldRemoveUndefinedFromOptional: true,
    shouldIncludePropTagMap: false,
    propFilter: () => true,
  });

  return { resolve, parseProps: (files) => parser.parse(files) };
}
```

- [ ] **Step 9: Run the program test**

Run: `npx vitest run packages/core/src/analysis/program.test.ts`
Expected: 3 passed. If docgen throws an error about TypeScript, check `node_modules/typescript/package.json` reports `6.0.3`.

- [ ] **Step 10: Export and commit**

Append to `packages/core/src/node.ts`:
```ts
export { createAnalysis } from "./analysis/program";
export type { Analysis } from "./analysis/program";
export { scanSource, parse } from "./analysis/scan-file";
export type { FileScan, ImportBinding, JsxUse, ReExport } from "./analysis/scan-file";
```

```bash
git add -A
git commit -m "feat(core): model types, adapter interfaces, TS analysis program and file scanner"
```

---
### Task 4: Loupe-file types, anomaly codes, static rules and the anomaly merge

**Files:**
- Create: `packages/core/src/loupe-files.ts`
- Create: `packages/core/src/anomalies/{codes.ts,static-rules.ts,merge.ts,meta.ts}`
- Create: `examples/fixture-loupe/components/{PrimaryButton.loupe.tsx,InfoCard.loupe.tsx}`, `examples/fixture-loupe/{anomalies.ts,tokens.ts}`
- Modify: `packages/core/src/index.ts`, `packages/core/src/node.ts`
- Test: `packages/core/src/anomalies/{codes.test.ts,static-rules.test.ts,merge.test.ts}`

**Interfaces:**
- Consumes: `StaticFinding` and `CallSite` from `model.ts` (Task 3). `WcagCheck` comes from `a11y/types.ts`, created here as a type-only file so Task 5 can fill in the logic.
- Produces (`loupe-files.ts`, browser-safe):
```ts
export type Tier = "atom" | "molecule" | "macromolecule" | "organelle";
export interface A11yDoc { pattern?: ApgPattern; role?: string; name?: string; keyboard?: { keys: string; does: string }[]; checks?: WcagCheck[] }
export interface ComponentDocInput { component: string; tier?: Tier; notes?: string; hidden?: boolean; demo?: () => ReactNode; a11y?: A11yDoc }
export type AnomalyCategory = "color" | "typography" | "structure" | "iconography" | "motion" | "external" | "build";
export type AnomalyStatus = "open" | "intentional" | "todo" | "fixed";
export interface Anomaly { id: string; title: string; category: AnomalyCategory; status: AnomalyStatus; flaggedBy?: "system" | "human"; description: string; locations: string[]; fix?: string; note?: string }
export type TokenNotes = Record<string, string>;   // token path → description
export function defineComponentDoc(d: ComponentDocInput): ComponentDocInput
export function defineAnomalies(a: Anomaly[]): Anomaly[]
export function defineTokenNotes(n: TokenNotes): TokenNotes
```
- Produces (`anomalies/codes.ts`): `fnv1a(s: string): number`, `anomalyCode(...parts: string[]): string` (4 chars, base36, zero-padded).
- Produces (`anomalies/static-rules.ts`, Node-only because it uses `typescript`): `findStaticIssues(relFile: string, text: string): StaticFinding[]`.
- Produces (`anomalies/merge.ts`, browser-safe): `mergeAnomalies(auto: Anomaly[], authored: Anomaly[]): Anomaly[]`. An authored entry whose `id` equals an auto entry's `id` overrides that entry's `status`, `note` and `fix`, and keeps the auto description and locations. Other authored entries are appended with `flaggedBy` defaulting to `"human"`. The result is sorted by status (open, todo, intentional, fixed), then by id.
- Produces (`anomalies/meta.ts`): `categoryInfo`, `statusInfo` (ported, plus `build`).

- [ ] **Step 1: Write the failing tests**

`packages/core/src/anomalies/codes.test.ts`:
```ts
import { it, expect } from "vitest";
import { anomalyCode, fnv1a } from "./codes";

it("fnv1a is the 32-bit FNV-1a hash", () => {
  expect(fnv1a("")).toBe(0x811c9dc5);
  expect(fnv1a("a")).toBe(0xe40c292c);
});

it("anomalyCode is 4 base36 chars, deterministic and input-sensitive", () => {
  const a = anomalyCode("colour-literal", "src/x.tsx", "bgcolor: #e8f5e9");
  expect(a).toMatch(/^[0-9a-z]{4}$/);
  expect(anomalyCode("colour-literal", "src/x.tsx", "bgcolor: #e8f5e9")).toBe(a);
  expect(anomalyCode("colour-literal", "src/y.tsx", "bgcolor: #e8f5e9")).not.toBe(a);
});
```

`packages/core/src/anomalies/static-rules.test.ts`:
```ts
import { it, expect } from "vitest";
import { findStaticIssues } from "./static-rules";

const text = `
import { styled } from "@mui/material/styles";
const A = styled("div")({ color: "rgb(10, 20, 30)", padding: 8 });
const B = styled(Box)(({ theme }) => ({ margin: "4px", color: theme.palette.text.primary }));
export const C = () => (
  <Box sx={{ bgcolor: "#e8f5e9", px: "6px", mt: 2, border: "1px solid #ccc" }} style={{ gap: "12px" }}>
    <span className="#notacolour">x</span>
  </Box>
);
`;

it("finds colour literals and px spacing only inside sx/style/styled", () => {
  const f = findStaticIssues("src/x.tsx", text);
  const brief = f.map((x) => `${x.rule}@${x.line}:${x.snippet}`);
  expect(brief).toEqual([
    "colour-literal@3:color: rgb(10, 20, 30)",
    "px-spacing@4:margin: 4px",
    "colour-literal@6:bgcolor: #e8f5e9",
    "px-spacing@6:px: 6px",
    "colour-literal@6:border: 1px solid #ccc",
    "px-spacing@6:gap: 12px",
  ]);
  expect(f[0]!.code).toMatch(/^[0-9a-z]{4}$/);
  expect(f[0]!.message).toBe("Hard-coded colour in styles; use a palette token.");
  expect(f[1]!.message).toBe("Raw px spacing; use theme.spacing units.");
});
```

`packages/core/src/anomalies/merge.test.ts`:
```ts
import { it, expect } from "vitest";
import { mergeAnomalies } from "./merge";
import type { Anomaly } from "../loupe-files";

const auto: Anomaly[] = [
  { id: "aaaa", title: "Hard-coded colour", category: "color", status: "open", flaggedBy: "system", description: "d", locations: ["src/a.tsx:3"] },
  { id: "bbbb", title: "Raw px", category: "structure", status: "open", flaggedBy: "system", description: "d", locations: ["src/b.tsx:4"] },
];
const authored: Anomaly[] = [
  { id: "aaaa", title: "ignored", category: "color", status: "intentional", description: "ignored", locations: [], note: "Brand tint, agreed with design." },
  { id: "h001", title: "Two greens", category: "color", status: "todo", description: "Two near-identical greens.", locations: ["theme"] },
];

it("authored entries override status/note of matching auto codes and append the rest", () => {
  const m = mergeAnomalies(auto, authored);
  expect(m.map((a) => `${a.id}:${a.status}:${a.flaggedBy}`)).toEqual(["bbbb:open:system", "h001:todo:human", "aaaa:intentional:system"]);
  const a = m.find((x) => x.id === "aaaa")!;
  expect(a.title).toBe("Hard-coded colour");
  expect(a.locations).toEqual(["src/a.tsx:3"]);
  expect(a.note).toBe("Brand tint, agreed with design.");
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run packages/core/src/anomalies`
Expected: FAIL, because the modules were not found.

- [ ] **Step 3: Implement**

`packages/core/src/a11y/types.ts`:
```ts
export type WcagStatus = "pass" | "inherited" | "partial" | "fail";

/** A live contrast measurement between two token paths ("palette.primary.main"). */
export type ContrastMeasure = {
  fg: string;
  bg: string;
  kind: "text" | "large-text" | "ui";
  fgAlpha?: number;
  bgAlpha?: number;
  over?: string;   // token the (translucent) bg sits on; defaults to palette.background.default
  label?: string;
};

export type WcagCheck =
  | { sc: string; status: WcagStatus; evidence: string; measure?: never }
  | { sc: string; measure: ContrastMeasure; evidence?: string; status?: never };
```

`packages/core/src/loupe-files.ts`:
```ts
import type { ReactNode } from "react";
import type { WcagCheck } from "./a11y/types";
import type { ApgPattern } from "./a11y/wcag-meta";

export type Tier = "atom" | "molecule" | "macromolecule" | "organelle";
export const TIERS: Tier[] = ["atom", "molecule", "macromolecule", "organelle"];

export interface A11yDoc {
  pattern?: ApgPattern;
  role?: string;
  name?: string;               // how the accessible name is derived
  keyboard?: { keys: string; does: string }[];
  checks?: WcagCheck[];
}

export interface ComponentDocInput {
  /** File path relative to the target root, optionally `#ExportName`. */
  component: string;
  tier?: Tier;
  notes?: string;
  hidden?: boolean;
  demo?: () => ReactNode;
  a11y?: A11yDoc;
}

export type AnomalyCategory = "color" | "typography" | "structure" | "iconography" | "motion" | "external" | "build";
export type AnomalyStatus = "open" | "intentional" | "todo" | "fixed";

export interface Anomaly {
  id: string;                  // 4-char base36, stable
  title: string;
  category: AnomalyCategory;
  status: AnomalyStatus;
  flaggedBy?: "system" | "human";
  description: string;
  locations: string[];
  fix?: string;
  note?: string;
}

export type TokenNotes = Record<string, string>;

export const defineComponentDoc = (d: ComponentDocInput) => d;
export const defineAnomalies = (a: Anomaly[]) => a;
export const defineTokenNotes = (n: TokenNotes) => n;
```

`packages/core/src/a11y/wcag-meta.ts`: copy `~/dev/trains2somewhere/packages/design-system/src/registry/wcag-meta.ts` verbatim, then replace the top doc comment's "shared by both apps" with "shared by every target". (Task 5 needs it; it's created now because `loupe-files.ts` imports `ApgPattern`.)

`packages/core/src/anomalies/codes.ts`:
```ts
/** 32-bit FNV-1a. */
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Stable 4-char base36 code for an automatic finding. */
export function anomalyCode(...parts: string[]): string {
  return (fnv1a(parts.join("|")) % 36 ** 4).toString(36).padStart(4, "0");
}
```

`packages/core/src/anomalies/static-rules.ts`:
```ts
import ts from "typescript";
import { parse } from "../analysis/scan-file";
import { anomalyCode } from "./codes";
import type { StaticFinding } from "../model";

const COLOUR = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b|\b(?:rgb|rgba|hsl|hsla|oklch|lab)\(/i;
const PX = /(?:^|\s|-)\d+(?:\.\d+)?px\b/;
const SPACING = new Set([
  "m", "mt", "mr", "mb", "ml", "mx", "my", "p", "pt", "pr", "pb", "pl", "px", "py",
  "margin", "marginTop", "marginRight", "marginBottom", "marginLeft", "marginInline", "marginBlock",
  "padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "paddingInline", "paddingBlock",
  "gap", "rowGap", "columnGap",
]);
const MESSAGES = {
  "colour-literal": "Hard-coded colour in styles; use a palette token.",
  "px-spacing": "Raw px spacing; use theme.spacing units.",
} as const;

const propName = (n: ts.PropertyName): string | undefined =>
  ts.isIdentifier(n) || ts.isStringLiteral(n) ? n.text : undefined;

/** Is `n` a style context: sx={…}, style={…}, or the argument of styled(X)(…)? */
function isStyleRoot(n: ts.Node): boolean {
  if (ts.isJsxAttribute(n)) {
    const name = ts.isIdentifier(n.name) ? n.name.text : "";
    return name === "sx" || name === "style";
  }
  if (ts.isCallExpression(n) && ts.isCallExpression(n.expression)) {
    const inner = n.expression.expression;
    return ts.isIdentifier(inner) && inner.text === "styled";
  }
  return false;
}

export function findStaticIssues(relFile: string, text: string): StaticFinding[] {
  const sf = parse(relFile, text);
  const out: StaticFinding[] = [];
  const lineOf = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

  const inspect = (n: ts.Node) => {
    if (ts.isPropertyAssignment(n) && (ts.isStringLiteral(n.initializer) || ts.isNoSubstitutionTemplateLiteral(n.initializer))) {
      const key = propName(n.name);
      const value = n.initializer.text;
      if (key) {
        const snippet = `${key}: ${value}`;
        const push = (rule: StaticFinding["rule"]) =>
          out.push({ code: anomalyCode(rule, relFile, snippet), rule, file: relFile, line: lineOf(n), snippet, message: MESSAGES[rule] });
        if (COLOUR.test(value)) push("colour-literal");
        else if (SPACING.has(key) && PX.test(value)) push("px-spacing");
      }
    }
    ts.forEachChild(n, inspect);
  };

  const visit = (n: ts.Node) => {
    if (isStyleRoot(n)) {
      ts.forEachChild(n, inspect);
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out.sort((a, b) => a.line - b.line);
}
```
(The sort is stable, so findings on the same line keep source order.)

`packages/core/src/anomalies/merge.ts`:
```ts
import type { Anomaly, AnomalyStatus } from "../loupe-files";

const ORDER: Record<AnomalyStatus, number> = { open: 0, todo: 1, intentional: 2, fixed: 3 };

export function mergeAnomalies(auto: Anomaly[], authored: Anomaly[]): Anomaly[] {
  const byId = new Map(authored.map((a) => [a.id, a]));
  const merged = auto.map((a) => {
    const o = byId.get(a.id);
    if (!o) return a;
    byId.delete(a.id);
    return { ...a, status: o.status, note: o.note ?? a.note, fix: o.fix ?? a.fix };
  });
  for (const a of byId.values()) merged.push({ flaggedBy: "human", ...a });
  return merged.sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.id.localeCompare(b.id));
}
```

`packages/core/src/anomalies/meta.ts`: copy `~/dev/trains2somewhere/packages/design-system/src/registry/anomaly-meta.ts`. Change the import to `import type { AnomalyCategory, AnomalyStatus } from "../loupe-files";`. Replace the `typography` description with `"Inline font sizes/weights instead of typography variants."`, replace `external` with `"Anomalies outside this codebase — third-party styles or config."`, and add:
```ts
  build: {
    name: "Build",
    description: "Components Loupe could not import or render — usually a missing shim, provider or env value.",
  },
```

Append to `packages/core/src/index.ts`:
```ts
export * from "./loupe-files";
export type { WcagCheck, WcagStatus, ContrastMeasure } from "./a11y/types";
export { APG, WCAG, WCAG_LEVELS } from "./a11y/wcag-meta";
export type { ApgPattern, WcagLevel } from "./a11y/wcag-meta";
export { anomalyCode, fnv1a } from "./anomalies/codes";
export { mergeAnomalies } from "./anomalies/merge";
export { categoryInfo, statusInfo } from "./anomalies/meta";
```
Append to `packages/core/src/node.ts`:
```ts
export { findStaticIssues } from "./anomalies/static-rules";
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run packages/core/src/anomalies`
Expected: all pass. If `fnv1a("a")` differs, the multiply isn't 32-bit; keep `Math.imul`.

- [ ] **Step 5: Fixture loupe files**

`examples/fixture-loupe/components/PrimaryButton.loupe.tsx`:
```tsx
import { defineComponentDoc } from "@designloupe/core";
import { Stack } from "@mui/material";
import { PrimaryButton } from "@target/src/components/PrimaryButton";

export default defineComponentDoc({
  component: "src/components/PrimaryButton.tsx",
  tier: "atom",
  notes: "Use for the single main action on a page. Tone `brand` is for upsell only.",
  demo: () => (
    <Stack direction="row" spacing={2}>
      <PrimaryButton>Save</PrimaryButton>
      <PrimaryButton tone="brand">Upgrade</PrimaryButton>
      <PrimaryButton disabled>Disabled</PrimaryButton>
    </Stack>
  ),
  a11y: {
    pattern: "button",
    role: "button",
    name: "Text content",
    keyboard: [{ keys: "Enter / Space", does: "Activates the button" }],
    checks: [
      { sc: "2.1.1", status: "inherited", evidence: "MUI ButtonBase renders a native <button>." },
      { sc: "1.4.3", measure: { fg: "palette.primary.contrastText", bg: "palette.primary.main", kind: "text", label: "label on fill" } },
      { sc: "1.4.3", measure: { fg: "palette.brand.contrastText", bg: "palette.brand.main", kind: "text", label: "brand label on fill" } },
    ],
  },
});
```

`examples/fixture-loupe/components/InfoCard.loupe.tsx`:
```tsx
import { defineComponentDoc } from "@designloupe/core";

export default defineComponentDoc({
  component: "src/components/InfoCard.tsx",
  tier: "molecule",
  notes: "Auto-demo is fine here; this file only assigns the tier.",
});
```

`examples/fixture-loupe/anomalies.ts`:
```ts
import { defineAnomalies } from "@designloupe/core";

export default defineAnomalies([
  {
    id: "h001",
    title: "Two near-identical greens",
    category: "color",
    status: "todo",
    description: "primary.main and the StatusPill background are both greens with no shared token.",
    locations: ["src/theme/index.ts", "src/components/StatusPill.tsx"],
    fix: "Add palette.success usage to StatusPill.",
  },
]);
```

`examples/fixture-loupe/tokens.ts`:
```ts
import { defineTokenNotes } from "@designloupe/core";

export default defineTokenNotes({
  "palette.primary.main": "Forest green. The main action colour.",
  "palette.brand.main": "Upsell orange. Never for destructive actions.",
});
```

Remove `examples/fixture-loupe/components/.gitkeep`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(core): loupe-file types, anomaly codes, static rules and merge; fixture loupe files"
```

---

### Task 5: Port the a11y contrast maths; plan auto-demos

**Files:**
- Create: `packages/core/src/a11y/a11y.ts`, `packages/core/src/demo/plan.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/a11y/a11y.test.ts`, `packages/core/src/demo/plan.test.ts`

**Interfaces:**
- Consumes: `WcagCheck` and `ContrastMeasure` from `a11y/types.ts`, `WCAG` and `WCAG_LEVELS` from `a11y/wcag-meta.ts`, and `PropInfo` from `model.ts`.
- Produces (`a11y.ts`):
  - `contrastRatio(a: string, b: string): number`
  - `compositeHex(fg: string, alpha: number, bg: string): string`
  - `flattenOver(fg: string, bg: string): string`, which composites an 8-digit hex with alpha over an opaque bg and passes 6-digit hex through unchanged
  - `thresholdFor(kind, level): number`
  - `resolveWcag(checks: WcagCheck[], resolveVar: (path: string) => string): WcagRow[]`
  - `rollupWcag(rows): WcagRollup`
  - the types `WcagRow`, `WcagRollup` and `WcagVerdict`
- Produces (`demo/plan.ts`):
```ts
export type DemoPlan =
  | { kind: "grid"; base: Record<string, unknown>; axes: { prop: string; values: string[] }[] }
  | { kind: "needs-demo"; missing: string[] };
export function planAutoDemo(c: { name: string; props: PropInfo[] }): DemoPlan
```

- [ ] **Step 1: Port the a11y test (as a failing test)**

Create `packages/core/src/a11y/a11y.test.ts` by porting `~/dev/trains2somewhere/packages/design-system/src/registry/a11y.test.ts` to Vitest:
- replace `import { test } from "node:test"` and `import assert from "node:assert/strict"` with `import { test, expect } from "vitest"`;
- `assert.equal(a, b)` → `expect(a).toBe(b)`, `assert.deepEqual` → `expect(a).toEqual(b)`, `assert.ok(x)` → `expect(x).toBeTruthy()`;
- rename the token keys in `vars` to token paths: `"--primary"` → `"palette.primary.main"`, `"--primary-foreground"` → `"palette.primary.contrastText"`, `"--background"` → `"palette.background.default"`, `"--ring"` → `"palette.action.focus"`, and update each `measure` to use the same paths;
- change the `4.1.2` evidence from `"Radix."` to `"MUI."`.

Then add:
```ts
test("flattenOver composites 8-digit hex alpha over an opaque bg", () => {
  expect(flattenOver("#00000080", "#ffffff")).toBe("#7f7f7f");
  expect(flattenOver("#123456", "#ffffff")).toBe("#123456");
  expect(flattenOver("#000000ff", "#ffffff")).toBe("#000000");
});
```
Import `flattenOver` alongside the others from `./a11y`.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run packages/core/src/a11y`
Expected: FAIL, because `./a11y` was not found.

- [ ] **Step 3: Port the implementation**

Copy `~/dev/trains2somewhere/packages/design-system/src/registry/a11y.ts` to `packages/core/src/a11y/a11y.ts`, then make these changes:
- Imports become:
  ```ts
  import type { ContrastMeasure, WcagCheck, WcagStatus } from "./types";
  import { WCAG, WCAG_LEVELS } from "./wcag-meta";
  import type { WcagLevel } from "./wcag-meta";
  ```
- In `resolveWcag`, change `resolveVar(m.over ?? "--background")` to `resolveVar(m.over ?? "palette.background.default")`, rename the parameter `cssVar` to `path`, and reword its doc comment to "token path → hex".
- After `compositeHex`, add:
  ```ts
  // Flatten a translucent colour (8-digit hex from toHex) over an opaque bg so
  // contrast is measured on what's painted. 6-digit input passes through.
  export function flattenOver(fg: string, bg: string): string {
    const m = /^#([0-9a-f]{6})([0-9a-f]{2})$/i.exec(fg.trim());
    if (!m) return fg;
    return compositeHex(`#${m[1]}`, parseInt(m[2]!, 16) / 255, bg);
  }
  ```
- Leave the maths and sorting unchanged.

Append to `packages/core/src/index.ts`:
```ts
export { contrastRatio, compositeHex, flattenOver, thresholdFor, resolveWcag, rollupWcag } from "./a11y/a11y";
export type { WcagRow, WcagRollup, WcagVerdict } from "./a11y/a11y";
```

- [ ] **Step 4: Run the a11y tests**

Run: `npx vitest run packages/core/src/a11y`
Expected: all pass. The `"#00000080"` case gives `#7f7f7f`, because 128/255 ≈ 0.502 → 127.

- [ ] **Step 5: Write the failing demo-plan test**

`packages/core/src/demo/plan.test.ts`:
```ts
import { it, expect } from "vitest";
import { planAutoDemo } from "./plan";
import type { PropInfo } from "../model";

const p = (o: Partial<PropInfo> & { name: string }): PropInfo => ({ type: "string", required: false, inherited: false, ...o });

it("expands up to two enum props into axes (own first, then inherited variant/size/color)", () => {
  const plan = planAutoDemo({
    name: "PrimaryButton",
    props: [
      p({ name: "tone", type: "enum", enumValues: ["brand", "neutral"] }),
      p({ name: "children", type: "ReactNode", inherited: true }),
      p({ name: "size", type: "enum", enumValues: ["small", "medium", "large"], inherited: true }),
      p({ name: "variant", type: "enum", enumValues: ["text", "outlined", "contained", "dashed"], inherited: true }),
      p({ name: "disabled", type: "enum", enumValues: ["false", "true"] }),
    ],
  });
  expect(plan).toEqual({
    kind: "grid",
    base: { children: "PrimaryButton" },
    axes: [
      { prop: "tone", values: ["brand", "neutral"] },
      { prop: "variant", values: ["text", "outlined", "contained", "dashed"] },
    ],
  });
});

it("fills required props it can and reports the ones it can't", () => {
  expect(
    planAutoDemo({
      name: "TextInput",
      props: [p({ name: "label", required: true }), p({ name: "count", type: "number", required: true }), p({ name: "onSave", type: "() => void", required: true })],
    }),
  ).toMatchObject({ kind: "grid", base: { label: "TextInput", count: 1 } });

  expect(
    planAutoDemo({ name: "Chart", props: [p({ name: "data", type: "Point[]", required: true }), p({ name: "title", required: true })] }),
  ).toEqual({ kind: "needs-demo", missing: ["data"] });
});

it("required enums take their first value; required booleans are false", () => {
  const plan = planAutoDemo({
    name: "StatusPill",
    props: [p({ name: "status", type: "enum", required: true, enumValues: ["ok", "warn", "error"] }), p({ name: "label", required: true }), p({ name: "dense", type: "boolean", required: true })],
  });
  expect(plan).toEqual({
    kind: "grid",
    base: { status: "ok", label: "StatusPill", dense: false },
    axes: [{ prop: "status", values: ["ok", "warn", "error"] }],
  });
});
```
Note on the first test: `disabled` is a boolean union (`false | true`), so it's never an axis. Own `tone` comes first, then inherited `variant`, chosen ahead of `size` because the preference order is `variant`, `size`, `color`.

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run packages/core/src/demo`
Expected: FAIL, because the module was not found.

- [ ] **Step 7: Implement**

`packages/core/src/demo/plan.ts`:
```ts
import type { PropInfo } from "../model";

export type DemoPlan =
  | { kind: "grid"; base: Record<string, unknown>; axes: { prop: string; values: string[] }[] }
  | { kind: "needs-demo"; missing: string[] };

const INHERITED_AXES = ["variant", "size", "color"];
const isBoolUnion = (v: string[]) => v.length === 2 && v.includes("true") && v.includes("false");
const isEnum = (pr: PropInfo) => !!pr.enumValues && pr.enumValues.length >= 2 && pr.enumValues.length <= 6 && !isBoolUnion(pr.enumValues);
const isFunctionType = (t: string) => t.includes("=>") || /^\(/.test(t) || /Handler|Function/.test(t);
const isNodeType = (t: string) => /ReactNode|ReactElement|JSX\.Element/.test(t);

function fill(pr: PropInfo, name: string): { ok: true; value: unknown } | { ok: false } {
  if (pr.enumValues?.length) return { ok: true, value: isBoolUnion(pr.enumValues) ? false : pr.enumValues[0] };
  if (pr.type === "string") return { ok: true, value: name };
  if (pr.type === "number") return { ok: true, value: 1 };
  if (pr.type === "boolean") return { ok: true, value: false };
  if (isNodeType(pr.type)) return { ok: true, value: name };
  if (isFunctionType(pr.type)) return { ok: true, value: () => {} };
  return { ok: false };
}

export function planAutoDemo(c: { name: string; props: PropInfo[] }): DemoPlan {
  const base: Record<string, unknown> = {};
  const missing: string[] = [];
  for (const pr of c.props) {
    if (!pr.required || pr.defaultValue !== undefined) continue;
    const f = fill(pr, c.name);
    if (f.ok) base[pr.name] = f.value;
    else missing.push(pr.name);
  }
  if (missing.length) return { kind: "needs-demo", missing };

  const children = c.props.find((pr) => pr.name === "children");
  if (children && !("children" in base) && isNodeType(children.type)) base.children = c.name;

  const own = c.props.filter((pr) => !pr.inherited && isEnum(pr));
  const inherited = INHERITED_AXES.map((n) => c.props.find((pr) => pr.inherited && pr.name === n)).filter(
    (pr): pr is PropInfo => !!pr && isEnum(pr),
  );
  const axes = [...own, ...inherited].slice(0, 2).map((pr) => ({ prop: pr.name, values: pr.enumValues! }));
  return { kind: "grid", base, axes };
}
```

- [ ] **Step 8: Run all core tests**

Run: `npx vitest run packages/core`
Expected: all pass. (In the first demo test, `children` is not required, so it's added by the children rule.)

Append to `packages/core/src/index.ts`:
```ts
export { planAutoDemo } from "./demo/plan";
export type { DemoPlan } from "./demo/plan";
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(core): port WCAG contrast maths; auto-demo planning"
```

---
### Task 6: MUI node adapter and discovery

**Files:**
- Create: `packages/adapter-mui/src/node.ts`
- Create: `packages/core/src/discovery/{props.ts,discover.ts,package-version.ts}`
- Modify: `packages/core/src/node.ts`
- Test: `packages/adapter-mui/src/node.test.ts`, `packages/core/src/discovery/props.test.ts`, `packages/adapter-mui/src/discover.integration.test.ts`

**Interfaces:**
- Consumes:
  - `ResolvedConfig` (Task 1)
  - `createAnalysis` and `scanSource` with `FileScan.reExports` (Task 3)
  - `findStaticIssues` (Task 4)
  - the `AdapterNode` and `model.ts` types (Task 3)
- Produces:
  - `muiNode: AdapterNode` (default export of `@designloupe/adapter-mui/node`)
  - `toPropInfo(doc: ComponentDoc): { props: PropInfo[]; inheritedPropCount: number }`
  - `discover(config: ResolvedConfig, adapter: AdapterNode): Promise<DiscoveryModel>`
  - `readPackageVersion(root: string, pkg: string): string | undefined`

- [ ] **Step 1: Write the failing MUI classifier test**

`packages/adapter-mui/src/node.test.ts`:
```ts
import { it, expect } from "vitest";
import mui from "./node";

it("classifies MUI component imports", () => {
  expect(mui.classifyImport("@mui/material", "Button")).toBe("Button");
  expect(mui.classifyImport("@mui/material/Button", "default")).toBe("Button");
  expect(mui.classifyImport("@mui/material/Button", "ButtonProps")).toBeNull();
  expect(mui.classifyImport("@mui/material", "ButtonProps")).toBeNull();
  expect(mui.classifyImport("@mui/material", "useTheme")).toBeNull();
  expect(mui.classifyImport("@mui/material", "ThemeProvider")).toBeNull();
  expect(mui.classifyImport("@mui/material", "CssBaseline")).toBeNull();
  expect(mui.classifyImport("@mui/material/styles", "styled")).toBeNull();
  expect(mui.classifyImport("@mui/lab", "LoadingButton")).toBe("LoadingButton");
  expect(mui.classifyImport("@mui/x-date-pickers", "DatePicker")).toBe("DatePicker");
  expect(mui.classifyImport("react-router-dom", "Link")).toBeNull();
});

it("classifies icon imports", () => {
  expect(mui.classifyIconImport("@mui/icons-material/Delete", "default")).toBe("Delete");
  expect(mui.classifyIconImport("@mui/icons-material", "DeleteOutlined")).toBe("DeleteOutlined");
  expect(mui.classifyIconImport("@mui/material", "Button")).toBeNull();
});

it("lists layout primitives", () => {
  expect(mui.layoutPrimitives).toEqual(expect.arrayContaining(["Box", "Stack", "Typography"]));
});
```

- [ ] **Step 2: Run it to verify it fails, then implement**

Run: `npx vitest run packages/adapter-mui/src/node.test.ts`
Expected: FAIL, because the module was not found.

`packages/adapter-mui/src/node.ts`:
```ts
import type { AdapterNode } from "@designloupe/core";

const PKG = /^@mui\/(?:material|lab|x-[a-z-]+)(?:\/([A-Z][A-Za-z0-9]*))?$/;
const ICONS = /^@mui\/icons-material(?:\/([A-Za-z0-9]+))?$/;
const COMPONENT_NAME = /^[A-Z][A-Za-z0-9]*$/;
const NOT_COMPONENT = /(Props|Classes|ClassKey|Theme|Options|Context|Slots|SlotProps)$/;
// App infrastructure, not design-system components (main.tsx renders CssBaseline; it must not count as raw usage).
const PROVIDERS = new Set(["ThemeProvider", "StyledEngineProvider", "CssVarsProvider", "CssBaseline", "ScopedCssBaseline", "GlobalStyles"]);

const isComponentName = (n: string) => COMPONENT_NAME.test(n) && !NOT_COMPONENT.test(n) && !PROVIDERS.has(n);

const muiNode: AdapterNode = {
  id: "mui",
  libraryName: "MUI",
  packageName: "@mui/material",
  layoutPrimitives: ["Box", "Stack", "Grid", "Grid2", "Container", "Typography", "Divider"],
  classifyImport(specifier, imported) {
    const m = PKG.exec(specifier);
    if (!m) return null;
    if (m[1]) return imported === "default" ? m[1] : isComponentName(imported) ? imported : null;
    return isComponentName(imported) ? imported : null;
  },
  classifyIconImport(specifier, imported) {
    const m = ICONS.exec(specifier);
    if (!m) return null;
    if (m[1]) return imported === "default" ? m[1] : null;
    return COMPONENT_NAME.test(imported) ? imported : null;
  },
};

export default muiNode;
```
Note: `ButtonProps` from `@mui/material/Button` is not `default` and ends in `Props`, so it returns null.

Run: `npx vitest run packages/adapter-mui/src/node.test.ts`
Expected: PASS.

- [ ] **Step 3: Write the failing props-conversion test**

`packages/core/src/discovery/props.test.ts`:
```ts
import { it, expect } from "vitest";
import type { ComponentDoc } from "react-docgen-typescript";
import { toPropInfo } from "./props";

const nm = { fileName: "/x/node_modules/@mui/material/Button/Button.d.ts", name: "ButtonOwnProps" };
const own = { fileName: "/x/src/PrimaryButton.tsx", name: "PrimaryButtonProps" };

const doc = {
  displayName: "PrimaryButton",
  description: "",
  filePath: "/x/src/PrimaryButton.tsx",
  methods: [],
  tags: {},
  props: {
    tone: { name: "tone", required: false, description: "Tone.", defaultValue: { value: "neutral" }, parent: own, declarations: [own],
      type: { name: "enum", raw: '"brand" | "neutral"', value: [{ value: '"brand"' }, { value: '"neutral"' }] } },
    variant: { name: "variant", required: false, description: "", defaultValue: null, parent: nm, declarations: [nm],
      type: { name: "enum", raw: "OverridableStringUnion<…>", value: [{ value: '"text"' }, { value: '"outlined"' }, { value: "string & {}" }] } },
    onFocusVisible: { name: "onFocusVisible", required: false, description: "", defaultValue: null, parent: nm, declarations: [nm], type: { name: "FocusEventHandler" } },
    disabled: { name: "disabled", required: false, description: "", defaultValue: null, parent: nm, declarations: [nm],
      type: { name: "enum", raw: "boolean", value: [{ value: "false" }, { value: "true" }] } },
  },
} as unknown as ComponentDoc;

it("splits own vs inherited, keeps only useful inherited props, unquotes enum literals", () => {
  const { props, inheritedPropCount } = toPropInfo(doc);
  expect(inheritedPropCount).toBe(3);
  expect(props.map((p) => p.name)).toEqual(["tone", "disabled", "variant"]);
  expect(props[0]).toEqual({ name: "tone", type: '"brand" | "neutral"', required: false, defaultValue: "neutral", description: "Tone.", enumValues: ["brand", "neutral"], inherited: false });
  expect(props[1]).toMatchObject({ name: "disabled", type: "boolean", enumValues: ["false", "true"], inherited: true });
  expect(props[2]).toMatchObject({ name: "variant", enumValues: ["text", "outlined"], inherited: true });
});
```

- [ ] **Step 4: Run it to verify it fails, then implement**

Run: `npx vitest run packages/core/src/discovery/props.test.ts`
Expected: FAIL, because the module was not found.

`packages/core/src/discovery/props.ts`:
```ts
import type { ComponentDoc, PropItem } from "react-docgen-typescript";
import type { PropInfo } from "../model";

/** Inherited props worth carrying into the model (demo axes, children, common states). */
const USEFUL_INHERITED = new Set(["children", "variant", "size", "color", "disabled"]);
const NM = /[\\/]node_modules[\\/]/;

const isInherited = (p: PropItem) => {
  const decls = p.declarations?.length ? p.declarations : p.parent ? [p.parent] : [];
  return decls.length > 0 && decls.every((d) => NM.test(d.fileName));
};

function enumValues(p: PropItem): string[] | undefined {
  if (p.type.name !== "enum" || !Array.isArray(p.type.value)) return undefined;
  const vals = (p.type.value as { value: string }[])
    .map((v) => v.value)
    .filter((v) => /^"[^"]*"$/.test(v) || v === "true" || v === "false")
    .map((v) => v.replace(/^"|"$/g, ""));
  return vals.length ? vals : undefined;
}

export function toPropInfo(doc: ComponentDoc): { props: PropInfo[]; inheritedPropCount: number } {
  const own: PropInfo[] = [];
  const inherited: PropInfo[] = [];
  let inheritedPropCount = 0;
  for (const p of Object.values(doc.props)) {
    const inh = isInherited(p);
    if (inh) inheritedPropCount++;
    if (inh && !p.required && !USEFUL_INHERITED.has(p.name)) continue;
    const info: PropInfo = {
      name: p.name,
      type: p.type.name === "enum" ? (p.type.raw ?? "enum") : p.type.name,
      required: p.required,
      inherited: inh,
    };
    if (p.defaultValue?.value !== undefined && p.defaultValue?.value !== null) info.defaultValue = String(p.defaultValue.value);
    if (p.description) info.description = p.description;
    const ev = enumValues(p);
    if (ev) info.enumValues = ev;
    (inh ? inherited : own).push(info);
  }
  inherited.sort((a, b) => a.name.localeCompare(b.name));
  return { props: [...own, ...inherited], inheritedPropCount };
}
```
The `toEqual` in the test requires key order to match. Build `info` in the order name, type, required, inherited, then optional fields. `toEqual` ignores key order anyway, so either order passes.

Run: `npx vitest run packages/core/src/discovery/props.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing discovery integration test**

`packages/adapter-mui/src/discover.integration.test.ts`:
```ts
import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import { loadConfig, discover } from "@designloupe/core/node";
import type { DiscoveryModel } from "@designloupe/core";
import muiNode from "./node";

const configPath = path.resolve(import.meta.dirname, "../../../examples/fixture-loupe/loupe.config.ts");
let model: DiscoveryModel;

beforeAll(async () => {
  model = await discover(await loadConfig(configPath), muiNode);
}, 120_000);

const byName = (n: string) => model.components.find((c) => c.name === n)!;

describe("discover(fixture)", () => {
  it("finds the nine components with the right wrap/custom split", () => {
    expect(model.components.map((c) => c.name).sort()).toEqual(
      ["Broken", "DocsLink", "EmptyState", "InfoCard", "NavLinkButton", "PrimaryButton", "SparkIcon", "StatusPill", "TextInput"],
    );
    expect(byName("PrimaryButton").source).toEqual({ kind: "wraps", library: "MUI", component: "Button" });
    expect(byName("TextInput").source).toEqual({ kind: "wraps", library: "MUI", component: "TextField" });
    expect(byName("InfoCard").source).toEqual({ kind: "wraps", library: "MUI", component: "Card" });
    expect(byName("SparkIcon").source).toEqual({ kind: "wraps", library: "MUI", component: "SvgIcon" });
    expect(byName("StatusPill").source).toEqual({ kind: "custom" });
    expect(byName("EmptyState").source).toEqual({ kind: "custom" });
  });

  it("records ids, folders, props and descriptions", () => {
    const pb = byName("PrimaryButton");
    expect(pb.id).toBe("src/components/PrimaryButton.tsx#PrimaryButton");
    expect(pb.folder).toBe("src/components");
    expect(pb.description).toBe("The main call-to-action button.");
    expect(pb.props[0]).toMatchObject({ name: "tone", enumValues: ["brand", "neutral"], inherited: false });
    expect(pb.inheritedPropCount).toBeGreaterThan(20);
    expect(byName("SparkIcon").folder).toBe("src/components/icons");
  });

  it("computes built-from (library + own) and usages", () => {
    const card = byName("InfoCard");
    expect(card.builtFrom.library).toEqual(["Card", "CardContent", "Typography"]);
    expect(card.builtFrom.own).toEqual(["src/components/StatusPill.tsx#StatusPill"]);
    const sites = byName("PrimaryButton").usages.map((u) => u.file).sort();
    expect(sites).toEqual(["src/features/Dashboard.tsx", "src/features/Settings.tsx", "src/features/Settings.tsx"]);
    expect(byName("StatusPill").usages).toEqual([{ file: "src/components/InfoCard.tsx", line: 17 }]);
  });

  it("collects raw library usage outside component globs", () => {
    const names = model.libraryUsage.map((u) => u.component).sort();
    expect(names).toEqual(["Button", "Chip", "Stack"]);
    expect(model.libraryUsage.every((u) => u.sites.every((s) => s.file === "src/features/Dashboard.tsx"))).toBe(true);
  });

  it("collects library and custom icons", () => {
    const icons = model.icons.map((i) => `${i.source}:${i.name}`).sort();
    expect(icons).toEqual(["custom:SparkIcon", "library:Delete"]);
    expect(model.icons.find((i) => i.name === "Delete")!.sites).toHaveLength(1);
    expect(byName("SparkIcon").isIcon).toBe(true);
  });

  it("collects the planted static findings", () => {
    const f = model.findings.map((x) => `${x.file}|${x.rule}|${x.snippet}`).sort();
    expect(f).toEqual([
      "src/components/StatusPill.tsx|colour-literal|bgcolor: #e8f5e9",
      "src/components/StatusPill.tsx|px-spacing|px: 6px",
      "src/features/Dashboard.tsx|colour-literal|color: rgb(10, 20, 30)",
    ]);
  });

  it("reads library metadata", () => {
    expect(model.libraryName).toBe("MUI");
    expect(model.libraryVersion).toMatch(/^9\./);
    expect(model.themeExport).toBe("theme");
    expect(model.warnings).toEqual([]);
  });
});
```
Add `"@designloupe/core": "0.1.0"` to `packages/adapter-mui/package.json` dependencies (already present from Task 1).

Run: `npx vitest run packages/adapter-mui/src/discover.integration.test.ts`
Expected: FAIL, because `discover` is not exported.

- [ ] **Step 6: Implement discovery**

`packages/core/src/discovery/package-version.ts`:
```ts
import fs from "node:fs";
import path from "node:path";

/** Walk up from `root` looking for node_modules/<pkg>/package.json (works with hoisted monorepos). */
export function readPackageVersion(root: string, pkg: string): string | undefined {
  let dir = path.resolve(root);
  for (;;) {
    const candidate = path.join(dir, "node_modules", pkg, "package.json");
    if (fs.existsSync(candidate)) {
      try {
        return JSON.parse(fs.readFileSync(candidate, "utf8")).version;
      } catch {
        return undefined;
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}
```

`packages/core/src/discovery/discover.ts`:
```ts
import fs from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import type { ResolvedConfig } from "../config/schema";
import type { AdapterNode } from "../adapter";
import type { CallSite, ComponentInfo, DiscoveryModel, IconInfo, LibraryUsage, StaticFinding } from "../model";
import { createAnalysis } from "../analysis/program";
import { scanSource, type FileScan } from "../analysis/scan-file";
import { findStaticIssues } from "../anomalies/static-rules";
import { toPropInfo } from "./props";
import { readPackageVersion } from "./package-version";

const posix = (p: string) => p.split(path.sep).join("/");

export async function discover(config: ResolvedConfig, adapter: AdapterNode): Promise<DiscoveryModel> {
  const { root } = config;
  const rel = (abs: string) => posix(path.relative(root, abs));
  const warnings: string[] = [];
  const analysis = createAnalysis(root, config.tsconfig);
  const globOpts = { cwd: root, absolute: true, ignore: [...config.ignoreGlobs, "**/node_modules/**"] };
  const componentFiles = (await fg(config.componentGlobs, globOpts)).map((f) => path.resolve(f)).sort();
  const usageFiles = (await fg(config.usageGlobs, globOpts)).map((f) => path.resolve(f)).sort();
  const componentSet = new Set(componentFiles);
  if (!componentFiles.length) warnings.push(`No files matched componentGlobs (${config.componentGlobs.join(", ")}).`);
  if (!config.themeEntry) warnings.push("No themeEntry configured: token and override pages are disabled.");

  // ── scanning (lazy, cached; barrels outside the globs are scanned on demand) ──
  const scans = new Map<string, FileScan>();
  const getScan = (file: string): FileScan | undefined => {
    if (scans.has(file)) return scans.get(file);
    if (!fs.existsSync(file)) return undefined;
    const s = scanSource(file, fs.readFileSync(file, "utf8"), analysis.resolve);
    scans.set(file, s);
    return s;
  };
  for (const f of new Set([...componentFiles, ...usageFiles])) getScan(f);

  // ── components ──
  let docs: ReturnType<typeof analysis.parseProps> = [];
  try {
    docs = analysis.parseProps(componentFiles);
  } catch (e) {
    warnings.push(`Props extraction failed: ${(e as Error).message}`);
  }

  const components: ComponentInfo[] = [];
  const byFileExport = new Map<string, ComponentInfo>(); // `${absFile}#${exportName}`
  for (const file of componentFiles) {
    const scan = getScan(file)!;
    for (const doc of docs.filter((d) => path.resolve(d.filePath) === file)) {
      const exportName = scan.exports.includes(doc.displayName) ? doc.displayName : scan.exports.includes("default") ? "default" : undefined;
      if (!exportName) continue;
      const relFile = rel(file);
      const { props, inheritedPropCount } = toPropInfo(doc);
      const c: ComponentInfo = {
        id: `${relFile}#${exportName}`,
        name: doc.displayName,
        exportName,
        file: relFile,
        folder: path.posix.dirname(relFile),
        source: { kind: "custom" },
        props,
        inheritedPropCount,
        builtFrom: { library: [], own: [] },
        usages: [],
        isIcon: false,
      };
      if (doc.description) c.description = doc.description;
      components.push(c);
      byFileExport.set(`${file}#${exportName}`, c);
    }
  }

  /** Follow barrels: which component does `imported` from `file` refer to? */
  const resolveExport = (file: string, imported: string, depth = 0): ComponentInfo | undefined => {
    const direct = byFileExport.get(`${file}#${imported}`);
    if (direct || depth > 5) return direct;
    const scan = getScan(file);
    if (!scan) return undefined;
    for (const re of scan.reExports) {
      if (!re.resolvedFile) continue;
      if (re.exported === imported) {
        const hit = resolveExport(re.resolvedFile, re.imported, depth + 1);
        if (hit) return hit;
      }
      if (re.exported === "*") {
        const hit = resolveExport(re.resolvedFile, imported, depth + 1);
        if (hit) return hit;
      }
    }
    return undefined;
  };

  // ── built-from + wraps ──
  const primitives = new Set(adapter.layoutPrimitives);
  for (const c of components) {
    const scan = getScan(path.join(root, c.file))!;
    const rendered = [...scan.jsx.map((j) => j.tag), ...scan.styledTargets];
    const library: string[] = [];
    const own: string[] = [];
    for (const tag of rendered) {
      const b = scan.imports.find((i) => i.local === tag);
      if (!b) continue;
      const lib = adapter.classifyImport(b.specifier, b.imported);
      if (lib && !library.includes(lib)) library.push(lib);
      if (b.resolvedFile) {
        const target = resolveExport(b.resolvedFile, b.imported);
        if (target && target.id !== c.id && !own.includes(target.id)) own.push(target.id);
      }
    }
    c.builtFrom = { library, own };
    const wrappable = library.filter((l) => !primitives.has(l));
    if (wrappable.length) {
      const pick = wrappable.find((l) => c.name.includes(l)) ?? wrappable[0]!;
      c.source = { kind: "wraps", library: adapter.libraryName, component: pick };
    }
    c.isIcon = c.name.endsWith("Icon") || library.includes("SvgIcon");
  }

  // ── usages, raw library usage, icons ──
  const libraryUsage = new Map<string, CallSite[]>();
  const libIcons = new Map<string, IconInfo>();
  for (const scan of scans.values()) {
    const relFile = rel(scan.file);
    const isComponentFile = componentSet.has(scan.file);
    for (const b of scan.imports) {
      const sites = (): CallSite[] => scan.jsx.filter((j) => j.tag === b.local).map((j) => ({ file: relFile, line: j.line }));
      if (b.resolvedFile) {
        const target = resolveExport(b.resolvedFile, b.imported);
        if (target && target.file !== relFile) target.usages.push(...sites());
      }
      const lib = adapter.classifyImport(b.specifier, b.imported);
      if (lib && !isComponentFile) libraryUsage.set(lib, [...(libraryUsage.get(lib) ?? []), ...sites()]);
      const icon = adapter.classifyIconImport(b.specifier, b.imported);
      if (icon) {
        const key = `${b.specifier}#${icon}`;
        const entry = libIcons.get(key) ?? { name: icon, source: "library" as const, importPath: b.specifier, sites: [] };
        entry.sites.push(...sites());
        libIcons.set(key, entry);
      }
    }
  }
  for (const c of components) c.usages.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

  const icons: IconInfo[] = [
    ...libIcons.values(),
    ...components.filter((c) => c.isIcon).map((c) => ({ name: c.name, source: "custom" as const, importPath: c.file, componentId: c.id, sites: c.usages })),
  ].sort((a, b) => a.name.localeCompare(b.name));

  // ── static findings ──
  const findings: StaticFinding[] = [];
  for (const scan of scans.values()) {
    if (!componentSet.has(scan.file) && !usageFiles.includes(scan.file)) continue; // skip barrels pulled in on demand
    findings.push(...findStaticIssues(rel(scan.file), fs.readFileSync(scan.file, "utf8")));
  }

  return {
    name: config.name,
    root,
    adapter: adapter.id,
    libraryName: adapter.libraryName,
    libraryVersion: readPackageVersion(root, adapter.packageName),
    themeEntry: config.themeEntry ? rel(config.themeEntry) : undefined,
    themeExport: config.themeExport,
    components: components.sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name)),
    libraryUsage: [...libraryUsage.entries()]
      .filter(([, sites]) => sites.length)
      .map(([component, sites]): LibraryUsage => ({ component, sites }))
      .sort((a, b) => b.sites.length - a.sites.length || a.component.localeCompare(b.component)),
    icons,
    findings,
    warnings,
    generatedAt: new Date().toISOString(),
  };
}
```

Append to `packages/core/src/node.ts`:
```ts
export { discover } from "./discovery/discover";
export { toPropInfo } from "./discovery/props";
export { readPackageVersion } from "./discovery/package-version";
```

- [ ] **Step 7: Run the integration test**

Run: `npx vitest run packages/adapter-mui/src/discover.integration.test.ts`
Expected: all pass.

If `StatusPill`'s usage line isn't 17, count the lines in `InfoCard.tsx` as written in Task 2 and correct the **test**. The `<StatusPill` element is on the line after `{body && …}`. Don't change the fixture to match the test.

If `InfoCard.builtFrom.library` order differs, check the scanner visits JSX in source order: Card, CardContent, Typography. The second Typography is deduplicated.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: MUI node adapter and discovery (components, props, built-from, usage, icons, findings)"
```

---

### Task 7: MUI browser adapter (tokens, overrides, preview components)

**Files:**
- Create: `packages/adapter-mui/src/{serialise.ts,tokens.ts,overrides.ts,browser.tsx}`
- Test: `packages/adapter-mui/src/{serialise.test.ts,tokens.test.ts,overrides.test.ts}`

**Interfaces:**
- Consumes: `AdapterBrowser`, `TokenModel`, `OverrideEntry` and `ContrastPair` (Task 3).
- Produces:
  - `serialise(value: unknown, indent?: number): string`
  - `readTokens(theme): TokenModel`
  - `readOverrides(theme): OverrideEntry[]`
  - `resolveColour(theme, mode, path)`
  - `contrastPairs(theme)`
  - `muiBrowser: AdapterBrowser`, the default export of `@designloupe/adapter-mui/browser`

- [ ] **Step 1: Write the failing tests**

`packages/adapter-mui/src/serialise.test.ts`:
```ts
import { it, expect } from "vitest";
import { serialise } from "./serialise";

it("pretty-prints objects, arrays, quoted keys and functions as source", () => {
  const out = serialise({ root: { textTransform: "none", "&:hover": { opacity: 0.8 } }, list: [1, "a"], fn: (x: number) => x + 1, none: undefined });
  expect(out).toBe(
    [
      "{",
      "  root: {",
      '    textTransform: "none",',
      '    "&:hover": {',
      "      opacity: 0.8",
      "    }",
      "  },",
      "  list: [",
      "    1,",
      '    "a"',
      "  ],",
      "  fn: (x) => x + 1,",
      "  none: undefined",
      "}",
    ].join("\n"),
  );
  expect(serialise({})).toBe("{}");
  expect(serialise([])).toBe("[]");
});
```
Vitest transpiles `(x: number) => x + 1` to `(x) => x + 1`. If the transform emits different whitespace, assert with `toContain("fn: (x) =>")` instead of comparing the whole string.

`packages/adapter-mui/src/tokens.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createTheme } from "@mui/material/styles";
import { theme } from "../../../examples/mui-fixture/src/theme";
import { readTokens, resolveColour, contrastPairs } from "./tokens";

describe("readTokens", () => {
  const t = readTokens(theme);

  it("reads both colour schemes with custom palette keys, skipping channels and component palettes", () => {
    expect(t.schemes.map((s) => s.mode)).toEqual(["light", "dark"]);
    const light = t.schemes[0]!;
    const names = light.groups.map((g) => g.name);
    expect(names).toEqual(expect.arrayContaining(["primary", "secondary", "brand", "warning", "text", "background", "grey", "divider"]));
    expect(names.some((n) => /^[A-Z]/.test(n))).toBe(false);
    const primary = light.groups.find((g) => g.name === "primary")!;
    expect(primary.tokens).toContainEqual({ path: "palette.primary.main", value: "#2f6544" });
    expect(primary.tokens.some((tk) => tk.path.endsWith("Channel"))).toBe(false);
  });

  it("reads typography variants including custom ones", () => {
    const variants = t.typography.map((v) => v.variant);
    expect(variants).toEqual(expect.arrayContaining(["h1", "h6", "body1", "button", "caption", "overline", "eyebrow"]));
    expect(t.typography.find((v) => v.variant === "eyebrow")!.style.letterSpacing).toBe("0.12em");
  });

  it("reads spacing, shape, shadows, zIndex, transitions, breakpoints", () => {
    expect(t.spacing.map((s) => s.factor)).toEqual([0, 0.5, 1, 2, 3, 4, 5, 6, 8, 10, 12]);
    expect(t.shape).toEqual([{ name: "borderRadius", value: "10px" }]);
    expect(t.shadows).toHaveLength(25);
    expect(t.zIndex.find((z) => z.name === "modal")!.value).toBe(1300);
    expect(t.transitions.durations.find((d) => d.name === "short")!.ms).toBe(250);
    expect(t.transitions.easings.find((e) => e.name === "easeInOut")!.value).toContain("cubic-bezier");
    expect(t.breakpoints).toEqual([
      { name: "xs", min: 0 }, { name: "sm", min: 600 }, { name: "md", min: 900 }, { name: "lg", min: 1200 }, { name: "xl", min: 1536 },
    ]);
  });

  it("falls back to theme.palette when there are no colour schemes", () => {
    const plain = readTokens(createTheme({ palette: { mode: "dark" } }));
    expect(plain.schemes.map((s) => s.mode)).toEqual(["dark"]);
  });
});

describe("resolveColour / contrastPairs", () => {
  it("resolves token paths per mode", () => {
    expect(resolveColour(theme, "light", "palette.primary.main")).toBe("#2f6544");
    expect(resolveColour(theme, "dark", "palette.primary.main")).toBe("#8fd1a8");
    expect(resolveColour(theme, "light", "palette.nope.main")).toBeUndefined();
  });

  it("lists contrastText-on-main and text-on-background pairs for each mode", () => {
    const pairs = contrastPairs(theme);
    expect(pairs).toContainEqual({ mode: "light", label: "warning text on main", fg: "palette.warning.contrastText", bg: "palette.warning.main", kind: "text" });
    expect(pairs).toContainEqual({ mode: "dark", label: "text.primary on background.default", fg: "palette.text.primary", bg: "palette.background.default", kind: "text" });
  });
});
```

`packages/adapter-mui/src/overrides.test.ts`:
```ts
import { it, expect } from "vitest";
import { theme } from "../../../examples/mui-fixture/src/theme";
import { readOverrides } from "./overrides";

it("lists customised components with serialised defaultProps, styleOverrides and variants", () => {
  const o = readOverrides(theme);
  expect(o.map((x) => x.key)).toEqual(["MuiButton", "MuiCard", "MuiTextField"]);
  const btn = o[0]!;
  expect(btn.component).toBe("Button");
  expect(btn.defaultProps).toContain("disableElevation: true");
  expect(btn.styleOverrides).toContain('textTransform: "none"');
  expect(btn.variants).toHaveLength(1);
  expect(btn.variants![0]!.props).toContain('variant: "dashed"');
  expect(btn.variants![0]!.style).toContain("dashed");
  expect(o[1]!.styleOverrides).toBeUndefined();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run packages/adapter-mui/src/serialise.test.ts packages/adapter-mui/src/tokens.test.ts packages/adapter-mui/src/overrides.test.ts`
Expected: FAIL, because the modules were not found.

- [ ] **Step 3: Implement serialise, tokens and overrides**

`packages/adapter-mui/src/serialise.ts`:
```ts
const IDENT = /^[A-Za-z_$][\w$]*$/;

/** Readable JS-ish source for theme values. Functions print as their source text. */
export function serialise(v: unknown, indent = 0): string {
  const pad = "  ".repeat(indent + 1);
  const end = "  ".repeat(indent);
  if (typeof v === "function") return v.toString();
  if (v === undefined) return "undefined";
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return v.length ? `[\n${v.map((x) => pad + serialise(x, indent + 1)).join(",\n")}\n${end}]` : "[]";
  const entries = Object.entries(v as Record<string, unknown>);
  if (!entries.length) return "{}";
  const body = entries.map(([k, x]) => `${pad}${IDENT.test(k) ? k : JSON.stringify(k)}: ${serialise(x, indent + 1)}`).join(",\n");
  return `{\n${body}\n${end}}`;
}
```

`packages/adapter-mui/src/tokens.ts`:
```ts
import type { ContrastPair, Mode, PaletteGroup, TokenModel, TypographyToken } from "@designloupe/core";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const SKIP_PALETTE = new Set(["mode", "contrastThreshold", "tonalOffset"]);
const SPACING_FACTORS = [0, 0.5, 1, 2, 3, 4, 5, 6, 8, 10, 12];

function schemePalettes(theme: Obj): { mode: Mode; palette: Obj }[] {
  const cs = theme.colorSchemes;
  if (isObj(cs)) {
    const out: { mode: Mode; palette: Obj }[] = [];
    for (const mode of ["light", "dark"] as const) {
      const s = cs[mode];
      if (isObj(s) && isObj(s.palette)) out.push({ mode, palette: s.palette });
    }
    if (out.length) return out;
  }
  const palette = (theme.palette ?? {}) as Obj;
  return [{ mode: palette.mode === "dark" ? "dark" : "light", palette }];
}

export function paletteGroups(palette: Obj): PaletteGroup[] {
  const groups: PaletteGroup[] = [];
  for (const [key, val] of Object.entries(palette)) {
    if (SKIP_PALETTE.has(key) || key.endsWith("Channel") || /^[A-Z]/.test(key)) continue;
    if (typeof val === "string" && key === "divider") {
      groups.push({ name: "divider", tokens: [{ path: "palette.divider", value: val }] });
      continue;
    }
    if (!isObj(val)) continue;
    const tokens = Object.entries(val)
      .filter(([k, v]) => typeof v === "string" && !k.endsWith("Channel"))
      .map(([k, v]) => ({ path: `palette.${key}.${k}`, value: v as string }));
    if (tokens.length) groups.push({ name: key, tokens });
  }
  return groups;
}

function typographyTokens(typography: Obj): TypographyToken[] {
  const out: TypographyToken[] = [];
  for (const [variant, val] of Object.entries(typography)) {
    if (!isObj(val) || !("fontSize" in val || "fontFamily" in val || "fontWeight" in val)) continue;
    const style: TypographyToken["style"] = {};
    const responsive: TypographyToken["responsive"] = [];
    for (const [k, v] of Object.entries(val)) {
      if (typeof v === "string" || typeof v === "number") style[k] = v;
      else if (k.startsWith("@media") && isObj(v))
        responsive.push({ query: k, style: Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x === "string" || typeof x === "number")) as TypographyToken["style"] });
    }
    out.push({ variant, style, responsive });
  }
  return out;
}

export function readTokens(themeIn: unknown): TokenModel {
  const theme = themeIn as Obj & { spacing: (n: number) => string };
  const t = (theme.transitions ?? {}) as { duration?: Obj; easing?: Obj };
  const bp = (theme.breakpoints ?? {}) as { keys?: string[]; values?: Record<string, number> };
  return {
    schemes: schemePalettes(theme).map(({ mode, palette }) => ({ mode, groups: paletteGroups(palette) })),
    typography: typographyTokens((theme.typography ?? {}) as Obj),
    spacing: SPACING_FACTORS.map((factor) => ({ factor, value: String(theme.spacing(factor)) })),
    shape: Object.entries((theme.shape ?? {}) as Obj)
      .filter(([, v]) => typeof v === "number" || typeof v === "string")
      .map(([name, v]) => ({ name, value: typeof v === "number" ? `${v}px` : (v as string) })),
    shadows: ((theme.shadows ?? []) as string[]).slice(),
    zIndex: Object.entries((theme.zIndex ?? {}) as Obj)
      .filter(([, v]) => typeof v === "number")
      .map(([name, v]) => ({ name, value: v as number }))
      .sort((a, b) => a.value - b.value),
    transitions: {
      durations: Object.entries(t.duration ?? {}).filter(([, v]) => typeof v === "number").map(([name, v]) => ({ name, ms: v as number })),
      easings: Object.entries(t.easing ?? {}).filter(([, v]) => typeof v === "string").map(([name, v]) => ({ name, value: v as string })),
    },
    breakpoints: (bp.keys ?? []).map((name) => ({ name, min: bp.values?.[name] ?? 0 })),
  };
}

export function resolveColour(themeIn: unknown, mode: Mode, path: string): string | undefined {
  const schemes = schemePalettes(themeIn as Obj);
  const palette = (schemes.find((s) => s.mode === mode) ?? schemes[0])!.palette;
  const parts = path.replace(/^palette\./, "").split(".");
  let cur: unknown = palette;
  for (const p of parts) {
    if (!isObj(cur)) return undefined;
    cur = cur[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

export function contrastPairs(themeIn: unknown): ContrastPair[] {
  const pairs: ContrastPair[] = [];
  for (const { mode, palette } of schemePalettes(themeIn as Obj)) {
    for (const g of paletteGroups(palette)) {
      const has = (k: string) => g.tokens.some((t) => t.path === `palette.${g.name}.${k}`);
      if (has("main") && has("contrastText"))
        pairs.push({ mode, label: `${g.name} text on main`, fg: `palette.${g.name}.contrastText`, bg: `palette.${g.name}.main`, kind: "text" });
    }
    for (const [fg, bg] of [["text.primary", "background.default"], ["text.secondary", "background.default"], ["text.primary", "background.paper"]] as const) {
      if (resolveColour(themeIn, mode, `palette.${fg}`) && resolveColour(themeIn, mode, `palette.${bg}`))
        pairs.push({ mode, label: `${fg} on ${bg}`, fg: `palette.${fg}`, bg: `palette.${bg}`, kind: "text" });
    }
  }
  return pairs;
}
```

`packages/adapter-mui/src/overrides.ts`:
```ts
import type { OverrideEntry } from "@designloupe/core";
import { serialise } from "./serialise";

type Obj = Record<string, unknown>;

export function readOverrides(themeIn: unknown): OverrideEntry[] {
  const components = ((themeIn as Obj).components ?? {}) as Record<string, Obj>;
  return Object.entries(components)
    .map(([key, def]): OverrideEntry => {
      const e: OverrideEntry = { key, component: key.replace(/^Mui/, "") };
      if (def.defaultProps !== undefined) e.defaultProps = serialise(def.defaultProps);
      if (def.styleOverrides !== undefined) e.styleOverrides = serialise(def.styleOverrides);
      if (Array.isArray(def.variants) && def.variants.length)
        e.variants = (def.variants as Obj[]).map((v) => ({ props: serialise(v.props), style: serialise(v.style) }));
      return e;
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run packages/adapter-mui`
Expected: all pass.
- If `divider` is missing from the light groups, check whether MUI's palette stores `divider` as a string. It should; it's handled specially above.
- If `grey` appears in the dark scheme only, that's fine. The test checks light.
- If a palette field such as `action.selectedOpacity` makes a group noisy, that's expected. Numbers are already filtered out.

- [ ] **Step 5: Preview components (`browser.tsx`)**

First check the ThemeProvider props on the installed MUI:
Run: `grep -rn "storageManager\|disableTransitionOnChange\|defaultMode" node_modules/@mui/material/styles/ThemeProvider.d.ts`
Expected: all three props are listed. If `storageManager` is missing, drop that prop below. Colour-scheme state then persists in `localStorage` under MUI's default keys; that's acceptable for a local tool.

`packages/adapter-mui/src/browser.tsx`:
```tsx
import { useEffect, type ReactNode } from "react";
import { ThemeProvider, createTheme, useColorScheme, type Theme } from "@mui/material/styles";
import ScopedCssBaseline from "@mui/material/ScopedCssBaseline";
import Typography from "@mui/material/Typography";
import type { AdapterBrowser, Mode } from "@designloupe/core";
import { readTokens, resolveColour, contrastPairs } from "./tokens";
import { readOverrides } from "./overrides";

type Obj = Record<string, unknown>;
const defaultTheme = createTheme();

function ModeSync({ mode }: { mode: Mode }) {
  const { setMode } = useColorScheme();
  useEffect(() => {
    setMode?.(mode);
  }, [mode, setMode]);
  return null;
}

function PreviewRoot({ theme, mode, children }: { theme: unknown; mode: Mode; children: ReactNode }) {
  return (
    <ThemeProvider theme={theme as Theme} defaultMode={mode} storageManager={null} disableTransitionOnChange>
      <ModeSync mode={mode} />
      {children}
    </ThemeProvider>
  );
}

function PreviewFrame({ children }: { children: ReactNode }) {
  return (
    <ScopedCssBaseline sx={{ bgcolor: "background.default", color: "text.primary", p: 3, borderRadius: 1 }}>
      {children}
    </ScopedCssBaseline>
  );
}

function DefaultThemeFrame({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={defaultTheme}>
      <ScopedCssBaseline sx={{ p: 3, borderRadius: 1 }}>{children}</ScopedCssBaseline>
    </ThemeProvider>
  );
}

function TypographySample({ variant, children }: { variant: string; children: ReactNode }) {
  return <Typography variant={variant as never}>{children}</Typography>;
}

const muiBrowser: AdapterBrowser = {
  id: "mui",
  libraryName: "MUI",
  isTheme: (v) => !!v && typeof v === "object" && "palette" in (v as Obj) && typeof (v as Obj).spacing === "function",
  hasDarkScheme: (t) => !!((t as Obj).colorSchemes as Obj | undefined)?.dark,
  readTokens,
  readOverrides,
  resolveColour,
  contrastPairs,
  PreviewRoot,
  PreviewFrame,
  DefaultThemeFrame,
  TypographySample,
};

export default muiBrowser;
```

Run: `npm run typecheck`
Expected: no errors in `packages/adapter-mui`. Errors elsewhere from later tasks don't exist yet.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(adapter-mui): token/override readers, contrast pairs and preview components"
```

---
### Task 8: CLI, Vite plugin and Next shims

**Files:**
- Create: `packages/cli/src/{paths.ts,vite-plugin.ts,next-font.ts,server.ts,bin.ts}`
- Create: `packages/viewer/index.html`, `packages/viewer/src/main.tsx` (placeholder; replaced in Task 9), `packages/viewer/src/virtual.d.ts`
- Create: `packages/viewer/src/shims/next/{link.tsx,image.tsx,navigation.ts,router.tsx,dynamic.tsx,head.tsx}`
- Test: `packages/cli/src/server.test.ts`, `packages/cli/src/next-font.test.ts`

**Interfaces:**
- Consumes:
  - `loadConfig`, `ConfigError` and `discover` (`@designloupe/core/node`)
  - `muiNode` (`@designloupe/adapter-mui/node`)
  - the `ResolvedConfig` and `DiscoveryModel` types
- Produces:
  - `createLoupeServer(config: ResolvedConfig, opts?: { port?: number; open?: boolean; middlewareMode?: boolean }): Promise<ViteDevServer>`
  - `loupePlugin(opts: { config: ResolvedConfig; model: DiscoveryModel; rediscover: () => Promise<DiscoveryModel> }): Plugin`
  - `rewriteNextFontImports(code: string): string | null`
  - The virtual modules, which the viewer consumes. Their exact shapes are in `virtual.d.ts`:
    - `virtual:loupe/model` → `default: DiscoveryModel`
    - `virtual:loupe/components` → `default: Record<componentId, () => Promise<module>>`
    - `virtual:loupe/theme` → `loadTheme: null | (() => Promise<unknown>)`
    - `virtual:loupe/wrapper` → `loadWrapper: null | (() => Promise<ComponentType<{children}>>)`
    - `virtual:loupe/loupe-files` → `componentDocs: (() => Promise<{default: ComponentDocInput}>)[]`, `loadAnomalies`, `loadTokenNotes`
    - `virtual:loupe/adapter` → `default: AdapterBrowser`
    - `virtual:loupe/icons` → `default: Record<iconName, () => Promise<{ default: Component }>>` (library icons only)

- [ ] **Step 1: Write the failing tests**

`packages/cli/src/next-font.test.ts`:
```ts
import { it, expect } from "vitest";
import { rewriteNextFontImports } from "./next-font";

it("rewrites named and default next/font imports to a stub", () => {
  const code = `import { Inter, Roboto_Mono as Mono } from "next/font/google";\nimport localFont from 'next/font/local';\nconst a = 1;`;
  const out = rewriteNextFontImports(code)!;
  expect(out).toContain(`import { loupeFont as __loupeFont } from "virtual:loupe/next-font";`);
  expect(out).toContain("const Inter = __loupeFont;");
  expect(out).toContain("const Mono = __loupeFont;");
  expect(out).toContain("const localFont = __loupeFont;");
  expect(out).not.toContain("next/font");
  expect(rewriteNextFontImports("const x = 1;")).toBeNull();
});
```

`packages/cli/src/server.test.ts`:
```ts
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
    expect(react?.id).toMatch(/node_modules[\\/]react[\\/]/);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run packages/cli`
Expected: FAIL, because the modules were not found.

- [ ] **Step 3: Implement paths and the next/font rewrite**

`packages/cli/src/paths.ts`:
```ts
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
export const VIEWER_ROOT = path.join(REPO_ROOT, "packages/viewer");
export const NEXT_SHIMS_DIR = path.join(VIEWER_ROOT, "src/shims/next");
```

`packages/cli/src/next-font.ts`:
```ts
const IMPORT = /import\s+(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*["']next\/font\/(?:google|local)["'];?/g;

/** next/font exports one function per font family, so the names can't be known ahead. Rewrite the import into consts. */
export function rewriteNextFontImports(code: string): string | null {
  if (!/["']next\/font\//.test(code)) return null;
  let found = false;
  const out = code.replace(IMPORT, (_m, def: string | undefined, named: string | undefined) => {
    found = true;
    const locals: string[] = [];
    if (def) locals.push(def);
    for (const part of (named ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
      const m = /^(\w+)(?:\s+as\s+(\w+))?$/.exec(part);
      if (m) locals.push(m[2] ?? m[1]!);
    }
    return locals.map((l) => `const ${l} = __loupeFont;`).join(" ");
  });
  return found ? `import { loupeFont as __loupeFont } from "virtual:loupe/next-font";\n${out}` : null;
}
```

Run: `npx vitest run packages/cli/src/next-font.test.ts`
Expected: PASS.

- [ ] **Step 4: Next shims**

`packages/viewer/src/shims/next/link.tsx`:
```tsx
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";

type Href = string | { pathname?: string; query?: Record<string, string> };
type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: Href; children?: ReactNode; prefetch?: unknown; replace?: unknown; scroll?: unknown;
  shallow?: unknown; legacyBehavior?: unknown; passHref?: unknown; locale?: unknown;
};

/** Loupe shim for next/link: a plain anchor that never navigates away from the viewer. */
export default function Link({ href, children, prefetch, replace, scroll, shallow, legacyBehavior, passHref, locale, onClick, ...rest }: Props) {
  const h = typeof href === "string" ? href : (href.pathname ?? "#");
  return (
    <a href={h} {...rest} onClick={(e: MouseEvent<HTMLAnchorElement>) => { e.preventDefault(); onClick?.(e); }}>
      {children}
    </a>
  );
}
```

`packages/viewer/src/shims/next/image.tsx`:
```tsx
import type { CSSProperties, ImgHTMLAttributes } from "react";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string | { src: string }; fill?: boolean; priority?: unknown; placeholder?: unknown;
  blurDataURL?: unknown; loader?: unknown; quality?: unknown; unoptimized?: unknown;
};
const FILL: CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" };

/** Loupe shim for next/image: a plain <img>. */
export default function Image({ src, fill, priority, placeholder, blurDataURL, loader, quality, unoptimized, style, ...rest }: Props) {
  return <img src={typeof src === "string" ? src : src.src} style={fill ? { ...FILL, ...style } : style} {...rest} />;
}
```

`packages/viewer/src/shims/next/navigation.ts`:
```ts
/** Loupe shim for next/navigation (App Router hooks). */
const router = { push() {}, replace() {}, back() {}, forward() {}, refresh() {}, prefetch() {} };
export const useRouter = () => router;
export const usePathname = () => "/";
export const useSearchParams = () => new URLSearchParams();
export const useParams = () => ({});
export const useSelectedLayoutSegment = () => null;
export const useSelectedLayoutSegments = () => [];
export function redirect(url: string): never { throw new Error(`next/navigation redirect(${url}) called in Loupe`); }
export function notFound(): never { throw new Error("next/navigation notFound() called in Loupe"); }
```

`packages/viewer/src/shims/next/router.tsx`:
```tsx
import type { ComponentType } from "react";

/** Loupe shim for next/router (Pages Router). */
const router = {
  pathname: "/", route: "/", asPath: "/", query: {}, basePath: "", isReady: true, isFallback: false,
  push: async () => true, replace: async () => true, reload() {}, back() {}, prefetch: async () => {},
  events: { on() {}, off() {}, emit() {} },
};
export const useRouter = () => router;
export function withRouter<P>(C: ComponentType<P & { router: typeof router }>) {
  return (props: P) => <C {...props} router={router} />;
}
export default router;
```

`packages/viewer/src/shims/next/dynamic.tsx`:
```tsx
import { lazy, Suspense, type ComponentType } from "react";

type Loader = () => Promise<ComponentType<any> | { default: ComponentType<any> }>;

/** Loupe shim for next/dynamic: React.lazy + Suspense. */
export default function dynamic(loader: Loader, _opts?: unknown) {
  const L = lazy(async () => {
    const m = await loader();
    return { default: "default" in m ? m.default : m };
  });
  return (props: Record<string, unknown>) => (
    <Suspense fallback={null}>
      <L {...props} />
    </Suspense>
  );
}
```

`packages/viewer/src/shims/next/head.tsx`:
```tsx
/** Loupe shim for next/head: renders nothing. */
export default function Head(_: { children?: unknown }) {
  return null;
}
```

- [ ] **Step 5: The Vite plugin**

`packages/cli/src/vite-plugin.ts`:
```ts
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
```
Note the `@designloupe/` branch: loupe files outside this repo can't find `node_modules/@designloupe`, so the import is resolved as if from the repo root.

- [ ] **Step 6: The server and the bin**

`packages/cli/src/server.ts`:
```ts
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
```

`packages/cli/src/bin.ts`:
```ts
#!/usr/bin/env -S npx tsx
import { cac } from "cac";
import { loadConfig, ConfigError } from "@designloupe/core/node";
import { createLoupeServer } from "./server";

const cli = cac("designloupe");

cli
  .command("dev", "Start the Design Loupe viewer")
  .option("--config <path>", "Path to loupe.config.ts", { default: "loupe.config.ts" })
  .option("--port <port>", "Port (default 5179)")
  .option("--open", "Open the browser")
  .action(async (o: { config: string; port?: string; open?: boolean }) => {
    const config = await loadConfig(o.config);
    const server = await createLoupeServer(config, { port: o.port ? Number(o.port) : undefined, open: o.open });
    await server.listen();
    console.log(`\n  Design Loupe — ${config.name}`);
    server.printUrls();
  });

cli
  .command("doctor", "Check the config and that every target module loads")
  .option("--config <path>", "Path to loupe.config.ts", { default: "loupe.config.ts" })
  .action(async (o: { config: string }) => {
    const { runDoctor } = await import("./doctor");
    process.exitCode = await runDoctor(await loadConfig(o.config));
  });

cli.help();

try {
  cli.parse(process.argv, { run: false });
  if (!cli.matchedCommand) cli.outputHelp();
  else await cli.runMatchedCommand();
} catch (e) {
  if (e instanceof ConfigError) {
    console.error(`\n  ✗ Config error in "${e.field}": ${e.message}\n`);
    process.exit(2);
  }
  throw e;
}
```
`doctor.ts` doesn't exist until Task 14. The dynamic import means `dev` works without it.

- [ ] **Step 7: Placeholder viewer entry and virtual-module types**

`packages/viewer/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Design Loupe</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`packages/viewer/src/virtual.d.ts`:
```ts
declare module "virtual:loupe/model" {
  const model: import("@designloupe/core").DiscoveryModel;
  export default model;
}
declare module "virtual:loupe/components" {
  const components: Record<string, () => Promise<Record<string, unknown>>>;
  export default components;
}
declare module "virtual:loupe/theme" {
  export const loadTheme: null | (() => Promise<unknown>);
}
declare module "virtual:loupe/wrapper" {
  export const loadWrapper: null | (() => Promise<import("react").ComponentType<{ children: import("react").ReactNode }>>);
}
declare module "virtual:loupe/loupe-files" {
  export const componentDocs: (() => Promise<{ default: import("@designloupe/core").ComponentDocInput }>)[];
  export const loadAnomalies: null | (() => Promise<import("@designloupe/core").Anomaly[]>);
  export const loadTokenNotes: null | (() => Promise<import("@designloupe/core").TokenNotes>);
}
declare module "virtual:loupe/adapter" {
  const adapter: import("@designloupe/core").AdapterBrowser;
  export default adapter;
}
declare module "virtual:loupe/icons" {
  const icons: Record<string, () => Promise<{ default: import("react").ComponentType<Record<string, unknown>> }>>;
  export default icons;
}
```

`packages/viewer/src/main.tsx` (placeholder):
```tsx
import { createRoot } from "react-dom/client";
import model from "virtual:loupe/model";

createRoot(document.getElementById("root")!).render(
  <p>Design Loupe: {model.name}, {model.components.length} components</p>,
);
```

- [ ] **Step 8: Run the tests**

Run: `npx vitest run packages/cli`
Expected: all pass.
- If `server.environments` is undefined, the Vite version is wrong. Check `npx vite --version` reports 8.x.
- If `ssrLoadModule` is missing in Vite 8, replace it in the test with `const { createServerModuleRunner } = await import("vite"); const runner = createServerModuleRunner(server.environments.ssr);` and `runner.import(id)`.
- If loading the PrimaryButton module fails because SSR externalises `@mui/material` and Node can't import it, add `ssr: { noExternal: [/^@mui\//] }` to `base` in `server.ts`.

- [ ] **Step 9: Smoke test the CLI by hand**

Run: `npm run loupe:fixture -- --port 5181` in the background, then `curl -s localhost:5181 | grep -c root` and `curl -s "localhost:5181/@id/__x00__virtual:loupe/model" | head -c 200`.
Expected: `1`, then JavaScript starting with `export default {"name":"MUI fixture"`. Stop the server.

Run: `npx tsx packages/cli/src/bin.ts dev --config nope.ts`
Expected: `✗ Config error in "config": config: file not found: …` and exit code 2.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(cli): dev server with loupe Vite plugin, virtual modules, shared-package resolution and Next shims"
```

---
### Task 9: Viewer shell, state, overview page and Playwright

**Files:**
- Create: `packages/core/src/hints.ts` (+ export from `index.ts`), `packages/core/src/hints.test.ts`
- Create: `packages/viewer/src/{App.tsx,router.ts,state.tsx,groups.ts,styles.css}`
- Replace: `packages/viewer/src/main.tsx`
- Create: `packages/viewer/src/shell/{Shell.tsx,Sidebar.tsx}`
- Create: `packages/viewer/src/ui/{CopyChip.tsx,Panel.tsx,Badge.tsx,PageHeader.tsx,ErrorCard.tsx,Preview.tsx,colour.ts}`
- Create: `packages/viewer/src/pages/{Overview.tsx,NotFound.tsx}`
- Create: `playwright.config.ts`, `e2e/helpers.ts`, `e2e/viewer.spec.ts`
- Test: `packages/viewer/src/groups.test.ts`

**Interfaces:**
- Consumes: every virtual module (Task 8), `AdapterBrowser` (Task 7), and `planAutoDemo`, `mergeAnomalies` and the types from core.
- Produces (used by every page task):
  - `useLoupe(): LoupeState` (state.tsx), with these fields:
    ```ts
    interface LoupeState {
      model: DiscoveryModel; adapter: AdapterBrowser;
      theme: unknown | null; themeError?: string; wrapperError?: string;
      tokens: TokenModel | null; overrides: OverrideEntry[];
      docs: Map<string, ComponentDocInput>;  // by component id
      docErrors: string[]; authoredAnomalies: Anomaly[]; tokenNotes: TokenNotes;
      mode: Mode; setMode(m: Mode): void; canDark: boolean;
      failures: Record<string, string>;      // component id → message
      reportFailure(id: string, message: string): void;
      Wrapper: ComponentType<{ children: ReactNode }> | null; // user wrapper, already applied around the whole viewer by App
    }
    ```
  - `useRoute(): { segments: string[] }`, `href(...segments: string[]): string` (router.ts)
  - `groupComponents(components: ComponentInfo[], docs: Map<string, ComponentDocInput>): ComponentGroup[]`, where `ComponentGroup = { key: string; label: string; items: ComponentInfo[] }` (groups.ts)
  - UI: `<CopyChip text label? />`, `<Panel title count? defaultOpen?>`, `<Badge tone>`, `<PageHeader title lede? source? />`, `<ErrorCard title message hint? />`, and `<Preview id?>`, which renders `PreviewFrame` inside an error boundary and reports to `reportFailure`
  - `cssColourToHex(value: string): string` (ui/colour.ts)
  - `hintFor(message: string): string | undefined` (core)

- [ ] **Step 1: Write the failing tests for hints and grouping**

`packages/core/src/hints.test.ts`:
```ts
import { it, expect } from "vitest";
import { hintFor } from "./hints";

it("maps common failures to the config fix", () => {
  expect(hintFor("useNavigate() may be used only in the context of a <Router> component.")).toMatch(/MemoryRouter/);
  expect(hintFor("You will need to pass in an i18next instance by using initReactI18next")).toMatch(/I18nextProvider/);
  expect(hintFor("No QueryClient set, use QueryClientProvider to set one")).toMatch(/QueryClientProvider/);
  expect(hintFor("could not find react-redux context value")).toMatch(/redux/i);
  expect(hintFor('Failed to resolve import "next/headers" from "src/x.tsx"')).toMatch(/shims/);
  expect(hintFor("process is not defined")).toMatch(/define/);
  expect(hintFor("window is not defined")).toMatch(/browser-only/);
  expect(hintFor("useFoo must be used within a FooProvider")).toMatch(/wrapper/);
  expect(hintFor("something else")).toBeUndefined();
});
```

`packages/viewer/src/groups.test.ts`:
```ts
import { it, expect } from "vitest";
import type { ComponentInfo, ComponentDocInput } from "@designloupe/core";
import { groupComponents } from "./groups";

const c = (name: string, folder: string): ComponentInfo => ({
  id: `${folder}/${name}.tsx#${name}`, name, exportName: name, file: `${folder}/${name}.tsx`, folder,
  source: { kind: "custom" }, props: [], inheritedPropCount: 0, builtFrom: { library: [], own: [] }, usages: [], isIcon: false,
});
const comps = [c("PrimaryButton", "src/components"), c("SparkIcon", "src/components/icons"), c("Broken", "src/components")];

it("groups by folder (common prefix stripped) when no tiers are set", () => {
  const g = groupComponents(comps, new Map());
  expect(g.map((x) => [x.key, x.label, x.items.map((i) => i.name)])).toEqual([
    ["src/components", "components", ["Broken", "PrimaryButton"]],
    ["src/components/icons", "components/icons", ["SparkIcon"]],
  ]);
});

it("groups by tier when any doc sets one, with Unsorted last, and drops hidden components", () => {
  const docs = new Map<string, ComponentDocInput>([
    [comps[0]!.id, { component: comps[0]!.file, tier: "atom" }],
    [comps[2]!.id, { component: comps[2]!.file, hidden: true }],
  ]);
  const g = groupComponents(comps, docs);
  expect(g.map((x) => [x.key, x.label, x.items.map((i) => i.name)])).toEqual([
    ["atom", "Atoms", ["PrimaryButton"]],
    ["unsorted", "Unsorted", ["SparkIcon"]],
  ]);
});
```

- [ ] **Step 2: Run them to verify they fail, then implement**

Run: `npx vitest run packages/core/src/hints.test.ts packages/viewer/src/groups.test.ts`
Expected: FAIL, because the modules were not found.

`packages/core/src/hints.ts`:
```ts
const RULES: [RegExp, string][] = [
  [/useNavigate|useLocation|useHref|useRoutes|<Router>|useParams\(\) may be used/i, "Needs a router. Add a <MemoryRouter> to your wrapper (loupe.config.ts → wrapper)."],
  [/i18next|useTranslation|I18nextProvider/i, "Needs i18n. Initialise i18next and add an <I18nextProvider> to your wrapper."],
  [/QueryClient/i, "Needs React Query. Add a <QueryClientProvider client={new QueryClient()}> to your wrapper."],
  [/react-redux|could not find .*store/i, "Needs a redux store. Add a <Provider store={…}> to your wrapper."],
  [/Failed to resolve import|Failed to fetch dynamically imported module|Cannot find module|does not provide an export named/i, "A module failed to load. For framework modules (next/*, etc.) add a shim in loupe.config.ts → shims, or the matching preset."],
  [/process is not defined|process\.env/i, "Code reads process.env. Add the variable to loupe.config.ts → define, e.g. { \"process.env.API_URL\": '\"\"' }."],
  [/(window|document|localStorage|navigator) is not defined/i, "Touches a browser-only global at import time. It may still work in the viewer: doctor loads modules in Node."],
  [/must be (used|rendered) (with)?in|outside of .*Provider|useContext/i, "A context provider is missing. Add it to your wrapper."],
];

/** A one-line suggestion for a common import/render failure, or undefined. */
export function hintFor(message: string): string | undefined {
  return RULES.find(([re]) => re.test(message))?.[1];
}
```
Append `export { hintFor } from "./hints";` to `packages/core/src/index.ts`.

`packages/viewer/src/groups.ts`:
```ts
import { TIERS, type ComponentDocInput, type ComponentInfo, type Tier } from "@designloupe/core";

export interface ComponentGroup { key: string; label: string; items: ComponentInfo[] }

const TIER_LABEL: Record<Tier, string> = { atom: "Atoms", molecule: "Molecules", macromolecule: "Macromolecules", organelle: "Organelles" };

function commonPrefix(folders: string[]): string {
  if (!folders.length) return "";
  const split = folders.map((f) => f.split("/"));
  const first = split[0]!;
  let i = 0;
  while (i < first.length - 1 && split.every((s) => s[i] === first[i])) i++;
  return first.slice(0, i).join("/");
}

export function groupComponents(components: ComponentInfo[], docs: Map<string, ComponentDocInput>): ComponentGroup[] {
  const visible = components.filter((c) => !docs.get(c.id)?.hidden).sort((a, b) => a.name.localeCompare(b.name));
  const tiered = [...docs.values()].some((d) => d.tier);
  if (tiered) {
    const groups: ComponentGroup[] = TIERS.map((t) => ({ key: t, label: TIER_LABEL[t], items: visible.filter((c) => docs.get(c.id)?.tier === t) }));
    groups.push({ key: "unsorted", label: "Unsorted", items: visible.filter((c) => !docs.get(c.id)?.tier) });
    return groups.filter((g) => g.items.length);
  }
  const folders = [...new Set(visible.map((c) => c.folder))].sort();
  const prefix = commonPrefix(folders);
  const strip = (f: string) => (prefix && f.startsWith(prefix + "/") ? f.slice(prefix.length + 1) : f) || f;
  return folders.map((f) => ({ key: f, label: strip(f), items: visible.filter((c) => c.folder === f) }));
}
```
Check the folder test: the folders are `src/components` and `src/components/icons`. The common prefix of `["src","components"]` and `["src","components","icons"]` is computed with `i < first.length - 1`, so it stops at `src`. The labels are then `components` and `components/icons`, which matches the test.

Run the two tests again. Expected: PASS.

- [ ] **Step 3: Router, colour helper and state**

`packages/viewer/src/router.ts`:
```ts
import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
const read = () => window.location.hash;

/** Hash routes: #/tokens/colour, #/components/<group>/<Name>, #/search/<q>. */
export function useRoute(): { segments: string[] } {
  const hash = useSyncExternalStore(subscribe, read, read);
  const segments = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  return { segments };
}

export const href = (...segments: string[]) => `#/${segments.map(encodeURIComponent).join("/")}`;
```

`packages/viewer/src/ui/colour.ts` (`toHex` ported from trains2somewhere, plus a resolver for `var()`/`color-mix()` values):
```ts
/** Rasterise a CSS colour through a 1×1 canvas → #rrggbb or #rrggbbaa. "" if unavailable. */
export function toHex(color: string): string {
  if (!color || typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return "";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return a === 255 ? `#${h(r!)}${h(g!)}${h(b!)}` : `#${h(r!)}${h(g!)}${h(b!)}${h(a!)}`;
}

/** Like toHex, but resolves var()/color-mix() by letting the browser compute it first. */
export function cssColourToHex(value: string): string {
  if (!/var\(|color-mix\(/.test(value)) return toHex(value);
  const probe = document.createElement("span");
  probe.style.color = value;
  probe.style.display = "none";
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  return toHex(computed);
}
```

`packages/viewer/src/state.tsx`:
```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import model from "virtual:loupe/model";
import adapter from "virtual:loupe/adapter";
import { loadTheme } from "virtual:loupe/theme";
import { loadWrapper } from "virtual:loupe/wrapper";
import { componentDocs, loadAnomalies, loadTokenNotes } from "virtual:loupe/loupe-files";
import type { AdapterBrowser, Anomaly, ComponentDocInput, DiscoveryModel, Mode, OverrideEntry, TokenModel, TokenNotes } from "@designloupe/core";

export interface LoupeState {
  model: DiscoveryModel;
  adapter: AdapterBrowser;
  theme: unknown | null;
  themeError?: string;
  wrapperError?: string;
  tokens: TokenModel | null;
  overrides: OverrideEntry[];
  docs: Map<string, ComponentDocInput>;
  docErrors: string[];
  authoredAnomalies: Anomaly[];
  tokenNotes: TokenNotes;
  mode: Mode;
  setMode(m: Mode): void;
  canDark: boolean;
  failures: Record<string, string>;
  reportFailure(id: string, message: string): void;
  Wrapper: ComponentType<{ children: ReactNode }> | null;
}

const Ctx = createContext<LoupeState | null>(null);
export const useLoupe = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error("useLoupe outside LoupeProvider");
  return s;
};

const MODE_KEY = "designloupe:mode";
const readMode = (): Mode => {
  try {
    return localStorage.getItem(MODE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
};
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Match a loupe file's `component` ("src/x.tsx" or "src/x.tsx#Name") to discovered component ids. */
function idsFor(component: string): string[] {
  const [file, exp] = component.split("#");
  return model.components.filter((c) => c.file === file && (!exp || c.exportName === exp || c.name === exp)).map((c) => c.id);
}

type Loaded = Omit<LoupeState, "mode" | "setMode" | "failures" | "reportFailure" | "canDark">;

async function loadAll(): Promise<Loaded> {
  const out: Loaded = {
    model, adapter, theme: null, tokens: null, overrides: [], docs: new Map(), docErrors: [],
    authoredAnomalies: [], tokenNotes: {}, Wrapper: null,
  };
  if (loadTheme) {
    try {
      const t = await loadTheme();
      if (!adapter.isTheme(t)) throw new Error(`The themeEntry export is not a ${adapter.libraryName} theme.`);
      out.theme = t;
      out.tokens = adapter.readTokens(t);
      out.overrides = adapter.readOverrides(t);
    } catch (e) {
      out.themeError = msg(e);
    }
  }
  if (loadWrapper) {
    try {
      out.Wrapper = await loadWrapper();
    } catch (e) {
      out.wrapperError = msg(e);
    }
  }
  const docs = await Promise.allSettled(componentDocs.map((f) => f()));
  docs.forEach((r, i) => {
    if (r.status === "rejected") return out.docErrors.push(`Loupe file #${i + 1}: ${msg(r.reason)}`);
    const d = r.value.default;
    const ids = idsFor(d.component);
    if (!ids.length) out.docErrors.push(`Loupe file for "${d.component}" matches no discovered component.`);
    for (const id of ids) out.docs.set(id, d);
  });
  try {
    out.authoredAnomalies = (await loadAnomalies?.()) ?? [];
  } catch (e) {
    out.docErrors.push(`anomalies file: ${msg(e)}`);
  }
  try {
    out.tokenNotes = (await loadTokenNotes?.()) ?? {};
  } catch (e) {
    out.docErrors.push(`tokens file: ${msg(e)}`);
  }
  return out;
}

export function LoupeProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [mode, setModeState] = useState<Mode>(readMode);
  const [failures, setFailures] = useState<Record<string, string>>({});

  useEffect(() => {
    loadAll().then(setLoaded);
  }, []);

  const canDark = !!loaded?.theme && adapter.hasDarkScheme(loaded.theme);
  const effectiveMode: Mode = canDark ? mode : "light";

  useEffect(() => {
    document.documentElement.dataset.dlMode = effectiveMode;
  }, [effectiveMode]);

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* private mode */
    }
  }, []);

  const reportFailure = useCallback((id: string, message: string) => {
    setFailures((f) => (f[id] === message ? f : { ...f, [id]: message }));
  }, []);

  const value = useMemo<LoupeState | null>(
    () => (loaded ? { ...loaded, mode: effectiveMode, setMode, canDark, failures, reportFailure } : null),
    [loaded, effectiveMode, setMode, canDark, failures, reportFailure],
  );

  if (!value) return <div className="dl-loading">Loading design system…</div>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
```

- [ ] **Step 4: UI primitives**

`packages/viewer/src/ui/CopyChip.tsx`:
```tsx
import { useState } from "react";

export function CopyChip({ text, label }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1200);
    } catch {
      /* clipboard blocked */
    }
  };
  return (
    <button type="button" className="dl-chip" onClick={copy} title="Copy">
      <code>{label ?? text}</code>
      <span aria-hidden className="dl-chip-icon">{done ? "✓" : "⧉"}</span>
    </button>
  );
}
```

`packages/viewer/src/ui/Panel.tsx`:
```tsx
import type { ReactNode } from "react";

export function Panel({ title, count, defaultOpen, children }: { title: string; count?: number; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details className="dl-panel" open={defaultOpen}>
      <summary>
        {title}
        {count !== undefined && <span className="dl-count">{count}</span>}
      </summary>
      <div className="dl-panel-body">{children}</div>
    </details>
  );
}
```

`packages/viewer/src/ui/Badge.tsx`:
```tsx
import type { ReactNode } from "react";

export type Tone = "neutral" | "accent" | "good" | "warn" | "bad";
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`dl-badge dl-badge--${tone}`}>{children}</span>;
}
```

`packages/viewer/src/ui/PageHeader.tsx`:
```tsx
import type { ReactNode } from "react";
import { CopyChip } from "./CopyChip";

export function PageHeader({ title, lede, source }: { title: string; lede?: ReactNode; source?: string }) {
  return (
    <header className="dl-page-header">
      <h1>{title}</h1>
      {lede && <p className="dl-lede">{lede}</p>}
      {source && (
        <p className="dl-source">
          defined in <CopyChip text={source} />
        </p>
      )}
    </header>
  );
}
```

`packages/viewer/src/ui/ErrorCard.tsx`:
```tsx
import { hintFor } from "@designloupe/core";

export function ErrorCard({ title, message, hint }: { title: string; message: string; hint?: string }) {
  const h = hint ?? hintFor(message);
  return (
    <div className="dl-error" role="alert">
      <strong>{title}</strong>
      <pre>{message}</pre>
      {h && <p className="dl-hint">→ {h}</p>}
    </div>
  );
}
```

`packages/viewer/src/ui/Preview.tsx`:
```tsx
import { Component, type ReactNode } from "react";
import { useLoupe } from "../state";
import { ErrorCard } from "./ErrorCard";

class Boundary extends Component<{ onError?: (m: string) => void; children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    this.props.onError?.(error.message);
  }
  render() {
    return this.state.error ? <ErrorCard title="Render failed" message={this.state.error.message} /> : this.props.children;
  }
}

/** A stage that renders target code under the target theme, isolated by an error boundary. */
export function Preview({ id, children, plain }: { id?: string; children: ReactNode; plain?: boolean }) {
  const { adapter, reportFailure } = useLoupe();
  const Frame = adapter.PreviewFrame;
  return (
    <div className="dl-stage">
      <Boundary onError={id ? (m) => reportFailure(id, `render: ${m}`) : undefined}>
        {plain ? children : <Frame>{children}</Frame>}
      </Boundary>
    </div>
  );
}

export { Boundary };
```

- [ ] **Step 5: Shell, sidebar, app and entry**

`packages/viewer/src/shell/Sidebar.tsx`:
```tsx
import { useMemo } from "react";
import { useLoupe } from "../state";
import { href, useRoute } from "../router";
import { groupComponents } from "../groups";

function Item({ to, label, count, disabled, active }: { to: string; label: string; count?: number; disabled?: boolean; active: boolean }) {
  if (disabled) return <li className="dl-nav-item is-disabled" title="Needs a theme">{label}</li>;
  return (
    <li>
      <a className={`dl-nav-item${active ? " is-active" : ""}`} href={to}>
        {label}
        {count !== undefined && <span className="dl-count">{count}</span>}
      </a>
    </li>
  );
}

export function Sidebar() {
  const { model, theme, overrides, docs } = useLoupe();
  const { segments } = useRoute();
  const at = segments.join("/");
  const groups = useMemo(() => groupComponents(model.components, docs), [model.components, docs]);
  const noTheme = !theme;
  const findingsCount = model.findings.length;

  return (
    <nav className="dl-sidebar" aria-label="Design system">
      <div className="dl-brand">
        <span className="dl-brand-mark">◎</span> Design Loupe
        <div className="dl-brand-target">{model.name}</div>
      </div>
      <ul>
        <Item to={href()} label="Overview" active={at === ""} />
      </ul>
      <h2 className="dl-nav-heading">Tokens</h2>
      <ul>
        <Item to={href("tokens", "colour")} label="Colour" active={at === "tokens/colour"} disabled={noTheme} />
        <Item to={href("tokens", "typography")} label="Typography" active={at === "tokens/typography"} disabled={noTheme} />
        <Item to={href("tokens", "layout")} label="Spacing & layout" active={at === "tokens/layout"} disabled={noTheme} />
        <Item to={href("tokens", "elevation")} label="Elevation" active={at === "tokens/elevation"} disabled={noTheme} />
        <Item to={href("tokens", "motion")} label="Motion" active={at === "tokens/motion"} disabled={noTheme} />
        <Item to={href("overrides")} label="Theme overrides" count={overrides.length} active={at === "overrides"} disabled={noTheme} />
      </ul>
      <h2 className="dl-nav-heading">Components</h2>
      <ul>
        {groups.map((g) => (
          <li key={g.key}>
            <a className={`dl-nav-item${segments[0] === "components" && segments[1] === g.key ? " is-active" : ""}`} href={href("components", g.key)}>
              {g.label}
              <span className="dl-count">{g.items.length}</span>
            </a>
            {segments[0] === "components" && segments[1] === g.key && (
              <ul className="dl-nav-children">
                {g.items.map((c) => (
                  <li key={c.id}>
                    <a className={`dl-nav-child${segments[2] === c.name ? " is-active" : ""}`} href={href("components", g.key, c.name)}>{c.name}</a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
        <Item to={href("library")} label={`${model.libraryName} used directly`} count={model.libraryUsage.length} active={at === "library"} />
        <Item to={href("icons")} label="Icons" count={model.icons.length} active={at === "icons"} />
      </ul>
      <h2 className="dl-nav-heading">Health</h2>
      <ul>
        <Item to={href("anomalies")} label="Anomalies" count={findingsCount} active={at === "anomalies"} />
      </ul>
    </nav>
  );
}
```

`packages/viewer/src/shell/Shell.tsx`:
```tsx
import { useState, type FormEvent, type ReactNode } from "react";
import { useLoupe } from "../state";
import { href } from "../router";
import { Sidebar } from "./Sidebar";

export function Shell({ children }: { children: ReactNode }) {
  const { mode, setMode, canDark } = useLoupe();
  const [q, setQ] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (q.trim()) window.location.hash = href("search", q.trim());
  };
  return (
    <div className="dl-app">
      <Sidebar />
      <div className="dl-main">
        <header className="dl-topbar">
          <form onSubmit={submit} role="search">
            <input className="dl-search" placeholder="Search components and tokens" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
          </form>
          <button
            type="button"
            className="dl-toggle"
            onClick={() => setMode(mode === "dark" ? "light" : "dark")}
            disabled={!canDark}
            title={canDark ? "Toggle light/dark" : "The theme has no dark colour scheme"}
            data-testid="mode-toggle"
          >
            {mode === "dark" ? "☾ Dark" : "☀ Light"}
          </button>
        </header>
        <main className="dl-content">{children}</main>
      </div>
    </div>
  );
}
```

`packages/viewer/src/pages/NotFound.tsx`:
```tsx
import { PageHeader } from "../ui/PageHeader";

export function NotFound() {
  return <PageHeader title="Not found" lede="That page doesn't exist. Pick one from the sidebar." />;
}
```

`packages/viewer/src/pages/Overview.tsx`:
```tsx
import { useLoupe } from "../state";
import { href } from "../router";
import { PageHeader } from "../ui/PageHeader";
import { ErrorCard } from "../ui/ErrorCard";

function Tile({ label, value, to, detail }: { label: string; value: number | string; to?: string; detail?: string }) {
  const body = (
    <>
      <div className="dl-tile-value">{value}</div>
      <div className="dl-tile-label">{label}</div>
      {detail && <div className="dl-tile-detail">{detail}</div>}
    </>
  );
  return to ? <a className="dl-tile" href={to}>{body}</a> : <div className="dl-tile">{body}</div>;
}

export function Overview() {
  const { model, overrides, themeError, wrapperError, docErrors, failures, docs } = useLoupe();
  const wraps = model.components.filter((c) => c.source.kind === "wraps").length;
  const rawSites = model.libraryUsage.reduce((n, u) => n + u.sites.length, 0);
  const failureCount = Object.keys(failures).length;
  return (
    <>
      <PageHeader
        title={model.name}
        lede={<>{model.libraryName} {model.libraryVersion ?? "(version unknown)"} · {model.components.length} components discovered · scanned {new Date(model.generatedAt).toLocaleTimeString()}</>}
        source={model.themeEntry ? `${model.themeEntry} → ${model.themeExport}` : undefined}
      />
      <section className="dl-tiles">
        <Tile label="Components" value={model.components.length} to={href("components")} detail={`${wraps} wrap ${model.libraryName} · ${model.components.length - wraps} custom`} />
        <Tile label="Theme overrides" value={overrides.length} to={href("overrides")} />
        <Tile label={`${model.libraryName} used directly`} value={rawSites} to={href("library")} detail={`${model.libraryUsage.length} components`} />
        <Tile label="Icons" value={model.icons.length} to={href("icons")} />
        <Tile label="Static findings" value={model.findings.length} to={href("anomalies")} />
        <Tile label="Loupe docs" value={docs.size} detail="components with hand-written docs" />
      </section>
      <section className="dl-stack">
        {themeError && <ErrorCard title="Theme failed to load: token pages are disabled" message={themeError} />}
        {wrapperError && <ErrorCard title="Wrapper failed to load: previews render without it" message={wrapperError} />}
        {docErrors.map((m) => <ErrorCard key={m} title="Loupe file problem" message={m} />)}
        {model.warnings.map((w) => <ErrorCard key={w} title="Discovery warning" message={w} />)}
        {failureCount > 0 && <ErrorCard title={`${failureCount} component(s) failed in this session`} message={Object.entries(failures).map(([id, m]) => `${id}: ${m}`).join("\n")} />}
      </section>
    </>
  );
}
```

`packages/viewer/src/App.tsx`:
```tsx
import { Component, type ComponentType, type ReactNode } from "react";
import { useLoupe } from "./state";
import { useRoute } from "./router";
import { Shell } from "./shell/Shell";
import { Overview } from "./pages/Overview";
import { NotFound } from "./pages/NotFound";

/** Page registry. Later tasks add entries here. */
export const PAGES: Record<string, ComponentType> = {
  "": Overview,
};

function pageKey(segments: string[]): string {
  if (segments[0] === "tokens") return segments.slice(0, 2).join("/");
  return segments[0] ?? "";
}

/** If the user's wrapper throws, keep the viewer usable without it. */
class WrapperBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function App() {
  const { adapter, theme, mode, Wrapper } = useLoupe();
  const { segments } = useRoute();
  const Page = PAGES[pageKey(segments)] ?? NotFound;
  const shell = (
    <Shell>
      <Page />
    </Shell>
  );
  const wrapped = Wrapper ? <WrapperBoundary fallback={shell}><Wrapper>{shell}</Wrapper></WrapperBoundary> : shell;
  if (!theme) return wrapped;
  const Root = adapter.PreviewRoot;
  return <Root theme={theme} mode={mode}>{wrapped}</Root>;
}
```

`packages/viewer/src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LoupeProvider } from "./state";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LoupeProvider>
      <App />
    </LoupeProvider>
  </StrictMode>,
);
```

- [ ] **Step 6: Chrome stylesheet**

`packages/viewer/src/styles.css`. All chrome styling lives here. It never styles target markup outside `.dl-*` classes.
```css
:root {
  --dl-bg: #f7f7f5; --dl-surface: #ffffff; --dl-sunken: #f0f0ed; --dl-fg: #1c1b19; --dl-muted: #6f6c66;
  --dl-border: #e3e1dc; --dl-accent: #4b5bd6; --dl-accent-soft: #eceefd;
  --dl-good: #1d7a3e; --dl-good-soft: #e5f4ea; --dl-warn: #9a5b00; --dl-warn-soft: #fbf0dc; --dl-bad: #b42318; --dl-bad-soft: #fde8e6;
  --dl-radius: 8px; --dl-font: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --dl-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
html[data-dl-mode="dark"] {
  --dl-bg: #141413; --dl-surface: #1c1c1a; --dl-sunken: #232320; --dl-fg: #ecebe7; --dl-muted: #a19e97;
  --dl-border: #33322e; --dl-accent: #8f9bff; --dl-accent-soft: #262a4a;
  --dl-good: #6fcf8f; --dl-good-soft: #18301f; --dl-warn: #f0b45a; --dl-warn-soft: #3a2a10; --dl-bad: #ff8a7d; --dl-bad-soft: #3d1a17;
}
html, body { margin: 0; background: var(--dl-bg); color: var(--dl-fg); }
.dl-loading { font: 14px var(--dl-font); padding: 2rem; color: var(--dl-muted); }
.dl-app { display: grid; grid-template-columns: 15rem 1fr; height: 100vh; font: 14px/1.5 var(--dl-font); color: var(--dl-fg); background: var(--dl-bg); }
.dl-sidebar { border-right: 1px solid var(--dl-border); overflow-y: auto; padding: 1rem 0.75rem; background: var(--dl-surface); }
.dl-sidebar ul { list-style: none; margin: 0; padding: 0; }
.dl-brand { font-weight: 700; padding: 0 0.5rem 1rem; }
.dl-brand-mark { color: var(--dl-accent); }
.dl-brand-target { font-weight: 400; color: var(--dl-muted); font-size: 12px; }
.dl-nav-heading { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--dl-muted); margin: 1.25rem 0.5rem 0.25rem; }
.dl-nav-item, .dl-nav-child { display: flex; justify-content: space-between; align-items: center; padding: 0.3rem 0.5rem; border-radius: 6px; color: inherit; text-decoration: none; }
.dl-nav-item:hover, .dl-nav-child:hover { background: var(--dl-sunken); }
.dl-nav-item.is-active, .dl-nav-child.is-active { background: var(--dl-accent-soft); color: var(--dl-accent); font-weight: 600; }
.dl-nav-item.is-disabled { color: var(--dl-muted); opacity: 0.6; cursor: not-allowed; }
.dl-nav-children { margin-left: 0.75rem !important; border-left: 1px solid var(--dl-border); padding-left: 0.25rem !important; }
.dl-nav-child { font-size: 13px; }
.dl-count { font-size: 11px; color: var(--dl-muted); background: var(--dl-sunken); border-radius: 999px; padding: 0 0.45rem; margin-left: 0.5rem; }
.dl-main { display: flex; flex-direction: column; min-width: 0; overflow: hidden; }
.dl-topbar { display: flex; gap: 0.75rem; justify-content: space-between; align-items: center; padding: 0.6rem 1.5rem; border-bottom: 1px solid var(--dl-border); background: color-mix(in srgb, var(--dl-bg) 85%, transparent); backdrop-filter: blur(6px); }
.dl-search { width: 22rem; max-width: 50vw; padding: 0.4rem 0.7rem; border: 1px solid var(--dl-border); border-radius: 6px; background: var(--dl-surface); color: inherit; font: inherit; }
.dl-toggle { border: 1px solid var(--dl-border); background: var(--dl-surface); color: inherit; border-radius: 6px; padding: 0.35rem 0.7rem; font: inherit; cursor: pointer; }
.dl-toggle:disabled { opacity: 0.5; cursor: not-allowed; }
.dl-content { overflow-y: auto; padding: 1.5rem 2rem 4rem; }
.dl-content [id] { scroll-margin-top: 1rem; }
.dl-page-header h1 { font-size: 1.6rem; margin: 0 0 0.25rem; }
.dl-lede { color: var(--dl-muted); margin: 0 0 0.5rem; max-width: 60rem; }
.dl-source { color: var(--dl-muted); font-size: 12px; margin: 0 0 1.5rem; }
.dl-section { margin: 2rem 0; }
.dl-section > h2 { font-size: 1.1rem; margin: 0 0 0.75rem; }
.dl-stack { display: grid; gap: 0.75rem; margin: 1rem 0; }
.dl-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr)); gap: 0.75rem; margin: 1rem 0 1.5rem; }
.dl-tile { display: block; padding: 1rem; border: 1px solid var(--dl-border); border-radius: var(--dl-radius); background: var(--dl-surface); color: inherit; text-decoration: none; }
a.dl-tile:hover { border-color: var(--dl-accent); }
.dl-tile-value { font-size: 1.6rem; font-weight: 700; }
.dl-tile-label { font-weight: 600; }
.dl-tile-detail { color: var(--dl-muted); font-size: 12px; }
.dl-card { border: 1px solid var(--dl-border); border-radius: var(--dl-radius); background: var(--dl-surface); padding: 1rem; }
.dl-grid { display: grid; gap: 0.75rem; grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr)); }
.dl-cols { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr)); }
.dl-chip { display: inline-flex; align-items: center; gap: 0.35rem; border: 1px solid var(--dl-border); background: var(--dl-sunken); color: inherit; border-radius: 6px; padding: 0.05rem 0.4rem; font: 12px var(--dl-mono); cursor: pointer; max-width: 100%; }
.dl-chip code { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dl-chip-icon { color: var(--dl-muted); }
.dl-badge { display: inline-block; font-size: 11px; font-weight: 600; border-radius: 999px; padding: 0.05rem 0.55rem; background: var(--dl-sunken); color: var(--dl-muted); }
.dl-badge--accent { background: var(--dl-accent-soft); color: var(--dl-accent); }
.dl-badge--good { background: var(--dl-good-soft); color: var(--dl-good); }
.dl-badge--warn { background: var(--dl-warn-soft); color: var(--dl-warn); }
.dl-badge--bad { background: var(--dl-bad-soft); color: var(--dl-bad); }
.dl-panel { border: 1px solid var(--dl-border); border-radius: var(--dl-radius); background: var(--dl-surface); }
.dl-panel + .dl-panel { margin-top: 0.5rem; }
.dl-panel > summary { cursor: pointer; padding: 0.5rem 0.75rem; font-weight: 600; }
.dl-panel-body { padding: 0 0.75rem 0.75rem; }
.dl-stage { border: 1px dashed var(--dl-border); border-radius: var(--dl-radius); padding: 0.5rem; margin: 0.75rem 0; overflow-x: auto; }
.dl-error { border: 1px solid var(--dl-bad); background: var(--dl-bad-soft); color: var(--dl-fg); border-radius: var(--dl-radius); padding: 0.75rem; }
.dl-error pre { white-space: pre-wrap; font: 12px var(--dl-mono); margin: 0.5rem 0 0; }
.dl-hint { margin: 0.5rem 0 0; color: var(--dl-fg); }
.dl-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.dl-table th, .dl-table td { text-align: left; padding: 0.35rem 0.5rem; border-bottom: 1px solid var(--dl-border); vertical-align: top; }
.dl-table th { color: var(--dl-muted); font-weight: 600; }
.dl-code { font: 12px/1.5 var(--dl-mono); background: var(--dl-sunken); border-radius: 6px; padding: 0.75rem; overflow-x: auto; margin: 0.5rem 0; white-space: pre; }
.dl-muted { color: var(--dl-muted); }
.dl-row { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
```

- [ ] **Step 7: Playwright setup and the first end-to-end test**

Run: `npx playwright install chromium`

`playwright.config.ts`:
```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: { baseURL: "http://localhost:5199", trace: "retain-on-failure" },
  webServer: {
    command: "npm run loupe:fixture -- --port 5199",
    url: "http://localhost:5199",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

`e2e/helpers.ts`:
```ts
import type { Page } from "@playwright/test";

/** Collect page errors and console errors, ignoring the fixture's deliberate failures. */
export function trackErrors(page: Page, allow: RegExp[] = []) {
  const errors: string[] = [];
  const ok = (m: string) => [/Broken on purpose/, /The above error occurred/, /\[vite\]/, ...allow].some((r) => r.test(m));
  page.on("pageerror", (e) => !ok(e.message) && errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !ok(m.text()) && errors.push(m.text()));
  return errors;
}
```

`e2e/viewer.spec.ts`:
```ts
import { test, expect } from "@playwright/test";
import { trackErrors } from "./helpers";

test("overview shows the target, counts and no warnings", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "MUI fixture" })).toBeVisible();
  const tile = (label: string) => page.locator(".dl-tile").filter({ has: page.locator(".dl-tile-label", { hasText: new RegExp(`^${label}$`) }) });
  await expect(tile("Components").locator(".dl-tile-value")).toHaveText("9");
  await expect(tile("Theme overrides").locator(".dl-tile-value")).toHaveText("3");
  await expect(page.getByText("Discovery warning")).toHaveCount(0);
  await expect(page.getByText("Theme failed to load")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("mode toggle switches chrome and target colour scheme", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-dl-mode", "light");
  await page.getByTestId("mode-toggle").click();
  await expect(html).toHaveAttribute("data-dl-mode", "dark");
  await expect(html).toHaveClass(/dark/); // MUI colorSchemeSelector: "class"
});
```

Run: `npx playwright test`
Expected: 2 passed.
- If MUI applies the dark class to a different element, or uses `data-*`, inspect `document.documentElement.outerHTML.slice(0, 300)` and adjust only the second assertion.
- If you see "Invalid hook call" or two React copies, the shared-package resolution isn't working. Check that `resolveId` in Task 8 is reached for `react` imported from `packages/viewer/src`.

- [ ] **Step 8: Typecheck and commit**

Run: `npm run typecheck && npx vitest run`
Expected: clean, all tests pass.

```bash
git add -A
git commit -m "feat(viewer): shell, state, routing, overview page; Playwright e2e"
```

---
### Task 10: Token pages (colour, typography, layout, elevation, motion)

**Files:**
- Create: `packages/viewer/src/pages/{Colour.tsx,Typography.tsx,Layout.tsx,Elevation.tsx,Motion.tsx}`
- Modify: `packages/viewer/src/pages/NotFound.tsx` (add `NoTheme`), `packages/viewer/src/App.tsx` (register pages), `packages/viewer/src/styles.css` (append)
- Test: `e2e/tokens.spec.ts`

**Interfaces:**
- Consumes: `useLoupe()` (`tokens`, `theme`, `adapter`, `tokenNotes`, `mode`, `model`), `Preview`, `CopyChip`, `Panel`, `Badge`, `PageHeader`, `cssColourToHex`, `href` (Task 9), and `contrastRatio` and `flattenOver` (core).
- Produces: route keys `tokens/colour`, `tokens/typography`, `tokens/layout`, `tokens/elevation` and `tokens/motion`, registered in `PAGES`. Anchors: `#<mode>-<group>` on colour cards and `#<variant>` on typography cards, which later tasks link to.

- [ ] **Step 1: Write the failing end-to-end tests**

`e2e/tokens.spec.ts`:
```ts
import { test, expect } from "@playwright/test";
import { trackErrors } from "./helpers";

test("colour page: both schemes, custom palette key, hex values, contrast verdicts", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/#/tokens/colour");
  await expect(page.getByRole("heading", { name: "Light scheme" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dark scheme" })).toBeVisible();
  await expect(page.locator("#light-brand")).toContainText("palette.brand.main");
  await expect(page.locator("#light-primary")).toContainText("#2f6544");
  const warning = page.locator("tr", { hasText: "warning text on main" }).first();
  await expect(warning).toContainText("Fails");
  const primary = page.locator("tr", { hasText: "primary text on main" }).first();
  await expect(primary).toContainText("AA");
  expect(errors).toEqual([]);
});

test("typography page renders each variant with measured metrics", async ({ page }) => {
  await page.goto("/#/tokens/typography");
  const eyebrow = page.locator("#eyebrow");
  await expect(eyebrow).toContainText('<Typography variant="eyebrow">');
  await expect(eyebrow).toContainText("letter-spacing");
  await expect(page.locator("#h1")).toContainText("40px"); // 2.5rem
});

test("layout, elevation and motion pages", async ({ page }) => {
  await page.goto("/#/tokens/layout");
  await expect(page.getByText("theme.spacing(2)")).toBeVisible();
  await expect(page.locator(".dl-spacing-row", { hasText: "theme.spacing(2)" })).toContainText("16px");
  await expect(page.locator(".dl-bp-seg")).toHaveCount(5);
  await expect(page.locator(".dl-bp-seg.is-current")).toHaveCount(1);
  await page.goto("/#/tokens/elevation");
  await expect(page.locator(".dl-shadow-tile")).toHaveCount(25);
  await page.goto("/#/tokens/motion");
  const short = page.locator("tr").filter({ has: page.locator("td", { hasText: /^short$/ }) });
  await expect(short).toContainText("250ms");
});
```

Run: `npx playwright test e2e/tokens.spec.ts`
Expected: FAIL, because the pages render "Not found".

- [ ] **Step 2: NoTheme guard and page registration**

Append to `packages/viewer/src/pages/NotFound.tsx`:
```tsx
export function NoTheme() {
  return <PageHeader title="No theme" lede="Token pages need a theme. Set themeEntry and themeExport in loupe.config.ts, then check the Overview for load errors." />;
}
```

In `packages/viewer/src/App.tsx`, import the five pages and extend `PAGES`:
```tsx
import { Colour } from "./pages/Colour";
import { TypographyPage } from "./pages/Typography";
import { Layout } from "./pages/Layout";
import { Elevation } from "./pages/Elevation";
import { Motion } from "./pages/Motion";

export const PAGES: Record<string, ComponentType> = {
  "": Overview,
  "tokens/colour": Colour,
  "tokens/typography": TypographyPage,
  "tokens/layout": Layout,
  "tokens/elevation": Elevation,
  "tokens/motion": Motion,
};
```

- [ ] **Step 3: Colour page**

`packages/viewer/src/pages/Colour.tsx`:
```tsx
import { contrastRatio, flattenOver, type ColourToken, type ContrastPair } from "@designloupe/core";
import { useLoupe } from "../state";
import { PageHeader } from "../ui/PageHeader";
import { CopyChip } from "../ui/CopyChip";
import { Badge } from "../ui/Badge";
import { cssColourToHex } from "../ui/colour";
import { NoTheme } from "./NotFound";

function Swatch({ token }: { token: ColourToken }) {
  const { tokenNotes } = useLoupe();
  const hex = cssColourToHex(token.value);
  const note = tokenNotes[token.path];
  return (
    <div className="dl-swatch">
      <div className="dl-swatch-colour" style={{ background: token.value }} />
      <div className="dl-swatch-meta">
        <strong>{token.path.split(".").pop()}</strong>
        <CopyChip text={token.path} />
        <span className="dl-muted">{hex || token.value}</span>
        {note && <span className="dl-swatch-note">{note}</span>}
      </div>
    </div>
  );
}

export function verdict(ratio: number) {
  if (Number.isNaN(ratio)) return <Badge>Unknown</Badge>;
  if (ratio >= 7) return <Badge tone="good">AAA</Badge>;
  if (ratio >= 4.5) return <Badge tone="good">AA</Badge>;
  if (ratio >= 3) return <Badge tone="warn">AA large only</Badge>;
  return <Badge tone="bad">Fails</Badge>;
}

export function measurePair(theme: unknown, resolve: (t: unknown, m: ContrastPair["mode"], p: string) => string | undefined, p: ContrastPair) {
  const fg = resolve(theme, p.mode, p.fg) ?? "";
  const bg = resolve(theme, p.mode, p.bg) ?? "";
  const bgHex = cssColourToHex(bg);
  const fgHex = flattenOver(cssColourToHex(fg), bgHex);
  return { fg, bg, ratio: contrastRatio(fgHex, bgHex) };
}

export function Colour() {
  const { tokens, theme, adapter, model } = useLoupe();
  if (!tokens) return <NoTheme />;
  const pairs = adapter.contrastPairs(theme);
  return (
    <>
      <PageHeader title="Colour" lede="Palette roles read live from the theme. Custom palette keys appear automatically." source={model.themeEntry} />
      <div className="dl-cols">
        {tokens.schemes.map((s) => (
          <section key={s.mode} className="dl-stack">
            <h2>{s.mode === "dark" ? "Dark" : "Light"} scheme</h2>
            {s.groups.map((g) => (
              <div className="dl-card" key={g.name} id={`${s.mode}-${g.name}`}>
                <h3 className="dl-card-title">{g.name}</h3>
                <div className="dl-swatches">{g.tokens.map((t) => <Swatch key={t.path} token={t} />)}</div>
              </div>
            ))}
          </section>
        ))}
      </div>
      <section className="dl-section">
        <h2>Contrast</h2>
        <p className="dl-lede">WCAG 2.2 contrast for each role's text on its fill, and body text on backgrounds. Measured from the resolved colours.</p>
        <table className="dl-table">
          <thead><tr><th>Scheme</th><th>Pair</th><th>Sample</th><th>Ratio</th><th>Verdict</th></tr></thead>
          <tbody>
            {pairs.map((p) => {
              const m = measurePair(theme, adapter.resolveColour, p);
              return (
                <tr key={`${p.mode}-${p.label}`}>
                  <td>{p.mode}</td>
                  <td>{p.label}</td>
                  <td><span className="dl-sample" style={{ background: m.bg, color: m.fg }}>Aa</span></td>
                  <td>{Number.isNaN(m.ratio) ? "—" : `${m.ratio.toFixed(2)}:1`}</td>
                  <td>{verdict(m.ratio)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
```

- [ ] **Step 4: Typography page**

`packages/viewer/src/pages/Typography.tsx`:
```tsx
import { useLayoutEffect, useRef, useState } from "react";
import type { TypographyToken } from "@designloupe/core";
import { useLoupe } from "../state";
import { PageHeader } from "../ui/PageHeader";
import { CopyChip } from "../ui/CopyChip";
import { Panel } from "../ui/Panel";
import { Preview } from "../ui/Preview";
import { NoTheme } from "./NotFound";

const SAMPLE = "Sphinx of black quartz, judge my vow";
const METRICS = [["font-family", "fontFamily"], ["font-size", "fontSize"], ["font-weight", "fontWeight"], ["line-height", "lineHeight"], ["letter-spacing", "letterSpacing"]] as const;

function Specimen({ v }: { v: TypographyToken }) {
  const { adapter, mode } = useLoupe();
  const ref = useRef<HTMLDivElement>(null);
  const [m, setM] = useState<Record<string, string>>({});
  useLayoutEffect(() => {
    // .dl-stage > PreviewFrame root > the Typography element
    const el = ref.current?.querySelector(".dl-stage")?.firstElementChild?.firstElementChild;
    if (!el) return;
    const cs = getComputedStyle(el);
    setM(Object.fromEntries(METRICS.map(([label, key]) => [label, cs[key]])));
  }, [mode]);
  const Sample = adapter.TypographySample;
  return (
    <div className="dl-card" id={v.variant}>
      <div className="dl-row">
        <strong>{v.variant}</strong>
        <CopyChip text={`<Typography variant="${v.variant}">`} />
      </div>
      <div ref={ref}>
        <Preview><Sample variant={v.variant}>{SAMPLE}</Sample></Preview>
      </div>
      <dl className="dl-metrics">
        {Object.entries(m).map(([k, val]) => (
          <div key={k}><dt>{k}</dt><dd>{val.replace(/__[A-Za-z0-9_]+/g, "")}</dd></div>
        ))}
      </dl>
      {v.responsive.length > 0 && (
        <Panel title="Responsive sizes" count={v.responsive.length}>
          {v.responsive.map((r) => (
            <div key={r.query} className="dl-row"><code>{r.query}</code><span className="dl-muted">{Object.entries(r.style).map(([k, x]) => `${k}: ${x}`).join("; ")}</span></div>
          ))}
        </Panel>
      )}
    </div>
  );
}

export function TypographyPage() {
  const { tokens, model } = useLoupe();
  if (!tokens) return <NoTheme />;
  return (
    <>
      <PageHeader title="Typography" lede="Every typography variant in the theme, rendered with the target's Typography component. Metrics are measured from the rendered text." source={model.themeEntry} />
      <div className="dl-stack">{tokens.typography.map((v) => <Specimen key={v.variant} v={v} />)}</div>
    </>
  );
}
```

- [ ] **Step 5: Layout, Elevation and Motion pages**

`packages/viewer/src/pages/Layout.tsx`:
```tsx
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLoupe } from "../state";
import { PageHeader } from "../ui/PageHeader";
import { CopyChip } from "../ui/CopyChip";
import { NoTheme } from "./NotFound";

function SpacingRow({ factor, value }: { factor: number; value: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [px, setPx] = useState("");
  useLayoutEffect(() => {
    if (ref.current) setPx(`${Math.round(ref.current.getBoundingClientRect().width * 100) / 100}px`);
  }, [value]);
  return (
    <tr className="dl-spacing-row">
      <td><CopyChip text={`theme.spacing(${factor})`} /></td>
      <td className="dl-muted">{value}</td>
      <td>{px}</td>
      <td><div ref={ref} className="dl-spacing-bar" style={{ width: value }} /></td>
    </tr>
  );
}

function Breakpoints({ bps }: { bps: { name: string; min: number }[] }) {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const max = Math.max(1, ...bps.map((b) => b.min)) * 1.25;
  const current = [...bps].reverse().find((b) => w >= b.min)?.name;
  return (
    <div className="dl-bp" aria-label={`Viewport ${w}px`}>
      {bps.map((b, i) => (
        <div
          key={b.name}
          className={`dl-bp-seg${b.name === current ? " is-current" : ""}`}
          style={{ left: `${(b.min / max) * 100}%`, width: `${(((bps[i + 1]?.min ?? max) - b.min) / max) * 100}%` }}
        >
          <strong>{b.name}</strong> <span className="dl-muted">≥{b.min}px</span>
        </div>
      ))}
      <div className="dl-bp-marker" style={{ left: `${(Math.min(w, max) / max) * 100}%` }} title={`You are here: ${w}px`} />
    </div>
  );
}

export function Layout() {
  const { tokens, model } = useLoupe();
  if (!tokens) return <NoTheme />;
  return (
    <>
      <PageHeader title="Spacing & layout" lede="Spacing scale, shape, breakpoints and z-index. Pixel values are measured live." source={model.themeEntry} />
      <section className="dl-section">
        <h2>Spacing</h2>
        <table className="dl-table"><thead><tr><th>Token</th><th>Value</th><th>Measured</th><th /></tr></thead>
          <tbody>{tokens.spacing.map((s) => <SpacingRow key={s.factor} {...s} />)}</tbody>
        </table>
      </section>
      <section className="dl-section">
        <h2>Shape</h2>
        <div className="dl-row">
          {tokens.shape.map((s) => (
            <div key={s.name} className="dl-shape"><div className="dl-shape-square" style={{ borderRadius: s.value }} /><CopyChip text={`theme.shape.${s.name}`} /><span className="dl-muted">{s.value}</span></div>
          ))}
        </div>
      </section>
      <section className="dl-section">
        <h2>Breakpoints</h2>
        <Breakpoints bps={tokens.breakpoints} />
      </section>
      <section className="dl-section">
        <h2>Z-index</h2>
        <table className="dl-table"><tbody>
          {tokens.zIndex.map((z) => <tr key={z.name}><td><CopyChip text={`theme.zIndex.${z.name}`} /></td><td>{z.value}</td></tr>)}
        </tbody></table>
      </section>
    </>
  );
}
```

`packages/viewer/src/pages/Elevation.tsx`:
```tsx
import { useLoupe } from "../state";
import { PageHeader } from "../ui/PageHeader";
import { CopyChip } from "../ui/CopyChip";
import { NoTheme } from "./NotFound";

export function Elevation() {
  const { tokens, model } = useLoupe();
  if (!tokens) return <NoTheme />;
  return (
    <>
      <PageHeader title="Elevation" lede="The theme's shadow scale. Paper and Card use these via the elevation prop." source={model.themeEntry} />
      <div className="dl-grid">
        {tokens.shadows.map((s, i) => (
          <div key={i} className="dl-shadow-tile" style={{ boxShadow: s }}>
            <strong>{i}</strong>
            <CopyChip text={`theme.shadows[${i}]`} />
          </div>
        ))}
      </div>
    </>
  );
}
```

`packages/viewer/src/pages/Motion.tsx`:
```tsx
import { useState } from "react";
import { useLoupe } from "../state";
import { PageHeader } from "../ui/PageHeader";
import { CopyChip } from "../ui/CopyChip";
import { NoTheme } from "./NotFound";

function Mover({ ms, easing }: { ms: number; easing: string }) {
  const [on, setOn] = useState(false);
  return (
    <button type="button" className="dl-mover" onClick={() => setOn((v) => !v)} aria-label="Play">
      <span className="dl-mover-dot" style={{ transform: `translateX(${on ? "10rem" : "0"})`, transition: `transform ${ms}ms ${easing}` }} />
    </button>
  );
}

export function Motion() {
  const { tokens, model } = useLoupe();
  if (!tokens) return <NoTheme />;
  const { durations, easings } = tokens.transitions;
  const standardEase = easings.find((e) => e.name === "easeInOut")?.value ?? "ease";
  const standardMs = durations.find((d) => d.name === "standard")?.ms ?? 300;
  return (
    <>
      <PageHeader title="Motion" lede="Transition durations and easings from the theme. Click a track to play it." source={model.themeEntry} />
      <section className="dl-section">
        <h2>Durations</h2>
        <table className="dl-table"><tbody>
          {durations.map((d) => (
            <tr key={d.name}><td><CopyChip text={`theme.transitions.duration.${d.name}`} /></td><td>{d.name}</td><td>{d.ms}ms</td><td><Mover ms={d.ms} easing={standardEase} /></td></tr>
          ))}
        </tbody></table>
      </section>
      <section className="dl-section">
        <h2>Easings</h2>
        <table className="dl-table"><tbody>
          {easings.map((e) => (
            <tr key={e.name}><td><CopyChip text={`theme.transitions.easing.${e.name}`} /></td><td><code>{e.value}</code></td><td><Mover ms={standardMs} easing={e.value} /></td></tr>
          ))}
        </tbody></table>
      </section>
    </>
  );
}
```

- [ ] **Step 6: Styles for token pages**

Append to `packages/viewer/src/styles.css`:
```css
.dl-card-title { margin: 0 0 0.5rem; font-size: 0.95rem; text-transform: capitalize; }
.dl-swatches { display: grid; gap: 0.5rem; }
.dl-swatch { display: grid; grid-template-columns: 3rem 1fr; gap: 0.6rem; align-items: center; }
.dl-swatch-colour { width: 3rem; height: 3rem; border-radius: 6px; border: 1px solid var(--dl-border); }
.dl-swatch-meta { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; font-size: 12px; }
.dl-swatch-note { color: var(--dl-fg); font-style: italic; }
.dl-sample { display: inline-block; padding: 0.15rem 0.6rem; border-radius: 4px; font-weight: 600; border: 1px solid var(--dl-border); }
.dl-metrics { display: flex; flex-wrap: wrap; gap: 0.25rem 1.25rem; margin: 0.25rem 0 0.5rem; font-size: 12px; }
.dl-metrics dt { color: var(--dl-muted); display: inline; margin-right: 0.35rem; }
.dl-metrics dd { display: inline; margin: 0; font-family: var(--dl-mono); }
.dl-spacing-bar { height: 0.75rem; background: var(--dl-accent); border-radius: 2px; min-width: 1px; }
.dl-shape { display: flex; flex-direction: column; align-items: flex-start; gap: 0.35rem; }
.dl-shape-square { width: 5rem; height: 5rem; background: var(--dl-accent-soft); border: 2px solid var(--dl-accent); }
.dl-bp { position: relative; height: 3.5rem; border: 1px solid var(--dl-border); border-radius: var(--dl-radius); background: var(--dl-surface); overflow: hidden; }
.dl-bp-seg { position: absolute; top: 0; bottom: 0; padding: 0.4rem; border-right: 1px solid var(--dl-border); font-size: 12px; box-sizing: border-box; }
.dl-bp-seg.is-current { background: var(--dl-accent-soft); }
.dl-bp-marker { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--dl-accent); }
.dl-shadow-tile { display: flex; flex-direction: column; gap: 0.4rem; padding: 1rem; border-radius: var(--dl-radius); background: var(--dl-surface); min-height: 5rem; }
.dl-mover { position: relative; width: 12rem; height: 1.5rem; border: 1px solid var(--dl-border); border-radius: 999px; background: var(--dl-sunken); cursor: pointer; padding: 0 0.25rem; }
.dl-mover-dot { display: block; width: 1rem; height: 1rem; border-radius: 50%; background: var(--dl-accent); }
```

- [ ] **Step 7: Run the end-to-end tests**

Run: `npx playwright test`
Expected: all pass.
- If `#h1` doesn't show `40px`, check that the specimen measures the Typography element and not the frame. The frame's font size is 16px.
- If spacing shows `calc(…)` but no px, the `--mui-spacing` variable isn't on `:root`. Confirm `PreviewRoot` is mounted (`App.tsx` wraps the shell in it).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(viewer): token pages — colour with contrast, typography, layout, elevation, motion"
```

---
### Task 11: Theme overrides page

**Files:**
- Create: `packages/adapter-mui/src/samples.tsx`, `packages/viewer/src/pages/Overrides.tsx`
- Modify: `packages/core/src/adapter.ts` (add `sampleFor`), `packages/adapter-mui/src/browser.tsx`, `packages/viewer/src/App.tsx`, `packages/viewer/src/styles.css`
- Test: `e2e/overrides.spec.ts`

**Interfaces:**
- Consumes: `OverrideEntry[]` from `useLoupe().overrides`, and the raw `theme`.
- Produces:
  - `AdapterBrowser.sampleFor(component: string, props?: Record<string, unknown>): ReactNode | null`. It returns a small representative render of a library component, or null when there is no sample.
  - The route key `overrides`, with anchors `#<key>` (e.g. `#MuiButton`).

- [ ] **Step 1: Write the failing end-to-end test**

`e2e/overrides.spec.ts`:
```ts
import { test, expect } from "@playwright/test";
import { trackErrors } from "./helpers";

test("overrides page lists customised components with code and before/after previews", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/#/overrides");
  const button = page.locator("#MuiButton");
  await expect(button).toContainText("disableElevation: true");
  await expect(button).toContainText('textTransform: "none"');
  await expect(button.getByText("Variant: dashed")).toBeVisible();
  // before/after: default theme keeps uppercase labels, the target theme doesn't
  const before = button.locator(".dl-before button").first();
  const after = button.locator(".dl-after button").first();
  await expect(before).toHaveCSS("text-transform", "uppercase");
  await expect(after).toHaveCSS("text-transform", "none");
  await expect(page.locator("#MuiCard")).toContainText('variant: "outlined"');
  expect(errors).toEqual([]);
});
```

Run: `npx playwright test e2e/overrides.spec.ts`
Expected: FAIL (the page is Not found).

- [ ] **Step 2: Add `sampleFor` to the adapter interface and MUI samples**

In `packages/core/src/adapter.ts`, add this to `AdapterBrowser`:
```ts
  /** A small representative render of a library component (for override before/after), or null. */
  sampleFor(component: string, props?: Record<string, unknown>): ReactNode | null;
```

`packages/adapter-mui/src/samples.tsx`:
```tsx
import type { ReactNode } from "react";
import {
  Alert, Avatar, Badge, Button, Card, CardContent, Checkbox, Chip, LinearProgress, Paper, Slider, Stack,
  Switch, Tab, Tabs, TextField, Typography, IconButton, Link, Divider, Tooltip,
} from "@mui/material";

type P = Record<string, unknown>;
const SAMPLES: Record<string, (p: P) => ReactNode> = {
  Button: (p) => (
    <Stack direction="row" spacing={1}>
      {p.variant ? <Button {...p}>Button</Button> : (<><Button variant="text">Text</Button><Button variant="outlined">Outlined</Button><Button variant="contained">Contained</Button></>)}
    </Stack>
  ),
  TextField: (p) => <TextField label="Label" helperText="Helper text" {...p} />,
  Card: (p) => <Card {...p}><CardContent><Typography variant="h6">Card title</Typography><Typography variant="body2">Card body text.</Typography></CardContent></Card>,
  Paper: (p) => <Paper sx={{ p: 2 }} {...p}>Paper</Paper>,
  Chip: (p) => <Stack direction="row" spacing={1}><Chip label="Chip" {...p} /><Chip label="Outlined" variant="outlined" {...p} /></Stack>,
  Alert: (p) => <Alert severity="info" {...p}>An informational alert.</Alert>,
  Switch: (p) => <Switch defaultChecked {...p} />,
  Checkbox: (p) => <Checkbox defaultChecked {...p} />,
  Tabs: (p) => <Tabs value={0} {...p}><Tab label="One" /><Tab label="Two" /></Tabs>,
  Avatar: (p) => <Avatar {...p}>DL</Avatar>,
  Badge: (p) => <Badge badgeContent={4} color="primary" {...p}><Avatar>DL</Avatar></Badge>,
  LinearProgress: (p) => <LinearProgress variant="determinate" value={60} {...p} />,
  Slider: (p) => <Slider defaultValue={40} sx={{ width: 200 }} {...p} />,
  IconButton: (p) => <IconButton aria-label="sample" {...p}>★</IconButton>,
  Link: (p) => <Link href="#" {...p}>A link</Link>,
  Divider: (p) => <Divider {...p} />,
  Tooltip: (p) => <Tooltip title="Tooltip" open {...p}><span>Hover target</span></Tooltip>,
  Typography: (p) => <Typography {...p}>Typography</Typography>,
};

export function sampleFor(component: string, props: P = {}): ReactNode | null {
  const make = SAMPLES[component];
  return make ? make(props) : null;
}
```
In `packages/adapter-mui/src/browser.tsx`, add `import { sampleFor } from "./samples";` and add `sampleFor,` to the `muiBrowser` object.

- [ ] **Step 3: Overrides page**

`packages/viewer/src/pages/Overrides.tsx`:
```tsx
import { useEffect } from "react";
import type { OverrideEntry } from "@designloupe/core";
import { useLoupe } from "../state";
import { PageHeader } from "../ui/PageHeader";
import { Badge } from "../ui/Badge";
import { Preview } from "../ui/Preview";
import { NoTheme } from "./NotFound";

type RawVariant = { props?: unknown };

function BeforeAfter({ component, props }: { component: string; props?: Record<string, unknown> }) {
  const { adapter } = useLoupe();
  const before = adapter.sampleFor(component, props);
  if (!before) return <p className="dl-muted">No sample for {component}; see the code above.</p>;
  const Default = adapter.DefaultThemeFrame;
  return (
    <div className="dl-before-after">
      <div className="dl-before"><div className="dl-ba-label">{adapter.libraryName} default</div><Preview plain><Default>{adapter.sampleFor(component, props)}</Default></Preview></div>
      <div className="dl-after"><div className="dl-ba-label">Your theme</div><Preview>{adapter.sampleFor(component, props)}</Preview></div>
    </div>
  );
}

function Entry({ o, raw }: { o: OverrideEntry; raw: { variants?: RawVariant[] } | undefined }) {
  return (
    <section className="dl-card dl-section" id={o.key}>
      <div className="dl-row">
        <h2 style={{ margin: 0 }}>{o.component}</h2>
        <code className="dl-muted">{o.key}</code>
        {o.defaultProps && <Badge tone="accent">default props</Badge>}
        {o.styleOverrides && <Badge tone="accent">style overrides</Badge>}
        {o.variants && <Badge tone="accent">{o.variants.length} variant{o.variants.length > 1 ? "s" : ""}</Badge>}
      </div>
      {o.defaultProps && (<><h3>Default props</h3><pre className="dl-code">{o.defaultProps}</pre></>)}
      {o.styleOverrides && (<><h3>Style overrides</h3><pre className="dl-code">{o.styleOverrides}</pre></>)}
      <BeforeAfter component={o.component} />
      {o.variants?.map((v, i) => {
        const props = raw?.variants?.[i]?.props;
        const objProps = props && typeof props === "object" ? (props as Record<string, unknown>) : undefined;
        const label = objProps ? Object.entries(objProps).map(([k, x]) => (k === "variant" ? String(x) : `${k}=${String(x)}`)).join(", ") : `#${i + 1}`;
        return (
          <div key={i} className="dl-variant">
            <h3>Variant: {label}</h3>
            <div className="dl-cols">
              <div><div className="dl-ba-label">matches</div><pre className="dl-code">{v.props}</pre></div>
              <div><div className="dl-ba-label">style</div><pre className="dl-code">{v.style}</pre></div>
            </div>
            {objProps && <Preview><VariantSample component={o.component} props={objProps} /></Preview>}
          </div>
        );
      })}
    </section>
  );
}

function VariantSample({ component, props }: { component: string; props: Record<string, unknown> }) {
  const { adapter } = useLoupe();
  return <>{adapter.sampleFor(component, props) ?? <span className="dl-muted">No sample for {component}.</span>}</>;
}

export function Overrides() {
  const { overrides, theme, model } = useLoupe();
  // Deep links look like #/overrides#MuiButton: hash routing can't scroll on its own.
  useEffect(() => {
    const anchor = window.location.hash.split("#")[2];
    if (anchor) document.getElementById(anchor)?.scrollIntoView();
  }, []);
  if (!theme) return <NoTheme />;
  const raw = ((theme as { components?: Record<string, { variants?: RawVariant[] }> }).components ?? {});
  return (
    <>
      <PageHeader
        title="Theme overrides"
        lede={`Every ${model.libraryName} component the theme customises: default props, style overrides and custom variants, with the library default beside your theme.`}
        source={model.themeEntry}
      />
      {overrides.length === 0 && <p className="dl-muted">The theme doesn't customise any components.</p>}
      {overrides.map((o) => <Entry key={o.key} o={o} raw={raw[o.key]} />)}
    </>
  );
}
```
Also update `pageKey` in `App.tsx` so a route like `#/overrides#MuiButton` still matches the `overrides` page:
```ts
function pageKey(segments: string[]): string {
  const clean = segments.map((s) => s.split("#")[0]!);
  if (clean[0] === "tokens") return clean.slice(0, 2).join("/");
  return clean[0] ?? "";
}
```

Register in `App.tsx`: `import { Overrides } from "./pages/Overrides";` and add `overrides: Overrides,` to `PAGES`.

Append to `styles.css`:
```css
.dl-before-after { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 0.75rem; }
.dl-ba-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--dl-muted); margin-bottom: 0.25rem; }
.dl-variant { border-top: 1px solid var(--dl-border); margin-top: 1rem; padding-top: 0.5rem; }
```

- [ ] **Step 4: Run the tests**

Run: `npx playwright test e2e/overrides.spec.ts && npm run typecheck`
Expected: pass.

If the "before" button isn't uppercase, `DefaultThemeFrame`'s nested ThemeProvider isn't isolating the default theme from the target's CSS-variable theme. Try `createTheme({ cssVariables: false })` for `defaultTheme`. If that still fails, render the default sample in an `<iframe srcDoc>` portal. Record which fix worked in a code comment.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: theme overrides page with library-default vs theme before/after"
```

---

### Task 12: Components pages (sections, demos, props, built-from, usage, a11y)

**Files:**
- Create: `packages/viewer/src/pages/{Components.tsx,ComponentSection.tsx,Demo.tsx,A11yPanel.tsx}`
- Modify: `packages/viewer/src/App.tsx`, `packages/viewer/src/styles.css`
- Test: `e2e/components.spec.ts`

**Interfaces:**
- Consumes:
  - `groupComponents` (Task 9)
  - `planAutoDemo`, `resolveWcag`, `rollupWcag`, `APG` and `hintFor` (core)
  - `virtual:loupe/components` (Task 8)
  - `useLoupe()` fields `docs`, `overrides`, `reportFailure`, `adapter`, `theme` and `mode`
- Produces:
  - Route `components` (index), `components/<groupKey>` (group page), `components/<groupKey>/<Name>` (scrolls to the section)
  - Section anchor ids: `c-<Name>`
  - `componentHref(c: ComponentInfo, groups: ComponentGroup[]): string`, used by Task 13 pages

- [ ] **Step 1: Write the failing end-to-end tests**

`e2e/components.spec.ts`:
```ts
import { test, expect } from "@playwright/test";
import { trackErrors } from "./helpers";

test("components index lists tier groups", async ({ page }) => {
  await page.goto("/#/components");
  await expect(page.locator(".dl-tile", { hasText: "Atoms" })).toContainText("1");
  await expect(page.locator(".dl-tile", { hasText: "Molecules" })).toContainText("1");
  await expect(page.locator(".dl-tile", { hasText: "Unsorted" })).toContainText("7");
});

test("atom page: PrimaryButton with loupe demo, props, usage, overrides link and a11y", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/#/components/atom/PrimaryButton");
  const s = page.locator("#c-PrimaryButton");
  await expect(s).toContainText("wraps MUI Button");
  await expect(s).toContainText("src/components/PrimaryButton.tsx");
  await expect(s).toContainText("Use for the single main action");
  await expect(s.getByRole("button", { name: "Upgrade" })).toBeVisible(); // loupe-file demo
  await s.locator("summary", { hasText: /^Props/ }).click();
  await expect(s).toContainText("tone");
  await expect(s).toContainText("inherited from MUI Button");
  await s.locator("summary", { hasText: "Used in" }).click();
  await expect(s).toContainText("src/features/Settings.tsx");
  await s.locator("summary", { hasText: "Theme overrides that apply" }).click();
  await expect(s.locator("a[href*='overrides']")).toBeVisible();
  await s.locator("summary", { hasText: "Accessibility" }).click();
  await expect(s).toContainText("Keyboard");
  await expect(s).toContainText("brand label on fill");
  expect(errors).toEqual([]);
});

test("unsorted: auto-demos, needs-demo, error isolation, and context-needing components render via wrapper", async ({ page }) => {
  await page.goto("/#/components/unsorted");
  // auto demo grid for StatusPill (enum axis status)
  await expect(page.locator("#c-StatusPill .dl-demo-cell")).toHaveCount(3);
  // TextInput: required label filled automatically
  await expect(page.locator("#c-TextInput").getByLabel("TextInput")).toBeVisible();
  // NavLinkButton needs a router, EmptyState needs i18n: both render because the wrapper provides them
  await expect(page.locator("#c-EmptyState")).toContainText("Nothing here yet");
  await expect(page.locator("#c-NavLinkButton").getByRole("button", { name: "NavLinkButton" })).toBeVisible();
  // DocsLink renders through the next/link shim
  await expect(page.locator("#c-DocsLink a")).toBeVisible();
  // Broken is isolated
  await expect(page.locator("#c-Broken .dl-error")).toContainText("Broken on purpose");
  await expect(page.locator("#c-SparkIcon svg")).toBeVisible();
});
```
Counts: atoms = PrimaryButton (1), molecules = InfoCard (1), and Unsorted = the remaining 7 visible.

Run: `npx playwright test e2e/components.spec.ts`
Expected: FAIL.

- [ ] **Step 2: Demo component**

`packages/viewer/src/pages/Demo.tsx`:
```tsx
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import components from "virtual:loupe/components";
import { planAutoDemo, type ComponentInfo } from "@designloupe/core";
import { useLoupe } from "../state";
import { Preview } from "../ui/Preview";
import { ErrorCard } from "../ui/ErrorCard";
import { CopyChip } from "../ui/CopyChip";

type Loaded = { status: "loading" } | { status: "ok"; Comp: ComponentType<Record<string, unknown>> } | { status: "error"; message: string };

function useComponent(c: ComponentInfo): Loaded {
  const { reportFailure } = useLoupe();
  const [state, setState] = useState<Loaded>({ status: "loading" });
  useEffect(() => {
    let live = true;
    const load = components[c.id];
    if (!load) {
      setState({ status: "error", message: `No module registered for ${c.id}` });
      return;
    }
    load()
      .then((mod) => {
        const Comp = mod[c.exportName] as ComponentType<Record<string, unknown>> | undefined;
        if (!Comp) throw new Error(`Export "${c.exportName}" not found in ${c.file}`);
        if (live) setState({ status: "ok", Comp });
      })
      .catch((e: Error) => {
        reportFailure(c.id, `import: ${e.message}`);
        if (live) setState({ status: "error", message: e.message });
      });
    return () => {
      live = false;
    };
  }, [c.id, c.exportName, c.file, reportFailure]);
  return state;
}

/** Calls a loupe-file demo inside the boundary so a throwing demo is caught. */
function DemoFn({ fn }: { fn: () => ReactNode }) {
  return <>{fn()}</>;
}

function snippet(c: ComponentInfo): string {
  const importPath = `@target/${c.file.replace(/\.(tsx?|jsx?)$/, "")}`;
  const name = c.exportName === "default" ? c.name : c.exportName;
  const imp = c.exportName === "default" ? `import ${name} from "${importPath}";` : `import { ${name} } from "${importPath}";`;
  return `// <loupeDir>/components/${c.name}.loupe.tsx
import { defineComponentDoc } from "@designloupe/core";
${imp}

export default defineComponentDoc({
  component: "${c.file}",
  demo: () => <${name} /* required props here */ />,
});`;
}

export function Demo({ c }: { c: ComponentInfo }) {
  const { docs } = useLoupe();
  const doc = docs.get(c.id);
  const loaded = useComponent(c);

  if (doc?.demo) return <Preview id={c.id}><DemoFn fn={doc.demo} /></Preview>;
  if (loaded.status === "loading") return <div className="dl-stage dl-muted">Loading…</div>;
  if (loaded.status === "error") return <ErrorCard title="Import failed" message={loaded.message} />;

  const plan = planAutoDemo(c);
  if (plan.kind === "needs-demo") {
    return (
      <div className="dl-card dl-needs-demo">
        <strong>Needs a demo.</strong> Loupe can't fill the required prop{plan.missing.length > 1 ? "s" : ""} {plan.missing.map((m) => <code key={m}>{m}</code>)}. Add a loupe file:
        <pre className="dl-code">{snippet(c)}</pre>
        <CopyChip text={snippet(c)} label="Copy snippet" />
      </div>
    );
  }
  const { Comp } = loaded;
  const [a, b] = plan.axes;
  const cell = (props: Record<string, unknown>, label?: string) => (
    <div className="dl-demo-cell" key={label ?? "only"}>
      <Comp {...plan.base} {...props} />
      {label && <div className="dl-demo-label">{label}</div>}
    </div>
  );
  return (
    <Preview id={c.id}>
      {!a && cell({})}
      {a && !b && <div className="dl-demo-row">{a.values.map((v) => cell({ [a.prop]: v }, `${a.prop}="${v}"`))}</div>}
      {a && b && (
        <div className="dl-demo-table">
          {b.values.map((bv) => (
            <div className="dl-demo-row" key={bv}>
              {a.values.map((av) => cell({ [a.prop]: av, [b.prop]: bv }, `${a.prop}="${av}" ${b.prop}="${bv}"`))}
            </div>
          ))}
        </div>
      )}
    </Preview>
  );
}
```

- [ ] **Step 3: A11y panel (ported from trains2somewhere `cards/component-a11y.tsx`, simplified)**

`packages/viewer/src/pages/A11yPanel.tsx`:
```tsx
import { APG, resolveWcag, rollupWcag, flattenOver, type A11yDoc } from "@designloupe/core";
import { useLoupe } from "../state";
import { Panel } from "../ui/Panel";
import { Badge } from "../ui/Badge";
import { cssColourToHex } from "../ui/colour";

const VERDICT = {
  "meets-aa": <Badge tone="good">Meets AA</Badge>,
  "partial-aa": <Badge tone="warn">Partial AA</Badge>,
  "fails-aa": <Badge tone="bad">Fails AA</Badge>,
  unknown: <Badge>Not assessed</Badge>,
} as const;

export function A11yPanel({ a11y }: { a11y: A11yDoc }) {
  const { adapter, theme, mode } = useLoupe();
  const resolve = (path: string) => cssColourToHex(adapter.resolveColour(theme, mode, path) ?? "");
  const rows = resolveWcag(a11y.checks ?? [], resolve).map((r) =>
    r.measured?.fgHex && r.measured.bgHex ? { ...r, measured: { ...r.measured, fgHex: flattenOver(r.measured.fgHex, r.measured.bgHex) } } : r,
  );
  const rollup = rollupWcag(rows);
  const pattern = a11y.pattern ? APG[a11y.pattern] : undefined;
  return (
    <Panel title="Accessibility" count={rows.length}>
      <div className="dl-row">{VERDICT[rollup.verdict]}{pattern && <a href={pattern.href} target="_blank" rel="noreferrer">APG: {pattern.name}</a>}{a11y.role && <span>role <code>{a11y.role}</code></span>}{a11y.name && <span>name: {a11y.name}</span>}</div>
      {a11y.keyboard?.length ? (
        <>
          <h4>Keyboard</h4>
          <table className="dl-table"><tbody>{a11y.keyboard.map((k) => <tr key={k.keys}><td><kbd>{k.keys}</kbd></td><td>{k.does}</td></tr>)}</tbody></table>
        </>
      ) : null}
      {rows.length > 0 && (
        <>
          <h4>WCAG 2.2</h4>
          <table className="dl-table">
            <thead><tr><th>SC</th><th>Criterion</th><th>Level</th><th>Status</th><th>Evidence</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.sc}-${i}`}>
                  <td>{r.href ? <a href={r.href} target="_blank" rel="noreferrer">{r.sc}</a> : r.sc}</td>
                  <td>{r.name}{r.measured?.label && <div className="dl-muted">{r.measured.label}</div>}</td>
                  <td>{r.level}</td>
                  <td>{r.status ? <Badge tone={r.status === "fail" ? "bad" : r.status === "partial" ? "warn" : "good"}>{r.status}</Badge> : <Badge>pending</Badge>}</td>
                  <td>{r.measured?.ratio !== undefined ? `${r.measured.ratio.toFixed(2)}:1 (needs ${r.measured.threshold})` : r.evidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Panel>
  );
}
```

- [ ] **Step 4: Component section and pages**

`packages/viewer/src/pages/ComponentSection.tsx`:
```tsx
import type { ComponentInfo } from "@designloupe/core";
import { useLoupe } from "../state";
import { href } from "../router";
import { Badge } from "../ui/Badge";
import { CopyChip } from "../ui/CopyChip";
import { Panel } from "../ui/Panel";
import { Demo } from "./Demo";
import { A11yPanel } from "./A11yPanel";
import type { ComponentGroup } from "../groups";

export function componentHref(c: ComponentInfo, groups: ComponentGroup[]): string {
  const g = groups.find((x) => x.items.some((i) => i.id === c.id));
  return g ? href("components", g.key, c.name) : href("components");
}

export function ComponentSection({ c, groups }: { c: ComponentInfo; groups: ComponentGroup[] }) {
  const { model, docs, overrides, failures } = useLoupe();
  const doc = docs.get(c.id);
  const byId = new Map(model.components.map((x) => [x.id, x]));
  const own = c.props.filter((p) => !p.inherited);
  const inh = c.props.filter((p) => p.inherited);
  const override = c.source.kind === "wraps" ? overrides.find((o) => o.component === (c.source as { component: string }).component) : undefined;
  return (
    <section className="dl-component dl-card" id={`c-${c.name}`}>
      <header className="dl-row">
        <h2 style={{ margin: 0 }}>{c.name}</h2>
        {c.source.kind === "wraps" ? <Badge tone="accent">wraps {c.source.library} {c.source.component}</Badge> : <Badge>custom</Badge>}
        {doc?.tier && <Badge>{doc.tier}</Badge>}
        {failures[c.id] && <Badge tone="bad">failed</Badge>}
        <CopyChip text={c.file} />
        <span className="dl-muted">{c.usages.length} use{c.usages.length === 1 ? "" : "s"}</span>
      </header>
      {c.description && <p>{c.description}</p>}
      {doc?.notes && <p className="dl-notes">{doc.notes}</p>}
      <Demo c={c} />
      <Panel title="Props" count={own.length}>
        <table className="dl-table">
          <thead><tr><th>Prop</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>
          <tbody>
            {[...own, ...inh].map((p) => (
              <tr key={p.name}>
                <td><code>{p.name}</code>{p.required && <span className="dl-required" title="required">*</span>}{p.inherited && <div className="dl-muted">inherited</div>}</td>
                <td><code>{p.type}</code></td>
                <td>{p.defaultValue !== undefined ? <code>{p.defaultValue}</code> : "—"}</td>
                <td>{p.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {c.inheritedPropCount > 0 && (
          <p className="dl-muted">
            + {c.inheritedPropCount} props inherited{c.source.kind === "wraps" ? ` from ${c.source.library} ${c.source.component}` : ""} (only common ones listed).
          </p>
        )}
      </Panel>
      <Panel title="Built from" count={c.builtFrom.library.length + c.builtFrom.own.length}>
        <div className="dl-row">
          {c.builtFrom.own.map((id) => {
            const o = byId.get(id);
            return o ? <a key={id} className="dl-chip" href={componentHref(o, groups)}>{o.name}</a> : null;
          })}
          {c.builtFrom.library.map((l) => <span key={l} className="dl-chip">{model.libraryName} {l}</span>)}
        </div>
      </Panel>
      <Panel title="Used in" count={c.usages.length}>
        {c.usages.length === 0 ? <p className="dl-muted">Registered but unused.</p> : (
          <ul className="dl-list">{c.usages.map((u, i) => <li key={i}><CopyChip text={`${u.file}:${u.line}`} /></li>)}</ul>
        )}
      </Panel>
      {override && (
        <Panel title="Theme overrides that apply">
          <p>
            The theme customises {model.libraryName} {override.component}:{" "}
            {[override.defaultProps && "default props", override.styleOverrides && "style overrides", override.variants && `${override.variants.length} variant(s)`].filter(Boolean).join(", ")}.{" "}
            <a href={`${href("overrides")}#${override.key}`}>See overrides</a>
          </p>
        </Panel>
      )}
      {doc?.a11y && <A11yPanel a11y={doc.a11y} />}
    </section>
  );
}
```
The overrides deep link `#/overrides#MuiButton` works because Task 11 strips the second `#` in `pageKey` and scrolls to the anchor.

`packages/viewer/src/pages/Components.tsx`:
```tsx
import { useEffect, useMemo } from "react";
import { useLoupe } from "../state";
import { href, useRoute } from "../router";
import { groupComponents } from "../groups";
import { PageHeader } from "../ui/PageHeader";
import { ComponentSection } from "./ComponentSection";
import { NotFound } from "./NotFound";

export function Components() {
  const { model, docs } = useLoupe();
  const { segments } = useRoute();
  const groups = useMemo(() => groupComponents(model.components, docs), [model.components, docs]);
  const [, groupKey, name] = segments;

  useEffect(() => {
    if (name) document.getElementById(`c-${name}`)?.scrollIntoView();
  }, [groupKey, name]);

  if (!groupKey) {
    return (
      <>
        <PageHeader title="Components" lede={`${model.components.length} components discovered. Grouped by tier where loupe files assign one, otherwise by folder.`} />
        <section className="dl-tiles">
          {groups.map((g) => (
            <a key={g.key} className="dl-tile" href={href("components", g.key)}>
              <div className="dl-tile-value">{g.items.length}</div>
              <div className="dl-tile-label">{g.label}</div>
              <div className="dl-tile-detail">{g.items.slice(0, 6).map((c) => c.name).join(", ")}{g.items.length > 6 ? "…" : ""}</div>
            </a>
          ))}
        </section>
      </>
    );
  }
  const group = groups.find((g) => g.key === groupKey);
  if (!group) return <NotFound />;
  return (
    <>
      <PageHeader title={group.label} lede={`${group.items.length} component${group.items.length === 1 ? "" : "s"}`} />
      <div className="dl-stack">{group.items.map((c) => <ComponentSection key={c.id} c={c} groups={groups} />)}</div>
    </>
  );
}
```

Register in `App.tsx`: `import { Components } from "./pages/Components";` and add `components: Components,` to `PAGES`.

Append to `styles.css`:
```css
.dl-component h4 { margin: 0.75rem 0 0.25rem; font-size: 13px; }
.dl-notes { border-left: 3px solid var(--dl-accent); padding-left: 0.75rem; }
.dl-required { color: var(--dl-bad); margin-left: 0.15rem; }
.dl-demo-row { display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end; }
.dl-demo-table { display: grid; gap: 1rem; }
.dl-demo-cell { display: flex; flex-direction: column; gap: 0.35rem; align-items: flex-start; }
.dl-demo-label { font: 11px var(--dl-mono); color: var(--dl-muted); }
.dl-needs-demo code { margin: 0 0.2rem; }
.dl-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.25rem; }
kbd { font: 12px var(--dl-mono); border: 1px solid var(--dl-border); border-bottom-width: 2px; border-radius: 4px; padding: 0 0.3rem; background: var(--dl-sunken); }
```
Note: `.dl-demo-label` sits inside the target's `PreviewFrame`. That's fine, because chrome CSS variables apply everywhere.

- [ ] **Step 5: Run the tests**

Run: `npx playwright test && npm run typecheck && npx vitest run`
Expected: all pass.
- If `#c-TextInput getByLabel("TextInput")` fails, `planAutoDemo` didn't fill `label`. Check the docgen type for `label` is `"string"`.
- If NavLinkButton's button name isn't "NavLinkButton", check that `children` is filled with the component name. It's required and typed `ReactNode`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(viewer): components pages with demos, props, built-from, usage, overrides and a11y panels"
```

---
### Task 13: Raw-library usage, icons, anomalies and search pages

**Files:**
- Create: `packages/core/src/anomalies/auto.ts` (+ export), `packages/core/src/anomalies/auto.test.ts`
- Create: `packages/viewer/src/pages/{LibraryUsage.tsx,Icons.tsx,Anomalies.tsx,Search.tsx}`
- Modify: `packages/viewer/src/App.tsx`, `packages/viewer/src/styles.css`
- Test: `e2e/health.spec.ts`

**Interfaces:**
- Consumes:
  - `StaticFinding`, `mergeAnomalies`, `anomalyCode`, `categoryInfo`, `statusInfo` and `contrastRatio` (core)
  - `measurePair` and `verdict` from `pages/Colour.tsx` (Task 10)
  - `componentHref` (Task 12)
  - `virtual:loupe/icons` and `virtual:loupe/components` (Task 8)
- Produces:
  - `findingsToAnomalies(f: StaticFinding[]): Anomaly[]`, which merges same-code findings into one anomaly with several locations
  - `contrastAnomaly(mode, label, ratio): Anomaly`
  - `buildAnomaly(componentId, message): Anomaly`
  - Routes `library`, `icons`, `anomalies` and `search/<q>`

- [ ] **Step 1: Write the failing unit test**

`packages/core/src/anomalies/auto.test.ts`:
```ts
import { it, expect } from "vitest";
import { findingsToAnomalies, contrastAnomaly, buildAnomaly } from "./auto";
import type { StaticFinding } from "../model";

const f = (o: Partial<StaticFinding>): StaticFinding => ({ code: "ab12", rule: "colour-literal", file: "src/a.tsx", line: 3, snippet: "color: #fff", message: "Hard-coded colour in styles; use a palette token.", ...o });

it("turns static findings into anomalies, merging identical codes", () => {
  const a = findingsToAnomalies([f({}), f({ line: 9 }), f({ code: "cd34", rule: "px-spacing", snippet: "px: 6px", message: "Raw px spacing; use theme.spacing units." })]);
  expect(a).toHaveLength(2);
  expect(a[0]).toMatchObject({ id: "ab12", title: "Hard-coded colour", category: "color", status: "open", flaggedBy: "system", locations: ["src/a.tsx:3", "src/a.tsx:9"] });
  expect(a[0]!.description).toContain("color: #fff");
  expect(a[1]).toMatchObject({ id: "cd34", title: "Raw px spacing", category: "structure" });
});

it("builds contrast and build anomalies with stable codes", () => {
  const c = contrastAnomaly("light", "warning text on main", 1.62);
  expect(c).toMatchObject({ category: "color", status: "open", title: "Low contrast: warning text on main (light)" });
  expect(c.id).toBe(contrastAnomaly("light", "warning text on main", 1.7).id);
  const b = buildAnomaly("src/components/Broken.tsx#Broken", "render: Broken on purpose");
  expect(b).toMatchObject({ category: "build", locations: ["src/components/Broken.tsx"] });
  expect(b.id).toMatch(/^[0-9a-z]{4}$/);
});
```

Run: `npx vitest run packages/core/src/anomalies/auto.test.ts`
Expected: FAIL, because the module was not found.

- [ ] **Step 2: Implement**

`packages/core/src/anomalies/auto.ts`:
```ts
import type { Anomaly } from "../loupe-files";
import type { Mode, StaticFinding } from "../model";
import { anomalyCode } from "./codes";

const TITLES = { "colour-literal": "Hard-coded colour", "px-spacing": "Raw px spacing" } as const;
const CATEGORY = { "colour-literal": "color", "px-spacing": "structure" } as const;

export function findingsToAnomalies(findings: StaticFinding[]): Anomaly[] {
  const byCode = new Map<string, Anomaly>();
  for (const f of findings) {
    const loc = `${f.file}:${f.line}`;
    const existing = byCode.get(f.code);
    if (existing) {
      existing.locations.push(loc);
      continue;
    }
    byCode.set(f.code, {
      id: f.code,
      title: TITLES[f.rule],
      category: CATEGORY[f.rule],
      status: "open",
      flaggedBy: "system",
      description: `${f.message} \`${f.snippet}\``,
      locations: [loc],
    });
  }
  return [...byCode.values()];
}

export function contrastAnomaly(mode: Mode, label: string, ratio: number): Anomaly {
  return {
    id: anomalyCode("contrast", mode, label),
    title: `Low contrast: ${label} (${mode})`,
    category: "color",
    status: "open",
    flaggedBy: "system",
    description: `Measured ${ratio.toFixed(2)}:1; WCAG AA needs 4.5:1 for body text.`,
    locations: ["theme"],
  };
}

export function buildAnomaly(componentId: string, message: string): Anomaly {
  return {
    id: anomalyCode("build", componentId),
    title: `${componentId.split("#")[1] ?? componentId} failed to ${message.startsWith("import") ? "import" : "render"}`,
    category: "build",
    status: "open",
    flaggedBy: "system",
    description: message,
    locations: [componentId.split("#")[0]!],
  };
}
```
Append to `packages/core/src/index.ts`: `export { findingsToAnomalies, contrastAnomaly, buildAnomaly } from "./anomalies/auto";`

Run the unit test. Expected: PASS.

- [ ] **Step 3: Write the failing end-to-end tests**

`e2e/health.spec.ts`:
```ts
import { test, expect } from "@playwright/test";
import { trackErrors } from "./helpers";

test("MUI used directly lists raw usage with sites", async ({ page }) => {
  await page.goto("/#/library");
  for (const name of ["Button", "Chip", "Stack"]) await expect(page.locator("tr", { hasText: name }).first()).toBeVisible();
  await expect(page.locator("tr", { hasText: "Button" }).first()).toContainText("Theme overrides");
});

test("icons page renders library and custom icons", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/#/icons");
  await expect(page.locator(".dl-icon-tile", { hasText: "Delete" }).locator("svg")).toBeVisible();
  await expect(page.locator(".dl-icon-tile", { hasText: "SparkIcon" }).locator("svg")).toBeVisible();
  await expect(page.locator(".dl-icon-tile", { hasText: "Delete" })).toContainText('import DeleteIcon from "@mui/icons-material/Delete"');
  expect(errors).toEqual([]);
});

test("anomalies merge static, contrast, build and authored entries", async ({ page }) => {
  await page.goto("/#/anomalies");
  await expect(page.getByText("Hard-coded colour").first()).toBeVisible();
  await expect(page.getByText("Raw px spacing")).toBeVisible();
  await expect(page.getByText("Low contrast: warning text on main (light)")).toBeVisible();
  await expect(page.getByText("Two near-identical greens")).toBeVisible();
  // render failures appear after the component has been viewed
  await page.goto("/#/components/unsorted");
  await expect(page.locator("#c-Broken .dl-error")).toBeVisible();
  await page.goto("/#/anomalies");
  await expect(page.getByText("Broken failed to render")).toBeVisible();
  // status filter
  await page.getByRole("button", { name: /^Todo/ }).click();
  await expect(page.getByText("Two near-identical greens")).toBeVisible();
  await expect(page.getByText("Raw px spacing")).toHaveCount(0);
});

test("search finds components and tokens", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Search").fill("brand");
  await page.getByLabel("Search").press("Enter");
  await expect(page).toHaveURL(/#\/search\/brand/);
  await expect(page.locator(".dl-search-results")).toContainText("palette.brand.main");
  await page.getByLabel("Search").fill("pill");
  await page.getByLabel("Search").press("Enter");
  await expect(page.locator(".dl-search-results a", { hasText: "StatusPill" })).toBeVisible();
});
```
Note: failures live in React state, so navigating by `page.goto` with only a hash change keeps the session (same document). If Playwright does a full reload, use `page.evaluate(() => (location.hash = "#/anomalies"))` instead of the second and third `goto`.

Run: `npx playwright test e2e/health.spec.ts`
Expected: FAIL.

- [ ] **Step 4: Pages**

`packages/viewer/src/pages/LibraryUsage.tsx`:
```tsx
import { useLoupe } from "../state";
import { href } from "../router";
import { PageHeader } from "../ui/PageHeader";
import { Panel } from "../ui/Panel";
import { CopyChip } from "../ui/CopyChip";

export function LibraryUsage() {
  const { model, overrides } = useLoupe();
  return (
    <>
      <PageHeader
        title={`${model.libraryName} used directly`}
        lede={`${model.libraryName} components imported straight from the library in feature code, outside your component folders. These bypass any house wrappers, but still pick up theme overrides.`}
      />
      {model.libraryUsage.length === 0 ? <p className="dl-muted">None: feature code only uses your own components.</p> : (
        <table className="dl-table">
          <thead><tr><th>Component</th><th>Uses</th><th>Customised by theme</th><th>Call sites</th></tr></thead>
          <tbody>
            {model.libraryUsage.map((u) => {
              const o = overrides.find((x) => x.component === u.component);
              return (
                <tr key={u.component}>
                  <td><strong>{u.component}</strong></td>
                  <td>{u.sites.length}</td>
                  <td>{o ? <a href={`${href("overrides")}#${o.key}`}>Theme overrides</a> : <span className="dl-muted">no</span>}</td>
                  <td><Panel title="Sites" count={u.sites.length}><ul className="dl-list">{u.sites.map((s, i) => <li key={i}><CopyChip text={`${s.file}:${s.line}`} /></li>)}</ul></Panel></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
```

`packages/viewer/src/pages/Icons.tsx`:
```tsx
import { useEffect, useState, type ComponentType } from "react";
import icons from "virtual:loupe/icons";
import components from "virtual:loupe/components";
import type { IconInfo } from "@designloupe/core";
import { useLoupe } from "../state";
import { PageHeader } from "../ui/PageHeader";
import { CopyChip } from "../ui/CopyChip";
import { Preview } from "../ui/Preview";
import { ErrorCard } from "../ui/ErrorCard";

function useIcon(i: IconInfo): ComponentType<Record<string, unknown>> | Error | null {
  const { model } = useLoupe();
  const [C, setC] = useState<ComponentType<Record<string, unknown>> | Error | null>(null);
  useEffect(() => {
    const load =
      i.source === "library"
        ? icons[i.name]?.().then((m) => m.default)
        : components[i.componentId!]?.().then((m) => m[model.components.find((c) => c.id === i.componentId)!.exportName] as ComponentType<Record<string, unknown>>);
    load?.then((c) => setC(() => c)).catch((e: Error) => setC(e));
  }, [i, model.components]);
  return C;
}

function importLine(i: IconInfo) {
  if (i.source === "custom") return `import { ${i.name} } from "${i.importPath.replace(/\.(tsx?|jsx?)$/, "")}";`;
  const path = i.importPath.endsWith(`/${i.name}`) ? i.importPath : `${i.importPath}/${i.name}`;
  return `import ${i.name}Icon from "${path}";`;
}

function IconTile({ i }: { i: IconInfo }) {
  const C = useIcon(i);
  return (
    <div className="dl-icon-tile dl-card">
      <Preview>{C instanceof Error ? null : C ? <C fontSize="large" /> : null}</Preview>
      {C instanceof Error && <ErrorCard title="Icon failed to load" message={C.message} />}
      <strong>{i.name}</strong>
      <span className="dl-muted">{i.source === "library" ? "library" : "custom"} · {i.sites.length} use{i.sites.length === 1 ? "" : "s"}</span>
      <CopyChip text={importLine(i)} />
    </div>
  );
}

export function Icons() {
  const { model } = useLoupe();
  return (
    <>
      <PageHeader title="Icons" lede="Library icons imported anywhere in the app, and custom icon components (names ending in Icon, or built on SvgIcon)." />
      <div className="dl-grid">{model.icons.map((i) => <IconTile key={`${i.source}:${i.name}:${i.importPath}`} i={i} />)}</div>
    </>
  );
}
```

`packages/viewer/src/pages/Anomalies.tsx`:
```tsx
import { useEffect, useMemo, useState } from "react";
import components from "virtual:loupe/components";
import {
  buildAnomaly, categoryInfo, contrastAnomaly, findingsToAnomalies, mergeAnomalies, statusInfo,
  type Anomaly, type AnomalyStatus,
} from "@designloupe/core";
import { useLoupe } from "../state";
import { PageHeader } from "../ui/PageHeader";
import { Badge, type Tone } from "../ui/Badge";
import { CopyChip } from "../ui/CopyChip";
import { measurePair } from "./Colour";

const TONE: Record<string, Tone> = { warn: "warn", info: "accent", good: "good", muted: "neutral" };

export function Anomalies() {
  const { model, adapter, theme, failures, reportFailure, authoredAnomalies } = useLoupe();
  const [filter, setFilter] = useState<AnomalyStatus | "all">("all");

  // Surface import failures without visiting every component page.
  useEffect(() => {
    for (const c of model.components) components[c.id]?.().catch((e: Error) => reportFailure(c.id, `import: ${e.message}`));
  }, [model.components, reportFailure]);

  const all = useMemo(() => {
    const auto: Anomaly[] = [...findingsToAnomalies(model.findings)];
    if (theme) {
      for (const p of adapter.contrastPairs(theme)) {
        const { ratio } = measurePair(theme, adapter.resolveColour, p);
        if (!Number.isNaN(ratio) && ratio < 4.5) auto.push(contrastAnomaly(p.mode, p.label, ratio));
      }
    }
    for (const [id, message] of Object.entries(failures)) auto.push(buildAnomaly(id, message));
    return mergeAnomalies(auto, authoredAnomalies);
  }, [model.findings, theme, adapter, failures, authoredAnomalies]);

  const shown = filter === "all" ? all : all.filter((a) => a.status === filter);
  const categories = [...new Set(shown.map((a) => a.category))];
  const count = (s: AnomalyStatus) => all.filter((a) => a.status === s).length;

  return (
    <>
      <PageHeader
        title="Anomalies"
        lede="Automatic findings (hard-coded values, low contrast, failed components) merged with the ones written in your anomalies file. Set a status in that file, using the same code, to mark one intentional. Render failures appear once a component has been viewed in this session."
      />
      <div className="dl-row dl-filters">
        <button type="button" className={`dl-filter${filter === "all" ? " is-active" : ""}`} onClick={() => setFilter("all")}>All {all.length}</button>
        {(Object.keys(statusInfo) as AnomalyStatus[]).map((s) => (
          <button key={s} type="button" className={`dl-filter${filter === s ? " is-active" : ""}`} onClick={() => setFilter(s)}>
            {statusInfo[s].name} {count(s)}
          </button>
        ))}
      </div>
      {categories.map((cat) => (
        <section key={cat} className="dl-section">
          <h2>{categoryInfo[cat].name}</h2>
          <p className="dl-lede">{categoryInfo[cat].description}</p>
          <div className="dl-stack">
            {shown.filter((a) => a.category === cat).map((a) => (
              <article key={a.id} className="dl-card dl-anomaly">
                <div className="dl-row">
                  <CopyChip text={a.id} />
                  <strong>{a.title}</strong>
                  <Badge tone={TONE[statusInfo[a.status].tone]}>{statusInfo[a.status].name}</Badge>
                  <span className="dl-muted">{a.flaggedBy === "human" ? "flagged by a person" : "found automatically"}</span>
                </div>
                <p>{a.description}</p>
                <div className="dl-row">{a.locations.map((l) => <CopyChip key={l} text={l} />)}</div>
                {a.fix && <p><strong>Fix:</strong> {a.fix}</p>}
                {a.note && <p className="dl-notes">{a.note}</p>}
              </article>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
```

`packages/viewer/src/pages/Search.tsx`:
```tsx
import { useMemo } from "react";
import { useLoupe } from "../state";
import { href, useRoute } from "../router";
import { groupComponents } from "../groups";
import { PageHeader } from "../ui/PageHeader";
import { componentHref } from "./ComponentSection";

export function Search() {
  const { model, docs, tokens, overrides } = useLoupe();
  const { segments } = useRoute();
  const q = (segments[1] ?? "").toLowerCase();
  const groups = useMemo(() => groupComponents(model.components, docs), [model.components, docs]);
  const has = (...xs: (string | undefined)[]) => xs.some((x) => x?.toLowerCase().includes(q));

  const comps = model.components.filter((c) => has(c.name, c.file, c.description, docs.get(c.id)?.notes));
  const colours = (tokens?.schemes ?? []).flatMap((s) => s.groups.flatMap((g) => g.tokens.filter((t) => has(t.path, t.value)).map((t) => ({ ...t, mode: s.mode, group: g.name }))));
  const type = (tokens?.typography ?? []).filter((v) => has(v.variant));
  const ovs = overrides.filter((o) => has(o.key, o.component));

  return (
    <>
      <PageHeader title={`Search: “${segments[1] ?? ""}”`} lede={`${comps.length + colours.length + type.length + ovs.length} results`} />
      <div className="dl-search-results dl-stack">
        {comps.length > 0 && <section><h2>Components</h2><ul className="dl-list">{comps.map((c) => <li key={c.id}><a href={componentHref(c, groups)}>{c.name}</a> <span className="dl-muted">{c.file}</span></li>)}</ul></section>}
        {colours.length > 0 && <section><h2>Colour tokens</h2><ul className="dl-list">{colours.map((t) => <li key={`${t.mode}-${t.path}`}><a href={`${href("tokens", "colour")}`}>{t.path}</a> <span className="dl-muted">{t.mode} · {t.value}</span></li>)}</ul></section>}
        {type.length > 0 && <section><h2>Typography</h2><ul className="dl-list">{type.map((v) => <li key={v.variant}><a href={href("tokens", "typography")}>{v.variant}</a></li>)}</ul></section>}
        {ovs.length > 0 && <section><h2>Theme overrides</h2><ul className="dl-list">{ovs.map((o) => <li key={o.key}><a href={`${href("overrides")}#${o.key}`}>{o.key}</a></li>)}</ul></section>}
      </div>
    </>
  );
}
```

Register in `App.tsx`:
```tsx
import { LibraryUsage } from "./pages/LibraryUsage";
import { Icons } from "./pages/Icons";
import { Anomalies } from "./pages/Anomalies";
import { Search } from "./pages/Search";
// in PAGES:
  library: LibraryUsage,
  icons: Icons,
  anomalies: Anomalies,
  search: Search,
```

Append to `styles.css`:
```css
.dl-icon-tile { display: flex; flex-direction: column; gap: 0.35rem; align-items: flex-start; }
.dl-icon-tile .dl-stage { width: 100%; box-sizing: border-box; }
.dl-filters { margin-bottom: 1rem; }
.dl-filter { border: 1px solid var(--dl-border); background: var(--dl-surface); color: inherit; border-radius: 999px; padding: 0.2rem 0.75rem; font: inherit; cursor: pointer; }
.dl-filter.is-active { background: var(--dl-accent-soft); color: var(--dl-accent); border-color: var(--dl-accent); }
.dl-anomaly p { margin: 0.4rem 0; }
.dl-search-results h2 { font-size: 1rem; }
```

- [ ] **Step 5: Run everything**

Run: `npx vitest run && npx playwright test && npm run typecheck`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(viewer): raw library usage, icons, anomalies and search pages"
```

---

### Task 14: `designloupe doctor`

**Files:**
- Create: `packages/cli/src/doctor.ts`, `packages/cli/test-fixtures/bad-theme.config.ts`
- Test: `packages/cli/src/doctor.test.ts`

**Interfaces:**
- Consumes: `createLoupeServer` (Task 8), `hintFor` (core) and `ResolvedConfig`.
- Produces: `runDoctor(config: ResolvedConfig, log?: (line: string) => void): Promise<number>`. It returns 0 on success, or when only individual components fail, and 1 when the theme fails to load.

- [ ] **Step 1: Write the failing test**

`packages/cli/test-fixtures/bad-theme.config.ts`:
```ts
export default {
  name: "Bad theme",
  root: "../../../examples/mui-fixture",
  themeEntry: "src/theme/index.ts",
  themeExport: "nope",
  componentGlobs: ["src/components/**/*.tsx"],
  presets: ["next"],
};
```

`packages/cli/src/doctor.test.ts`:
```ts
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
```

Run: `npx vitest run packages/cli/src/doctor.test.ts`
Expected: FAIL, because the module was not found.

- [ ] **Step 2: Implement**

`packages/cli/src/doctor.ts`:
```ts
import path from "node:path";
import { hintFor, type AdapterBrowser, type DiscoveryModel, type ResolvedConfig } from "@designloupe/core";
import { createLoupeServer } from "./server";

type Row = { ok: boolean; label: string; message?: string };

export async function runDoctor(config: ResolvedConfig, log: (line: string) => void = console.log): Promise<number> {
  log(`Design Loupe doctor: ${config.name}`);
  log(`  config   ${config.configPath}`);
  log(`  root     ${config.root}`);
  log(`  theme    ${config.themeEntry ?? "(none)"} → ${config.themeExport}`);
  log(`  wrapper  ${config.wrapper ?? "(none)"}`);
  log(`  presets  ${config.presets.join(", ") || "(none)"}`);

  const t0 = Date.now();
  const server = await createLoupeServer(config, { middlewareMode: true });
  const rows: Row[] = [];
  let code = 0;
  const check = async (label: string, fn: () => Promise<void>) => {
    try {
      await fn();
      rows.push({ ok: true, label });
      return true;
    } catch (e) {
      rows.push({ ok: false, label, message: e instanceof Error ? e.message : String(e) });
      return false;
    }
  };

  try {
    const model = (await server.ssrLoadModule("virtual:loupe/model")).default as DiscoveryModel;
    log(`\nDiscovery: ${model.components.length} components, ${model.icons.length} icons, ${model.findings.length} static findings (${Date.now() - t0}ms)`);
    for (const w of model.warnings) log(`  ! ${w}`);

    if (config.themeEntry) {
      const ok = await check("theme", async () => {
        const { loadTheme } = await server.ssrLoadModule("virtual:loupe/theme");
        const theme = await loadTheme();
        const adapter = (await server.ssrLoadModule("virtual:loupe/adapter")).default as AdapterBrowser;
        if (!adapter.isTheme(theme)) throw new Error(`Export "${config.themeExport}" is not a ${adapter.libraryName} theme.`);
      });
      if (!ok) code = 1;
    }
    if (config.wrapper) {
      await check("wrapper", async () => {
        const { loadWrapper } = await server.ssrLoadModule("virtual:loupe/wrapper");
        if (typeof (await loadWrapper()) !== "function") throw new Error("Wrapper's default export is not a component.");
      });
    }
    const files = await server.ssrLoadModule("virtual:loupe/loupe-files");
    for (const [i, load] of (files.componentDocs as (() => Promise<unknown>)[]).entries()) await check(`loupe file #${i + 1}`, async () => void (await load()));
    for (const file of [...new Set(model.components.map((c) => c.file))]) {
      await check(file, async () => void (await server.ssrLoadModule(path.join(config.root, file))));
    }
  } finally {
    await server.close();
  }

  log("");
  for (const r of rows) {
    log(`${r.ok ? "✓" : "✗"} ${r.label}`);
    if (!r.ok) {
      log(`    ${r.message}`);
      const hint = hintFor(r.message ?? "");
      if (hint) log(`    → ${hint}`);
    }
  }
  const failed = rows.filter((r) => !r.ok).length;
  log(`\n${rows.length - failed}/${rows.length} OK${failed ? `, ${failed} failing` : ""}.${code ? " Theme failed: fix it first." : ""}`);
  log("Note: doctor loads modules in Node. Browser-only code may fail here and still work in the viewer.");
  return code;
}
```

- [ ] **Step 3: Run the tests**

Run: `npx vitest run packages/cli/src/doctor.test.ts`
Expected: PASS. Then run `npm run doctor:fixture` by hand. Expected: a readable table with every row ✓ and exit code 0.

If a fixture component fails only because SSR externalises MUI, keep the `ssr.noExternal` fix from Task 8 Step 8.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(cli): designloupe doctor"
```

---
### Task 15: Documentation (README, CLAUDE.md, references, Claude onboarding playbook)

**Files:**
- Create: `README.md`, `CLAUDE.md`, `docs/config.md`, `docs/loupe-files.md`, `docs/adapters.md`, `docs/claude/onboarding-a-target.md`
- Create: `docs/screenshot.png` (captured in Step 3)

**Interfaces:**
- Consumes: the finished behaviour of Tasks 1–14. Every command and field named in the docs must exist; Step 4 verifies this.

- [ ] **Step 1: `README.md`**

```markdown
# Design Loupe

See the design system your React app actually ships: tokens, theme overrides, components, icons and the places it drifts.

Design Loupe is a **local** tool. Point it at a repo on disk and it serves a viewer on `localhost`:

- **Tokens:** palette (light and dark), typography variants with measured metrics, spacing, shape, shadows, z-index, transitions and breakpoints, all read live from your theme.
- **Theme overrides:** every component your theme customises (default props, style overrides, custom variants), with the library default beside yours.
- **Components:** discovered from your folders. Each shows its props, what it wraps, what it's built from, where it's used, and a live demo.
- **Library used directly:** raw library imports in feature code that bypass your wrappers.
- **Icons:** library and custom icons, with usage counts.
- **Anomalies:** hard-coded colours and px values, low-contrast palette pairs and components that fail to render, plus your own notes.

It never writes to your repo. MUI (v7+) is supported today. The core is library-agnostic (see `docs/adapters.md`).

![Design Loupe viewer](docs/screenshot.png)

## Quick start

Requires Node 22+.

```bash
git clone <this repo> designloupe && cd designloupe
npm install
npm run loupe:fixture        # opens the bundled example app at http://localhost:5179
```

## Use it on your app

1. Make sure the target repo has its dependencies installed (`npm install` there). Loupe renders with *its* React and MUI.
2. Create a config folder **outside** the target repo, e.g. `~/loupe/my-app/`, containing a `loupe.config.ts`:

   ```ts
   import { defineConfig } from "@designloupe/core";

   export default defineConfig({
     name: "My app",
     root: "/absolute/path/to/my-app",
     themeEntry: "src/theme/index.ts",
     themeExport: "theme",
     componentGlobs: ["src/components/**/*.tsx"],
     wrapper: "./Wrapper.tsx",          // providers your components need (router, i18n, query client…)
   });
   ```
3. Check it, then run it:

   ```bash
   npm run loupe -- doctor --config ~/loupe/my-app/loupe.config.ts
   npm run loupe -- dev --config ~/loupe/my-app/loupe.config.ts --open
   ```

Next steps:
- `docs/config.md`: every config field.
- `docs/loupe-files.md`: hand-written demos, notes, tiers, accessibility checks, anomalies and token notes.
- `docs/claude/onboarding-a-target.md`: a step-by-step playbook. If you use Claude Code, ask it to follow this file.

## Development

```bash
npm test            # unit + integration (Vitest)
npm run test:e2e    # viewer end-to-end against the fixture (Playwright)
npm run typecheck
```

MIT licence.
```

- [ ] **Step 2: `CLAUDE.md`, the reference docs and the onboarding playbook**

`CLAUDE.md`:
```markdown
# Design Loupe — working notes for Claude

Design Loupe is a local CLI and browser viewer that visualises a React app's design system. It's generalised from the `/design-system` viewer in trains2somewhere. See `docs/superpowers/specs/2026-10-02-design-loupe-design.md`, including its "Plan-time amendments".

## If you've been asked to set Loupe up for an app

Follow `docs/claude/onboarding-a-target.md` step by step. Don't improvise the order.

## Layout

| Package | Role | May import |
|---|---|---|
| `packages/core` | Types, config, discovery (Node: `@designloupe/core/node`), a11y maths, demo planning, anomaly rules | `typescript` (Node side only), zod, fast-glob, docgen |
| `packages/adapter-mui` | Everything MUI-specific: `node.ts` (import classification) and `browser.tsx` (tokens, overrides, preview components, samples) | core, `@mui/*` |
| `packages/viewer` | The React UI. Plain-CSS chrome (`dl-*` classes, `--dl-*` vars). Next.js shims in `src/shims/next` | core, `virtual:loupe/*` **only**; never `@mui/*` |
| `packages/cli` | `designloupe dev` and `doctor`. Vite server and the plugin that serves `virtual:loupe/*` | everything |
| `examples/mui-fixture` | The test target. Deliberately awkward. **Don't "fix" its planted problems.** | |
| `examples/fixture-loupe` | The fixture's Loupe config, wrapper and loupe files | |

## Rules

1. **Never write into a target repo.** Config, wrapper, shims and loupe files live outside it.
2. **Live values.** Tokens are read from the theme object and measured in the DOM, never copied into registries.
3. **Adapter isolation.** Library-specific code goes in an adapter. If you're about to import `@mui/*` in core or the viewer, stop and add an adapter method.
4. **The chrome never uses the target's styling system.** Previews go through `<Preview>` (the adapter's `PreviewFrame` plus an error boundary).
5. **One failure never takes down a page.** Import failures go to `ErrorCard` and `reportFailure`; render failures go to the boundary.
6. **TypeScript is 6.0.3 repo-wide.** TS 7 has no JS compiler API, and docgen needs it.
7. **UI copy:** plain, specific, British spelling, no marketing voice.

## Commands

- `npm test`: Vitest (unit, discovery integration, server, doctor)
- `npm run test:e2e`: Playwright against the fixture on port 5199
- `npm run typecheck`
- `npm run loupe:fixture` / `npm run doctor:fixture`
```

`docs/config.md`. Write a table with one row per field of `ConfigSchema` (Task 1): `name`, `root`, `adapter`, `themeEntry`, `themeExport`, `componentGlobs`, `ignoreGlobs`, `usageGlobs`, `tsconfig`, `wrapper`, `shims`, `presets`, `loupeDir`, `define` and `vite`. Columns: field, type, default, relative to (config dir or root), purpose. Then add these sections:
- **Path resolution:** `root`, `wrapper`, `loupeDir` and shim file paths are relative to the config file. `themeEntry`, the globs and `tsconfig` are relative to `root`.
- **Theme export:** a theme object, or a zero-argument function that returns one.
- **Shared packages:** react, react-dom, `@mui/*` and `@emotion/*` resolve from the target, so the target needs `node_modules` installed.
- **Aliases available in loupe files and the wrapper:** `@target/*` (the target root), plus the target tsconfig's `paths`. Note that `paths` only apply to files the tsconfig includes, so loupe files should use `@target/…`.
- **The `next` preset:** list the shimmed modules from Task 8.
- **`vite` escape hatch:** examples for SVGR (`vite-plugin-svgr`, installed in this repo) and for a sass `additionalData`.

`docs/loupe-files.md`. Document `defineComponentDoc` (every field of `ComponentDocInput`), with:
- the PrimaryButton example from `examples/fixture-loupe/components/PrimaryButton.loupe.tsx`;
- `component` matching rules (`"src/x.tsx"` or `"src/x.tsx#Name"`);
- tiers, and how setting any tier switches grouping to tiers;
- `hidden`;
- `a11y`: APG patterns (list the `APG` keys), WCAG checks, and the `measure` form with token paths;
- `defineAnomalies`, with the status meanings `open|todo|intentional|fixed`. Marking an automatic finding intentional means reusing its 4-character code.
- `defineTokenNotes` with token paths;
- a `tsconfig.json` for the config folder, for editor support. Copy `examples/fixture-loupe/tsconfig.json` and point the `paths` at the real target.

`docs/adapters.md`. Explain the `AdapterNode` / `AdapterBrowser` split with both interfaces copied from `packages/core/src/adapter.ts`. Then list the steps to add an adapter, using a Tailwind/CSS-variables adapter as the worked outline:
1. Create `packages/adapter-<id>` with `node.ts` and `browser.tsx`.
2. Extend `adapter: z.literal("mui")` in the config schema to a union.
3. Select the node adapter in `server.ts` by `config.adapter`.
4. Add the adapter's shared packages to `SHARED` in `vite-plugin.ts` if it needs a single copy.

`docs/claude/onboarding-a-target.md`:
```markdown
# Onboarding a target app (playbook for Claude Code)

Goal: get Design Loupe running against an app the user has on this machine, **without modifying that app's repo**. Work through the steps in order. After each step, tell the user what you found in a sentence or two.

## 0. Prerequisites
- In this repo: `npm install`, then `npm test`. All tests should pass. If they don't, stop and report.
- Ask the user for the target repo's absolute path, and where they'd like the Loupe config folder to live. Default: `~/loupe/<app-name>/`, outside both repos.
- In the target repo, check `node_modules` exists. If not, ask the user before running its install command, since installs can run scripts.

## 1. Inspect the target (read-only)
Find and note:
1. **Framework/bundler:** look for `next.config.*`, `vite.config.*`, `craco.config.*` or `webpack.config.*`, and `package.json` scripts.
2. **UI library and version:** check `package.json` for `@mui/material`. Loupe supports MUI v7+. Note any `@mui/lab` and `@mui/x-*` packages.
3. **Theme:** grep for `createTheme(`. Find the module and export name that hold the final theme. If the theme is built at runtime (e.g. per tenant, or from an API), find the function that builds it: `themeExport` may name a zero-argument function. If it needs arguments, write a small `theme.ts` in the config folder that imports the builder and calls it with representative values, and point `themeEntry` at it with a relative path such as `../../loupe/my-app/theme.ts`. (`themeEntry` resolves from `root`, but absolute paths also work.)
4. **Component folders:** usually `src/components/**`, a `ui/` folder, or a `packages/ui` workspace. Ask the user which folders count as "the design system" if it isn't obvious.
5. **Providers:** read the app's root (`main.tsx`, `_app.tsx`, `app/layout.tsx` or `providers.tsx`) and list every provider other than ThemeProvider and CssBaseline: router, i18n, react-query, redux, auth, feature flags, custom contexts.
6. **Path aliases:** read `tsconfig.json` `compilerOptions.paths`, and any bundler aliases that aren't in tsconfig (those need `vite.resolve.alias`).
7. **Environment reads:** grep for `process.env.` and `import.meta.env.` in component folders.
8. **Non-standard imports:** grep component folders for `.svg`, `.scss`, `.module.css` and `?url`/`?raw` imports.

## 2. Write the config folder
Create:
- `loupe.config.ts`: start from the template in `README.md`. Set `presets: ["next"]` for Next.js apps. Add `define` entries for env vars found in step 1.7, with harmless values.
- `Wrapper.tsx`: a default-exported component that renders the providers from step 1.5 around `children`. Use test-friendly versions: `MemoryRouter` instead of `BrowserRouter`, a fresh `QueryClient` with `retry: false`, and a store created with the app's own `makeStore()` if one exists. **Never include a ThemeProvider or CssBaseline**, because Loupe supplies the theme. Import app modules via `@target/...`.
- `tsconfig.json`: copy `examples/fixture-loupe/tsconfig.json` and point its `paths` at the target.

## 3. Run doctor
`npm run loupe -- doctor --config <config folder>/loupe.config.ts`
- **Exit 2:** a config error. The message names the field.
- **Exit 1:** the theme failed. Fix `themeEntry`/`themeExport` first.
- **✗ rows:** see the troubleshooting table below. Re-run until the remaining ✗ rows are explained.

## 4. Run the viewer and look at every page
`npm run loupe -- dev --config <…>/loupe.config.ts --open`, then visit Overview, each token page, Theme overrides, each component group, Icons and Anomalies. Overview lists load errors. Component cards show import and render errors with a suggested fix. Use the Chrome browser tools if they're available; otherwise ask the user to describe what they see.

## 5. Fix failures (troubleshooting)
| Symptom | Fix |
|---|---|
| `Failed to resolve import "@/…"` | The alias isn't in the target tsconfig `paths`. Add `vite: { resolve: { alias: { "@": "<root>/src" } } }`. |
| `Failed to resolve import "next/…"` | Add `presets: ["next"]`. For modules the preset doesn't cover (e.g. `next/headers`), add a shim file in the config folder and map it in `shims`. |
| `process is not defined` / undefined env | Add `define: { "process.env.X": JSON.stringify("…") }`. |
| `.svg` imports as components | Install `vite-plugin-svgr` **in this repo** and add `vite: { plugins: [svgr()] }`. |
| `.scss` | `sass` must be resolvable. Install it in this repo as a devDependency. |
| "Invalid hook call" / two Reacts | The target's React wasn't used. Check that the target has `node_modules`. If the target is a monorepo, set `root` to the package that owns `react`. |
| "useX must be used within XProvider" | Add that provider to `Wrapper.tsx`. |
| A component renders blank | It probably needs data. Write a loupe file with a demo that passes realistic props. |
| A component is missing from the list | docgen didn't recognise it. Check it's exported from a file matched by `componentGlobs`, and that it returns JSX. |
| The page is slow on first load | Vite is pre-bundling the target's dependencies. Wait for it, or add heavy dependencies to `vite.optimizeDeps.include`. |

## 6. Enrich (optional; ask the user first)
- For components showing "Needs a demo", create `components/<Name>.loupe.tsx` using the snippet the card offers.
- Ask the user whether they want tiers (atoms → organelles). If so, add `tier` to each loupe file.
- Review Anomalies with the user. Record decisions in `anomalies.ts`, reusing the codes shown.

## Don'ts
- Don't edit, format or install anything in the target repo without explicit permission.
- Don't commit the config folder into the target repo.
- Don't copy token values into loupe files. Loupe reads them live.
```

- [ ] **Step 3: Capture the README screenshot**

Start `npm run loupe:fixture -- --port 5182` in the background. Then:
```bash
npx playwright screenshot --viewport-size=1440,900 "http://localhost:5182/#/components/atom/PrimaryButton" docs/screenshot.png
```
Stop the server. Expected: `docs/screenshot.png` exists and shows the sidebar plus the PrimaryButton section.

- [ ] **Step 4: Verify the docs against the code**

Run:
```bash
for f in name root adapter themeEntry themeExport componentGlobs ignoreGlobs usageGlobs tsconfig wrapper shims presets loupeDir define vite; do grep -q "\`$f\`" docs/config.md || echo "missing $f"; done
grep -o 'npm run [a-z:]*' README.md CLAUDE.md docs/claude/onboarding-a-target.md | sort -u
```
Expected: no "missing" lines. Every `npm run` script listed exists in the root `package.json`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: README, CLAUDE.md, config/loupe-files/adapter references, Claude onboarding playbook"
```

---

### Task 16: Final verification and GitHub handoff

**Files:** none new (fixes only, if verification finds problems).

- [ ] **Step 1: Run the full suite from a clean install**

```bash
rm -rf node_modules package-lock.json && npm install
npm run typecheck && npm test && npm run test:e2e && npm run doctor:fixture
```
Expected: everything passes and doctor exits 0. If anything fails, use superpowers:systematic-debugging. Don't weaken the assertions.

- [ ] **Step 2: Manual look**

Run `npm run loupe:fixture -- --open`. Click through every sidebar entry in light and dark modes. Confirm:
- no page renders unstyled chrome;
- dark mode changes both the chrome and the previews;
- the Broken component shows an error card and nothing else breaks.

- [ ] **Step 3: Licence and hygiene check**

Run: `git ls-files | grep -iE "trains|t2g|\.env" || echo clean`
Expected: `clean`. No trains2somewhere-specific files or env files are tracked.

Run: `grep -rniE "trains2green|trains2home|t2g" packages docs/config.md docs/loupe-files.md docs/adapters.md docs/claude README.md || echo clean`
Expected: `clean`. Mentions in `CLAUDE.md` and the spec/plan, which name the origin, are fine.

- [ ] **Step 4: Commit any fixes, then stop and ask the user about GitHub**

```bash
git status --short   # expect empty after committing fixes
```
**Don't create a GitHub repo or push without the user's explicit go-ahead.** Ask:
- the repo name (suggest `designloupe`);
- public or private;
- whether to use `gh repo create <name> --public --source . --push`.
