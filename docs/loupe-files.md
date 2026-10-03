# Loupe files

Loupe files are hand-written TypeScript/TSX that live in `loupeDir` (outside the target repo), and are picked
up automatically:

- `*.loupe.{ts,tsx}` — one `defineComponentDoc(...)` each, matched to a discovered component.
- `anomalies.{ts,tsx}` — one `defineAnomalies([...])`, your manual anomaly entries plus status overrides for automatic findings.
- `tokens.{ts,tsx}` — one `defineTokenNotes({...})`, free-text notes against token paths.

All three are plain re-exports (`defineComponentDoc`, `defineAnomalies`, `defineTokenNotes` just return their
argument) — they exist for type-checking and editor autocomplete, from `@designloupe/core`.

## `defineComponentDoc` (`ComponentDocInput`)

```ts
// examples/fixture-loupe/components/PrimaryButton.loupe.tsx
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

Note: in MUI 9.4, `Stack` no longer has `alignItems`/`justifyContent` props directly — use `sx={{ alignItems: "center" }}`
in demos that need to align stack items (the fixture app's `EmptyState.tsx` does this).

Fields of `ComponentDocInput`:

| Field | Type | Purpose |
|---|---|---|
| `component` | `string` | **Required.** File path relative to the target root, optionally with `#ExportName` for files exporting more than one component, e.g. `"src/x.tsx"` or `"src/x.tsx#Name"`. Matches a discovered component by file (and export, if given). |
| `tier` | `"atom" \| "molecule" \| "macromolecule" \| "organelle"` (optional) | Design-system tier. Setting a `tier` on **any** loupe file switches the Components page's grouping from folder-based to tier-based for all components. |
| `notes` | `string` (optional) | Free-text usage notes, shown on the component's card. |
| `hidden` | `boolean` (optional) | Hide the component from the Components list (e.g. deprecated or internal-only components still matched by `componentGlobs`). |
| `demo` | `() => ReactNode` (optional) | A live demo rendered inside `<Preview>`. Without one, the card shows a "Needs a demo" prompt with a starter snippet. |
| `a11y` | `A11yDoc` (optional) | Accessibility documentation — see below. |

### `component` matching rules

- `"src/components/PrimaryButton.tsx"` matches the (single) component discovered from that file.
- `"src/components/Icons.tsx#ArrowIcon"` matches the `ArrowIcon` export from a file with multiple components.

### Tiers

Tiers run atom → molecule → macromolecule → organelle. Leave `tier` off every loupe file and the Components
page groups by folder; set it on any one component and the whole page switches to tier-based grouping (any
component without a `tier` falls into an "unsorted" group).

### `hidden`

Set `hidden: true` to keep a discovered component out of the Components list without removing it from
`componentGlobs` — useful for components still being migrated or deliberately undocumented.

## `a11y` (`A11yDoc`)

| Field | Type | Purpose |
|---|---|---|
| `pattern` | `ApgPattern` (optional) | A WAI-ARIA APG pattern key this component implements (see list below). Rendered as a link to the APG page. |
| `role` | `string` (optional) | The component's accessible role. |
| `name` | `string` (optional) | How the accessible name is derived, e.g. `"Text content"` or `"aria-label"`. |
| `keyboard` | `{ keys: string; does: string }[]` (optional) | Keyboard interaction table rows. |
| `checks` | `WcagCheck[]` (optional) | WCAG success-criterion checks — see below. |

### APG patterns (`ApgPattern` keys)

`button`, `checkbox`, `combobox`, `dialog-modal`, `alertdialog`, `disclosure`, `link`, `listbox`,
`menu-button`, `menu`, `radio-group`, `slider`, `slider-multithumb`, `switch`, `tabs`, `tooltip`, `landmarks`.

### WCAG checks (`WcagCheck`)

Each check is either an evidence-based claim or a live contrast measurement — a check object has exactly
one of `status` or `measure`:

```ts
// Evidence-based: you assert the outcome and say why.
{ sc: "2.1.1", status: "inherited", evidence: "MUI ButtonBase renders a native <button>." }

// Measured: Loupe computes the contrast ratio live from the theme, against the sc's threshold.
{ sc: "1.4.3", measure: { fg: "palette.primary.contrastText", bg: "palette.primary.main", kind: "text", label: "label on fill" } }
```

`status` is one of `"pass" | "inherited" | "partial" | "fail"`. `sc` is a WCAG 2.2 success-criterion number
(e.g. `"1.4.3"`, `"2.1.1"`) — see `packages/core/src/a11y/wcag-meta.ts` for the full set Loupe knows about,
with names, levels and links to the W3C "Understanding" pages.

The `measure` form (`ContrastMeasure`):

| Field | Type | Purpose |
|---|---|---|
| `fg` | `string` | Token path for the foreground colour, e.g. `"palette.primary.contrastText"`. |
| `bg` | `string` | Token path for the background colour, e.g. `"palette.primary.main"`. |
| `kind` | `"text" \| "large-text" \| "ui"` | Which WCAG threshold to apply. |
| `fgAlpha` / `bgAlpha` | `number` (optional) | Opacity to apply to the respective colour before flattening. |
| `over` | `string` (optional) | Token path the (translucent) background sits on; defaults to `palette.background.default`. |
| `label` | `string` (optional) | Label shown next to the measurement (useful when a component has more than one contrast pair, as in the `PrimaryButton` example above). |

Token paths are read live from the theme (e.g. `theme.palette.primary.main`) — never copy a colour value
into a loupe file.

## `defineAnomalies`

```ts
// examples/fixture-loupe/anomalies.ts
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

| Field | Type | Purpose |
|---|---|---|
| `id` | `string` | Stable 4-character id. For a manual anomaly, pick any 4 characters; for overriding an **automatic** finding, reuse its code exactly (see below). |
| `title` | `string` | Short title. |
| `category` | `"color" \| "typography" \| "structure" \| "iconography" \| "motion" \| "external" \| "build"` | Grouping on the Anomalies page. |
| `status` | `"open" \| "intentional" \| "todo" \| "fixed"` | See statuses below. |
| `flaggedBy` | `"system" \| "human"` (optional) | Who raised it; automatic findings set this to `"system"`. |
| `description` | `string` | What's wrong. |
| `locations` | `string[]` | File (optionally `:line`) references. |
| `fix` | `string` (optional) | Suggested remedy. |
| `note` | `string` (optional) | Free-text note, e.g. why something is marked `intentional`. |

### Statuses

- `open` — found, not yet triaged.
- `todo` — triaged, agreed to be a real issue, not yet fixed.
- `intentional` — triaged, decided it's fine as-is (document why in `note`).
- `fixed` — resolved (kept for history/changelog purposes).

Automatic findings (hard-coded colours, raw px spacing, low-contrast palette pairs, components that fail to
render) are generated with a stable 4-character code derived from where they were found. **To mark an
automatic finding `intentional` (or `fixed`/`todo`), add an entry to `defineAnomalies` reusing that exact
code as `id`** — Loupe merges your entry over the automatic one by matching `id`, overriding its status and
note without losing the original description/locations unless you also set them.

## `defineTokenNotes`

```ts
// examples/fixture-loupe/tokens.ts
import { defineTokenNotes } from "@designloupe/core";

export default defineTokenNotes({
  "palette.primary.main": "Forest green. The main action colour.",
  "palette.brand.main": "Upsell orange. Never for destructive actions.",
});
```

A plain `Record<string, string>` from token path (dot-separated, matching the theme's own shape, e.g.
`"palette.primary.main"`, `"typography.h1.fontWeight"`) to a free-text note shown next to that token in the
viewer.

## `tsconfig.json` for the config folder

For editor support (so VS Code/Claude Code resolve `@target/...` and `@designloupe/...` imports in loupe
files, the wrapper, etc.), add a `tsconfig.json` next to `loupe.config.ts`. Copy
`examples/fixture-loupe/tsconfig.json` and point `paths` at the real target — on TypeScript 6/7, prefer
`paths` **without** `baseUrl` (TS 6 deprecates bare `baseUrl`; paths are resolved relative to the tsconfig
file itself when `baseUrl` is omitted):

```json
{
  "extends": "<path to designloupe>/tsconfig.base.json",
  "compilerOptions": {
    "paths": { "@target/*": ["../my-app/*"] },
    "types": ["vite/client"]
  },
  "include": ["."]
}
```

(The fixture's own `tsconfig.json` still sets `"ignoreDeprecations": "6.0"` alongside a `baseUrl: "."`, since
it also needs a `@/*` alias into the fixture's `src`; for a new config folder, omitting `baseUrl` entirely
and writing `paths` relative to the tsconfig file is simpler and avoids the deprecation warning.)
