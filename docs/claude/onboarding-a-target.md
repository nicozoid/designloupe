# Onboarding a target app (playbook for Claude Code)

Goal: get Design Loupe running against an app the user has on this machine, **without modifying that app's
repo**. Work through the steps in order. After each step, tell the user what you found in a sentence or two.

## 0. Prerequisites
- In this repo: `npm ci` (installs exactly what `package-lock.json` pins), then `npm test`. All tests should pass. If they don't, stop and report.
- Ask the user for the target repo's absolute path, and where they'd like the Loupe config folder to live. Default: `~/loupe/<app-name>/`, outside both repos.
- In the target repo, check `node_modules` exists. If not, ask the user before running its install command, since installs can run scripts.

## 1. Inspect the target (read-only)
Find and note:
1. **Framework/bundler:** look for `next.config.*`, `vite.config.*`, `craco.config.*` or `webpack.config.*`, and `package.json` scripts.
2. **UI library and version:** check `package.json` for `@mui/material`. Loupe supports MUI v7+. Note any `@mui/lab` and `@mui/x-*` packages.
3. **Theme:** grep for `createTheme(`. Find the module and export name that hold the final theme. If the theme is built at runtime (e.g. per tenant, or from an API), find the function that builds it: `themeExport` may name a zero-argument function. If it needs arguments, write a small `theme.ts` in the config folder that imports the builder and calls it with representative values, and point `themeEntry` at it with a relative path such as `../../loupe/my-app/theme.ts`. (`themeEntry` resolves from `root`, but absolute paths also work.)
4. **Component folders:** usually `src/components/**`, a `ui/` folder, or a `packages/ui` workspace. Ask the user which folders count as "the design system" if it isn't obvious. Globs resolve from `root`, so a workspace package next to the app is reached with `..`: with `root` at `apps/web`, use `componentGlobs: ["../../packages/ui/src/**/*.tsx"]`. Usages through the package name (`import { Button } from "@acme/ui"`) are found as long as the package's `types`/`main`/`exports` point at its source (`src/index.ts`), not at built `dist/*.d.ts`.
5. **Providers:** read the app's root (`main.tsx`, `_app.tsx`, `app/layout.tsx` or `providers.tsx`) and list every provider other than ThemeProvider and CssBaseline: router, i18n, react-query, redux, auth, feature flags, custom contexts.
6. **Path aliases:** read `tsconfig.json` `compilerOptions.paths`, and any bundler aliases that aren't in tsconfig (those need `vite.resolve.alias`).
7. **Environment reads:** grep for `process.env.` and `import.meta.env.` in component folders.
8. **Non-standard imports:** grep component folders for `.svg`, `.scss`, `.module.css` and `?url`/`?raw` imports.
9. **Monorepo check:** if the target is a workspace (a root `package.json` with `workspaces`, or a `pnpm-workspace.yaml`), set `root` to the specific package that owns `react` (usually the app package, not the monorepo root) — Loupe adds the monorepo's workspace root to Vite's `fs.allow` automatically, so hoisted/linked packages still resolve.

## 2. Write the config folder
Create:
- `loupe.config.ts`: start from the template in `README.md`. Set `presets: ["next"]` for Next.js apps. Add `define` entries for env vars found in step 1.7, with harmless values.
- `Wrapper.tsx`: a default-exported component that renders the providers from step 1.5 around `children`. Use test-friendly versions: `MemoryRouter` instead of `BrowserRouter`, a fresh `QueryClient` with `retry: false`, and a store created with the app's own `makeStore()` if one exists. **Never include a ThemeProvider or CssBaseline**, because Loupe supplies the theme. Import app modules via `@target/...` — bare imports in this file (e.g. `react-i18next`) resolve from the **target's** `node_modules`, not this repo's, as do `react`/`react-dom`/`@mui/*`/`@emotion/*`.
- `tsconfig.json`: copy `examples/fixture-loupe/tsconfig.json` and point its `paths` at the target. Prefer `paths` without `baseUrl` (e.g. `"@target/*": ["../my-app/*"]`, relative to the tsconfig file) — TypeScript 6 deprecates bare `baseUrl`.

## 3. Run doctor
`npm run loupe -- doctor --config <config folder>/loupe.config.ts`
- **Exit 2:** a config error. The message names the field.
- **Exit 1:** the theme failed. Fix `themeEntry`/`themeExport` first.
- **Exit 0 otherwise** — doctor still exits 0 even when components or loupe files fail to load, so don't treat exit code alone as "all clear".
- **✗ rows:** see the troubleshooting table below. Re-run until the remaining ✗ rows are explained.

## 4. Run the viewer and look at every page
`npm run loupe -- dev --config <…>/loupe.config.ts --open`, then visit Overview, each token page, Theme overrides, each component group, Icons and Anomalies. Overview lists load errors. Component cards show import and render errors with a suggested fix. Use the Chrome browser tools if they're available; otherwise ask the user to describe what they see.

The dev server watches the target and `loupeDir` for source changes (ignoring dot-directories and
`node_modules`/`dist`/`build`/`out`/`coverage`) and only triggers a full browser reload when discovery
actually produces a different model — ordinary edits are left to Vite's normal HMR. Set `watch: false` in the
config if saves feel slow on a very large repo (then restart the dev server to pick up new components). Editing `tsconfig.json`
or `package.json` in the target is **not** watched; restart the dev server after changing either.

## 5. Fix failures (troubleshooting)
| Symptom | Fix |
|---|---|
| `Failed to resolve import "@/…"` | The alias isn't in the target tsconfig `paths`. Add `vite: { resolve: { alias: { "@": "<root>/src" } } }`. |
| `Failed to resolve import "next/…"` | Add `presets: ["next"]`. For modules the preset doesn't cover (e.g. `next/headers`), add a shim file in the config folder and map it in `shims`. |
| `process is not defined` / undefined env | Add `define: { "process.env.X": JSON.stringify("…") }`. |
| `.svg` imports as components | Install `vite-plugin-svgr` **in this repo** (`npm i -D vite-plugin-svgr` at the Design Loupe root — it isn't installed by default). Plain `svgr()` only handles `*.svg?react`: for `import Logo from "./logo.svg"` (Next.js) use `svgr({ include: "**/*.svg", svgrOptions: { exportType: "default" } })`; for `import { ReactComponent as Logo }` (CRA) use `exportType: "named", namedExport: "ReactComponent"`. See `docs/config.md`. |
| `[PARSE_ERROR] Unexpected JSX expression` in a `.js` file (CRA) | Vite only parses JSX in `.jsx`/`.tsx`. Add the `jsx-in-js` plugin from `docs/config.md` ("`vite` escape hatch"). Don't set `vite.oxc.lang`: it applies to `.ts`/`.tsx` files too and breaks them. |
| `.scss` | `sass` must be resolvable. Install it in this repo as a devDependency. |
| "Invalid hook call" / two Reacts | The target's React wasn't used. Check that the target has `node_modules`. If the target is a monorepo, set `root` to the package that owns `react`. |
| "useX must be used within XProvider" | Add that provider to `Wrapper.tsx`. |
| A component renders blank | It probably needs data. Write a loupe file with a demo that passes realistic props. |
| A component is missing from the list | docgen didn't recognise it. Check it's exported from a file matched by `componentGlobs`, and that it returns JSX. A per-file docgen failure doesn't hide other components — it shows up as a warning ("Props extraction failed for `<file>`: …") on the Overview page instead. |
| The page is slow on first load | Vite is pre-bundling the target's dependencies into a per-target cache (`node_modules/.vite/loupe-<hash>` in this repo). Wait for it, or add heavy dependencies to `vite.optimizeDeps.include`. If the pre-bundle looks stale or wrong after a dependency change in the target, delete that `loupe-<hash>` folder to force a fresh one. |

## 6. Enrich (optional; ask the user first)
- For components showing "Needs a demo", create `components/<Name>.loupe.tsx` using the snippet the card offers.
- Ask the user whether they want tiers (atoms → organelles). If so, add `tier` to each loupe file.
- Review Anomalies with the user. Record decisions in `anomalies.ts`, reusing the codes shown.

## Don'ts
- Don't edit, format or install anything in the target repo without explicit permission.
- Don't commit the config folder into the target repo.
- Don't copy token values into loupe files. Loupe reads them live.
