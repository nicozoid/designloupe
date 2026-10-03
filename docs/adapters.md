# Adapters

Everything specific to a UI library lives in an adapter package (`packages/adapter-<id>`), split into a
Node half (used during discovery, in the CLI) and a browser half (used by the viewer). `packages/core` and
`packages/viewer` never import the library itself (e.g. `@mui/*`) — only an adapter does.

## `AdapterNode` (`packages/core/src/adapter.ts`)

```ts
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
```

## `AdapterBrowser` (`packages/core/src/adapter.ts`)

```ts
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
  /** A small representative render of a library component (for override before/after), or null. */
  sampleFor(component: string, props?: Record<string, unknown>): ReactNode | null;
}
```

(`TokenModel`, `OverrideEntry` and `ContrastPair` — the other shapes these methods return — are also defined
in `packages/core/src/adapter.ts`, alongside these two interfaces.)

The CLI selects the Node adapter (`adapter-mui/node` today) in `packages/cli/src/server.ts`. The browser
adapter is wired in via the `virtual:loupe/adapter` module, which the Vite plugin generates as
`export { default } from "@designloupe/adapter-${config.adapter}/browser";` (`packages/cli/src/vite-plugin.ts`)
— so the viewer only ever imports the adapter indirectly, through that virtual module.

## Adding an adapter

Worked outline for a hypothetical Tailwind/CSS-variables adapter:

1. **Create `packages/adapter-tailwind`** with `src/node.ts` (exporting a default `AdapterNode`) and
   `src/browser.tsx` (exporting a default `AdapterBrowser`). Use `packages/adapter-mui` as the template for
   package layout (`exports: { "./node": "./src/node.ts", "./browser": "./src/browser.tsx" }`, `peerDependencies`
   on the library itself).
2. **Extend the config schema.** In `packages/core/src/config/schema.ts`, change
   `adapter: z.literal("mui").default("mui")` to a union, e.g. `z.enum(["mui", "tailwind"]).default("mui")`.
3. **Select the Node adapter in `packages/cli/src/server.ts`.** Today it's hard-coded:
   `const adapter = muiNode; // only adapter for now; config.adapter is validated as "mui"`. Replace that with
   a lookup keyed by `config.adapter` (e.g. a small `{ mui: muiNode, tailwind: tailwindNode }` map), and import
   each Node adapter package.
4. **Add the adapter's shared packages to `SHARED` in `packages/cli/src/vite-plugin.ts`** if the library needs
   a single shared copy between the viewer and the target (the way MUI/Emotion do today — see
   `docs/config.md` → "Shared packages"). A pure CSS-variables/Tailwind adapter may not need any entries here
   at all, since Tailwind has no runtime object that must be the same instance as the target's.

Nothing else needs to change: `virtual:loupe/adapter` picks up the new browser adapter automatically once
`config.adapter` selects it, and discovery (`@designloupe/core/node`'s `discover()`) is already written against
the `AdapterNode` interface rather than against MUI directly.
