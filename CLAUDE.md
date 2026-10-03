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
