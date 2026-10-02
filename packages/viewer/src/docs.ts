import type { ComponentDocInput } from "@designloupe/core";

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Turn the settled results of loading every `*.loupe.tsx` file into a docs map, tolerating
 * malformed modules (missing/invalid default export) instead of throwing. Kept free of any
 * `virtual:loupe/*` imports so it can be unit-tested outside the Vite dev server.
 */
export function collectDocs(
  results: PromiseSettledResult<{ default?: ComponentDocInput }>[],
  resolveIds: (component: string) => string[],
): { docs: Map<string, ComponentDocInput>; docErrors: string[] } {
  const docs = new Map<string, ComponentDocInput>();
  const docErrors: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      docErrors.push(`Loupe file #${i + 1}: ${msg(r.reason)}`);
      return;
    }
    const d = r.value?.default;
    if (!d || typeof d.component !== "string") {
      docErrors.push(`Loupe file #${i + 1} has no default export from defineComponentDoc(...).`);
      return;
    }
    const ids = resolveIds(d.component);
    if (!ids.length) docErrors.push(`Loupe file for "${d.component}" matches no discovered component.`);
    for (const id of ids) docs.set(id, d);
  });
  return { docs, docErrors };
}
