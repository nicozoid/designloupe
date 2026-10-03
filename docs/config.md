# `loupe.config.ts` reference

`defineConfig` (from `@designloupe/core`) takes an object validated against `ConfigSchema`
(`packages/core/src/config/schema.ts`). One row per field:

| Field | Type | Default | Relative to | Purpose |
|---|---|---|---|---|
| `name` | `string` | `"Design system"` | — | Label shown in the viewer header and `doctor` output. |
| `root` | `string` | *(required)* | config dir | Absolute or relative path to the target repo (or the workspace package that owns `react`, in a monorepo). |
| `adapter` | `"mui"` | `"mui"` | — | Which library adapter to use. Only `"mui"` exists today (see `docs/adapters.md`). |
| `themeEntry` | `string` (optional) | *(none)* | root | Module that exports the theme. Without it, token and override pages are disabled. |
| `themeExport` | `string` | `"theme"` | — | Export name inside `themeEntry`. |
| `componentGlobs` | `string[]` | *(required, ≥1)* | root | Glob(s) selecting component files for discovery. |
| `ignoreGlobs` | `string[]` | `["**/*.test.*", "**/*.spec.*", "**/*.stories.*", "**/__tests__/**", "**/*.d.ts"]` | root | Globs excluded from `componentGlobs`/`usageGlobs` matches. |
| `usageGlobs` | `string[]` | `["src/**/*.{ts,tsx,js,jsx}"]` | root | Files scanned for "library used directly" and anomaly findings. |
| `tsconfig` | `string` | `"tsconfig.json"` | root | The target's own tsconfig, used for prop-type analysis (docgen) and path aliases. May not exist; analysis then falls back to default compiler options. |
| `wrapper` | `string` (optional) | *(none)* | config dir | Default-exported component that wraps every preview (router, i18n, query client, etc.). Never add a theme provider here — Loupe supplies the theme. |
| `shims` | `Record<string, string>` | `{}` | config dir (relative/absolute targets) | Module id → replacement. The replacement is a relative/absolute file path (resolved from the config dir) or a bare module id to redirect to. |
| `presets` | `("next")[]` | `[]` | — | Named bundles of shims/behaviour. Only `"next"` exists today. |
| `loupeDir` | `string` (optional) | *(none)* | config dir | Folder scanned for `*.loupe.{ts,tsx}`, `anomalies.{ts,tsx}` and `tokens.{ts,tsx}`. Often the config dir itself (`"."`). |
| `define` | `Record<string, string>` | `{}` | — | Extra `vite` `define` entries (merged after Loupe's own `process.env.NODE_ENV`, etc.), e.g. `{ "process.env.API_URL": '"https://example.test"' }`. |
| `watch` | `boolean` | `true` | — | Re-run discovery when source files in the target (or the folders `componentGlobs` reach) or `loupeDir` change, and reload the browser if the model changed. A save only rescans changed files and only re-runs prop extraction when a file it read last time changed: a component file, or any file in the target it reaches through imports (type-only imports and deeper hops included). Set `false` on a very large repo if saves feel slow; restart the dev server to pick up new components. |
| `vite` | `object` (optional) | *(none)* | — | Raw Vite config, merged onto Loupe's own with `mergeConfig` (your plugins/resolve/etc. are added, not replaced). |

## Path resolution

`root`, `wrapper`, `loupeDir` and shim file paths (when the shim target is relative or absolute) are
resolved relative to the **config file's directory**. `themeEntry`, `componentGlobs`/`ignoreGlobs`/`usageGlobs`
and `tsconfig` are resolved relative to `root`. This lets the config folder and the target repo move
independently of each other.

## Monorepos: a design system in a workspace package

Set `root` to the app package (the one that owns `react`) and reach the workspace package with `..` in
`componentGlobs`, which resolve from `root`:

```ts
export default defineConfig({
  root: "../../my-monorepo/apps/web",
  componentGlobs: ["src/components/**/*.tsx", "../../packages/ui/src/**/*.tsx"],
});
```

Imports through the package name (`import { Button } from "@acme/ui"`, a symlink in `node_modules`) count
as usages of those components, provided the package's `types`/`main`/`exports` lead TypeScript to its
**source** (`src/index.ts`) rather than built `dist/*.d.ts` files. The dev server watches the folders these
globs reach, and adds them to Vite's `fs.allow`.

## Barrels (`index.ts` re-exports)

A barrel such as `Button/index.ts` containing `export { Button } from "./Button"` is fine inside
`componentGlobs`: re-exports are not counted as components, and imports through the barrel
(`import { Button } from "@/components/Button"`) are followed back to the file that defines the component,
so its usages land on that component. The globs must still match the defining files themselves
(`Button/Button.tsx`), not only the barrels.

## Theme export

`themeExport` must name either a theme object, or a zero-argument function that returns one (checked by
calling it when it's a function without a `.palette`). If the real theme builder takes arguments (per-tenant
theming, data from an API, etc.), write a small `theme.ts` in the config folder that imports the builder and
calls it with representative values, then point `themeEntry` at that file.

## Shared packages

`react`, `react-dom`, `@mui/material`, `@mui/system`, `@mui/styled-engine`, `@mui/lab`, `@mui/icons-material`,
`@emotion/react`, `@emotion/styled` and `@emotion/cache` all resolve from the **target**, not from this repo,
so the viewer and the target's own components share a single copy of React and MUI. This means the target
needs its `node_modules` installed. Files inside the config folder or `loupeDir` (which usually live outside
the target, with no `node_modules` of their own) resolve every other bare import — `react-i18next`,
`@tanstack/react-query`, and so on — from the target too.

Vite's dependency pre-bundle for these shared packages is cached per target, at
`node_modules/.vite/loupe-<hash>` in **this** repo, where `<hash>` is derived from the target's real path
plus its lockfile contents. If a target's dependencies change in a way that confuses the pre-bundle (stale
chunks, a version mismatch), delete that `loupe-<hash>` folder under `node_modules/.vite` to force a fresh
pre-bundle.

## Aliases available in loupe files and the wrapper

- `@target/*` — the target root. Always available, regardless of the target's own aliases.
- `@designloupe/*` — this repo's packages (useful mainly for `defineComponentDoc`/`defineAnomalies`/`defineTokenNotes`).
- The target tsconfig's own `compilerOptions.paths` (e.g. `@/*`), via `vite-tsconfig-paths`.

The target's own `paths` only apply to files the tsconfig's `include` covers — your config folder and
`loupeDir` usually aren't included in the target's tsconfig, so **loupe files should import via `@target/…`**
rather than the target's own aliases, to avoid relying on `include` reaching outside the target.

## The `next` preset

Setting `presets: ["next"]` maps these modules to shims under `packages/viewer/src/shims/next`, so component
code that imports them doesn't fail to resolve:

- `next/link`
- `next/image`
- `next/navigation`
- `next/router`
- `next/dynamic`
- `next/head`

`next/font/google` and `next/font/local` imports are rewritten automatically (not via the shim map): named
and default font-loader imports become references to a harmless placeholder (`virtual:loupe/next-font`), so
`const { className } = Inter({...})`-style code keeps working without needing real font files.

Modules the preset doesn't cover (e.g. `next/headers`) need a shim file of your own in the config folder,
mapped via `shims`.

## `vite` escape hatch

`vite` is merged onto Loupe's own Vite config with `mergeConfig`, so you add plugins/resolve entries rather
than replacing anything.

SVGR (importing `.svg` files as React components) — install `vite-plugin-svgr` **in this repo** first
(`npm i -D vite-plugin-svgr` at the Design Loupe root). A config folder outside this repo can still import
it: packages a config imports that aren't installed next to it are loaded from this repo. Plain `svgr()` only
handles `*.svg?react` imports, so match the target's import style:

```ts
import svgr from "vite-plugin-svgr";

export default defineConfig({
  // ...
  // Next.js / @svgr/webpack style: `import Logo from "./logo.svg"` is the component.
  vite: { plugins: [svgr({ include: "**/*.svg", svgrOptions: { exportType: "default" } })] },
  // Create React App style: `import { ReactComponent as Logo } from "./logo.svg"`.
  // vite: { plugins: [svgr({ include: "**/*.svg", svgrOptions: { exportType: "named", namedExport: "ReactComponent" } })] },
});
```

JSX in `.js` files (Create React App allows it; Vite doesn't). Vite 8 compiles with Oxc, whose `lang` option
applies to every file it includes, so setting `vite: { oxc: { lang: "jsx" } }` breaks `.ts`/`.tsx` files. Add a
small plugin that compiles only `.js` files as JSX instead:

```ts
import { transformWithOxc, type Plugin } from "vite";

const jsxInJs: Plugin = {
  name: "jsx-in-js",
  enforce: "pre",
  transform(code, id) {
    if (!/\.js$/.test(id) || id.includes("/node_modules/")) return null;
    return transformWithOxc(code, id, { lang: "jsx", jsx: { runtime: "automatic" } });
  },
};

export default defineConfig({
  // ...
  vite: { plugins: [jsxInJs] },
});
```

Sass `additionalData` (e.g. injecting shared variables into every `.scss` file):

```ts
export default defineConfig({
  // ...
  vite: {
    css: {
      preprocessorOptions: {
        scss: { additionalData: `@import "@target/src/styles/_variables.scss";` },
      },
    },
  },
});
```

`sass` itself must be resolvable — install it as a devDependency in this repo if the target relies on it.
