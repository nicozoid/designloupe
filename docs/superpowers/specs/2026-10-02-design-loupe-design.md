# Design Loupe — Design

**Date:** 2026-10-02
**Status:** Approved in brainstorming, pending spec review

## Purpose

Design Loupe is an open-source, local-only tool that visualises the design system of a React app: tokens, theme customisations, components, icons and anomalies. You point it at a repo on disk and it serves a browser viewer on localhost. It never deploys anything and never modifies the target repo.

It generalises the `/design-system` viewer built for `~/dev/trains2somewhere` (`packages/design-system`). It keeps that viewer's shell, voice and machinery: live values, contrast maths, the anomalies model, the drift check, copy chips, deep links and collapsible panels. It drops everything specific to trains2somewhere: map, logo, iconography gallery, branding and hand-written registries.

**First target:** a work app (code not yet available) that is about 95% a lightly customised MUI 9 and about 5% custom components. Its bundler, theme location and providers are unknown. The tool is built and tested here against a fixture. It will be finished on the work machine with Claude Code, guided by docs shipped in this repo.

## Decisions

| Decision | Choice |
|---|---|
| Attachment | Standalone local tool. The target repo is untouched. |
| Data | Auto-first: tokens, overrides, components, props and usage are discovered. Optional hand-written "loupe files" enrich them. |
| Generality | MUI-first behind a small adapter interface, so a Tailwind/CSS-variable adapter can follow. |
| Loading | A CLI wraps a Vite dev server, driven by `loupe.config.ts`. |
| Delivery | npm-workspaces monorepo, TypeScript, MIT. Clone, `npm i`, run. No npm publishing yet. |

## Architecture

```
designloupe/
├─ packages/
│  ├─ core/        # generic: config schema, discovery, docgen, usage scan, contrast maths, anomaly model + rules
│  ├─ viewer/      # React UI (shell, pages, cards), styled with MUI and its own neutral theme
│  ├─ adapter-mui/ # theme reader, overrides model, ThemeProvider wrapper, "wraps MUI X" detection
│  └─ cli/         # `designloupe` command: dev server, `doctor`
├─ examples/
│  └─ mui-fixture/ # small realistic MUI app used as test target and demo
├─ docs/           # README-linked user docs, docs/claude/onboarding-a-target.md
└─ CLAUDE.md
```

### Config (`loupe.config.ts`)

```ts
import { defineConfig } from "@designloupe/core";

export default defineConfig({
  name: "Work app",
  root: "/abs/path/to/target",            // target repo root
  adapter: "mui",
  themeEntry: "src/theme/index.ts",       // module exporting the theme
  themeExport: "theme",                   // named export; "default" allowed
  componentGlobs: ["src/components/**/*.tsx"],
  ignoreGlobs: ["**/*.test.tsx", "**/*.stories.tsx"],
  usageGlobs: ["src/**/*.{ts,tsx}"],      // scanned for call sites / raw MUI usage / anomalies
  tsconfig: "tsconfig.json",              // for path aliases
  wrapper: "./loupe/Wrapper.tsx",         // optional; relative to config file; providers for previews
  shims: { "next/link": "./loupe/shims/next-link.tsx" }, // module id -> replacement
  loupeDir: "./loupe",                    // optional; loupe files (demos, notes, anomalies)
  define: { "process.env.NEXT_PUBLIC_API": "\"\"" },     // optional Vite defines
});
```

All relative paths in the config resolve against the config file's directory, except `themeEntry`, `componentGlobs`, `ignoreGlobs`, `usageGlobs` and `tsconfig`, which resolve against `root`. The config can therefore live anywhere, e.g. in a personal folder next to the work repo.

### Runtime flow

1. **CLI** (`designloupe dev --config <path>`) loads and validates the config with zod. Each invalid field produces a specific message.
2. **Discovery (Node).** The CLI:
   - globs the components;
   - runs `react-docgen-typescript` against the target tsconfig to get props, defaults, enum unions and descriptions;
   - parses imports with `es-module-lexer` or the TS compiler API to detect `@mui/*` imports and which MUI component each one wraps;
   - scans `usageGlobs` for call sites of each component, raw `@mui/material` and `@mui/icons-material` imports in feature code, and anomaly patterns.

   The output is a serialisable `DiscoveryModel`, exposed to the viewer as a virtual module `virtual:loupe/model`.
3. **Vite** serves the viewer.
   - Target modules are imported through generated virtual modules (`virtual:loupe/components`, `virtual:loupe/theme`, `virtual:loupe/wrapper`, `virtual:loupe/loupe-files`). Each component is a lazy `import()` so failures stay isolated.
   - Aliases come from the target tsconfig (`vite-tsconfig-paths`) plus `shims`.
   - `react`, `react-dom`, `@mui/*` and `@emotion/*` are deduplicated and resolved from the **target's** `node_modules`, so previews use the app's exact MUI version.
   - `server.fs.allow` includes the target root.
4. **Viewer.** The chrome uses the viewer's own MUI theme. Every preview renders inside the adapter's preview provider: the target theme, then `CssBaseline` scoped to the preview, then the user wrapper, then an error boundary. Chrome and target styles do not bleed into each other.

### Adapter interface (core)

```ts
interface DesignSystemAdapter {
  id: string;                                   // "mui"
  readTokens(theme: unknown): TokenModel;       // browser-side: palette, typography, spacing, shape, shadows, zIndex, transitions, breakpoints
  readOverrides(theme: unknown): OverrideModel; // browser-side: per-component defaultProps / styleOverrides / variants
  PreviewProvider: React.ComponentType<{ theme: unknown; mode: "light" | "dark"; children: React.ReactNode }>;
  classifyImport(specifier: string, imported: string): { kind: "ds-lib"; component: string } | null; // node-side: "wraps MUI X"
  libraryName: string;                          // "MUI"
}
```

Everything outside the adapter is library-agnostic.

## Viewer pages

The sidebar has these groups: Overview, Tokens, Components, Icons, Anomalies. There is a light/dark toggle, which drives the target's colour scheme in previews, plus copy chips, deep links (`#/tokens/colour#primary`), collapsible `<details>`-style panels with counts, and simple text search over components and tokens.

- **Overview:** target name, MUI version (read from the target's `node_modules`), counts, and warnings (failed imports or renders, no dark scheme, theme missing).
- **Tokens**
  - **Colour:**
    - palette roles (main/light/dark/contrastText) as swatches with hex values, plus custom palette keys;
    - text, background, divider, action and grey;
    - a WCAG contrast badge for each role pair (main vs. contrastText, text vs. background);
    - light and dark side by side if `colorSchemes` exist.
  - **Typography:** every variant rendered via `<Typography variant>` with measured computed metrics and responsive sizes.
  - **Spacing** ruler, **Shape** (radius), **Shadows** (the 25 elevation tiles), **Z-index** list, **Transitions** (durations and easings with live demos), **Breakpoints** with a live "you are here" marker.
  - **Theme overrides:** each MUI component the theme customises, with its `defaultProps`, `styleOverrides` and `variants` shown as readable code (functions shown as source text), and a side-by-side preview of the default MUI theme versus the target theme.
- **Components**
  - Grouped by folder by default, or by tier when loupe files assign tiers (Atoms / Molecules / Macromolecules / Organelles).
  - Each component section contains:
    - name, a source badge ("wraps MUI Button" / "custom") and the file path;
    - the docgen description, a props table and a demo stage;
    - collapsible panels: Built from, Used in (call sites and count), Theme overrides that apply, Accessibility (only when the loupe file provides it; the trains2somewhere checklist model) and Notes.
  - **Demo resolution order:**
    1. The loupe-file demo.
    2. An auto-render: default props, with up to two enum props (e.g. `variant` × `size`) expanded into a grid. `children` gets the component name as a string if it is typed as `ReactNode`.
    3. If required props lack defaults and are not auto-fillable (string, number, boolean, enum, ReactNode), a "needs a demo" card with a loupe-file snippet to copy.
  - **MUI used directly:** raw `@mui/material` imports in feature code, counted per MUI component, each with its call sites.
- **Icons:** `@mui/icons-material` imports and custom SVG icon components (components whose name ends in `Icon` or that render `SvgIcon`), shown in a grid with name, usage count and copy chip.
- **Anomalies**
  - **Hand-written:** the trains2somewhere model (stable 4-character base36 code, category, status `open|intentional|todo|fixed`, locations, suggested fix), from loupe files.
  - **Automatic:**
    - hard-coded colour literals (hex, rgb, hsl) in `sx`, `styled` or `style`;
    - raw px values in spacing properties;
    - palette pairs below AA;
    - component import or render failures.
  - **Automatic code stability:** each automatic finding gets a deterministic code (a hash of rule, file and normalised snippet). An `intentional` status set in a loupe file sticks to that code.

## Loupe files

Loupe files are plain TS/TSX in `loupeDir`, typed by `@designloupe/core`.

```ts
// loupe/components/PrimaryButton.loupe.tsx
import { defineComponentDoc } from "@designloupe/core";
import { PrimaryButton } from "@target/components/PrimaryButton";

export default defineComponentDoc({
  component: "src/components/PrimaryButton.tsx", // matches discovered file
  tier: "atom",
  notes: "Use for the single main action on a page.",
  demo: () => <PrimaryButton>Save</PrimaryButton>,
  a11y: { pattern: "button", keyboard: [["Enter / Space", "activate"]] },
});
```

- `@target/*` is an alias for the target root.
- `loupe/anomalies.ts` exports `defineAnomalies([...])`.
- `loupe/tokens.ts` can add descriptions to token paths (`"palette.primary.main": "Brand blue…"`).

## Code reused from trains2somewhere

The following is ported from `~/dev/trains2somewhere/packages/design-system`, rewritten without Tailwind/shadcn and with app-specific content removed:

- the shell layout and sidebar behaviour;
- the copyable code chip;
- the `toHex` canvas conversion;
- the a11y/WCAG contrast maths and its tests;
- the anomaly model;
- the breakpoint "you are here" strip;
- the motion demo pattern;
- the component-section card structure (header, stage, collapsible panels);
- the drift-check idea, now automatic, since discovery is the catalogue;
- the voice and working principles in `CLAUDE.md`.

Dropped: Tailwind/`cn`, cva variant metadata, Radix "built from" links, the `next-themes` class observer, `gen-app-source.mjs`, the map, logo and iconography pages, and the `isPublic` filtering. `isPublic` can return as loupe-file `hidden: true`.

## Error handling

- **Startup.** Config validation errors name the field. A theme that fails to import makes the viewer start in degraded mode (components and props, no tokens) and shows a banner with the error.
- **Per module.** Each component is imported lazily. Import failures (unknown loader, Next-only API, missing env) appear on that component's card with the error and a suggested fix: a shim for a missing module, `define` for `process.env`, or the wrapper for a missing context.
- **Per render.** An error boundary around each demo. A failure appears in the card and in Overview warnings.
- **`designloupe doctor --config <path>`** runs discovery, then headlessly imports every target module through Vite's `ssrLoadModule` to catch resolution errors, and prints a table of OK and failing entries with suggested fixes. It exits non-zero on config or theme failure.

## Testing

- **Vitest unit tests (core, adapter-mui):** config validation, MUI-wrap classification, usage scanning, anomaly rules and codes, contrast maths (ported tests), token reading against fixture themes, enum-grid demo generation.
- **Integration:** run discovery against `examples/mui-fixture` and assert the model (component count, the wrap/custom split, planted anomalies found, usage counts).
- **Playwright smoke test:** start the CLI against the fixture and visit every page with no unexpected console errors. The deliberately broken fixture component shows an error card, not a crash.
- **The fixture covers:**
  - a custom theme with `colorSchemes` (light and dark), custom palette key, custom typography variant, component overrides and custom variants;
  - wrapped components (Button, TextField, Card) and custom components (StatusPill, EmptyState);
  - a component needing a router context, one using i18n, and one importing `next/link` (shimmed);
  - a tsconfig path alias;
  - one component that throws on render;
  - hard-coded colours and px values in `sx`;
  - raw `@mui/material` usage in a "feature" page;
  - `@mui/icons-material` usage and one custom SVG icon.

## Docs

- `README.md`: what it is, a screenshot, quick start (`npm i && npm run loupe:fixture`), a summary of config and loupe files, and the "local only, never modifies your repo" promise.
- `CLAUDE.md`: architecture, package boundaries (adapter isolation; the viewer never imports target code except through virtual modules), working rules adapted from the trains2somewhere design-system `CLAUDE.md`, and how to run the tests.
- `docs/claude/onboarding-a-target.md`: the playbook for Claude Code on a new machine or target:
  1. inspect the target (bundler, theme file, providers, aliases, env usage);
  2. create a config folder outside the target repo;
  3. write `loupe.config.ts` and `Wrapper.tsx`;
  4. run `doctor`;
  5. fix failures using the troubleshooting table;
  6. add loupe files for components showing "needs a demo";
  7. what not to do (never edit the target repo without asking).
- `docs/config.md`, `docs/loupe-files.md` and `docs/adapters.md` (how to write a new adapter).

## Plan-time amendments (2026-10-02)

These came out of writing the implementation plan. They override the sections above where they differ.

1. **The viewer chrome uses plain CSS (`dl-` classes, `--dl-*` variables), not MUI.**
   - MUI `sx`/`styled` resolve against the *nearest* ThemeProvider. Chrome rendered inside the target's theme would pick up the target's styles.
   - Nesting ThemeProviders with CSS-variable themes and colour-scheme managers is fragile.
   - With plain-CSS chrome, one target `PreviewRoot` (target ThemeProvider + colour-scheme sync + user wrapper) wraps the whole viewer. Each preview gets `ScopedCssBaseline` and an error boundary. Chrome and target never share styling.
2. **TypeScript is pinned to 6.0.3 repo-wide.** TS 7 (the native port) has no classic JS compiler API, which `react-docgen-typescript` and the import/JSX scanner need. This is independent of the target's TypeScript version.
3. **`@designloupe/core` is split:**
   - `@designloupe/core`: browser-safe types, `define*` helpers, a11y maths, demo planning, anomaly merge.
   - `@designloupe/core/node`: config loading, discovery, static rules.

   The adapter is split the same way: `@designloupe/adapter-mui/node` and `@designloupe/adapter-mui/browser`.
4. **Two config additions for unknown builds:**
   - `presets: ["next"]` turns on built-in shims for `next/link`, `next/image`, `next/navigation`, `next/router`, `next/dynamic`, `next/head` and `next/font/*`.
   - `vite: {...}` is an escape hatch merged into the Vite config, for plugins such as SVGR or sass.
   - Defaults define `process.env.NODE_ENV` and `process.env` so CRA/Next-style env reads don't crash.
5. **Shared packages resolve from the target.**
   - `react`, `react-dom`, `@mui/*` and `@emotion/*` imported by the viewer, adapter or loupe files resolve from the target root. A Vite `resolveId` plugin re-resolves them with the target as importer, so one copy is shared and package `exports` maps are respected.
   - `@designloupe/*` imported from loupe files outside this repo resolve to this repo.
   - `@target/*` is an alias for the target root.
6. **Anomaly category `build`** is added for automatic import/render failures. Automatic codes are 4-character base36 values from an FNV-1a hash of `rule|file|snippet`.
7. **Routing is hash-based** (`#/tokens/colour`, `#/components/<group>/<Name>`), with no router dependency in the viewer.

## Out of scope (for now)

- Publishing to npm.
- Non-MUI adapters (only the interface exists).
- A static-site export.
- Props-editing controls (Storybook-style knobs).
- Figma sync.
- Search beyond simple text filtering.
