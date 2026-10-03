import { categoryInfo, statusInfo, type Anomaly, type ComponentDocInput } from "@designloupe/core";

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

/**
 * Validate the anomalies file's default export. The Anomalies page indexes categoryInfo/statusInfo and maps
 * `locations`, so a typo there would throw while rendering: drop such entries and say why instead.
 */
export function checkAnomalies(raw: unknown): { anomalies: Anomaly[]; errors: string[] } {
  const p = "anomalies file:";
  if (!Array.isArray(raw)) return { anomalies: [], errors: [`${p} the default export is not an array (use defineAnomalies([...])).`] };
  const anomalies: Anomaly[] = [];
  const errors: string[] = [];
  const str = (v: unknown) => typeof v === "string";
  const optStr = (v: unknown) => v === undefined || str(v);
  raw.forEach((a: Record<string, unknown>, i) => {
    if (!a || typeof a !== "object" || !str(a.id) || !str(a.title) || !str(a.description)) {
      errors.push(`${p} entry #${i + 1} is not an object with a string id, title and description; skipped.`);
      return;
    }
    const bad = (why: string) => errors.push(`${p} ${a.id as string} ${why}; skipped.`);
    if (!Object.hasOwn(categoryInfo, a.category as string)) {
      bad(`has an unknown category ${JSON.stringify(a.category)} (use one of ${Object.keys(categoryInfo).join(", ")})`);
    } else if (!Object.hasOwn(statusInfo, a.status as string)) {
      bad(`has an unknown status ${JSON.stringify(a.status)} (use one of ${Object.keys(statusInfo).join(", ")})`);
    } else if (!Array.isArray(a.locations) || !a.locations.every(str)) {
      bad("needs locations: string[]");
    } else if (!optStr(a.fix) || !optStr(a.note)) {
      bad("has a fix or note that isn't a string");
    } else {
      anomalies.push(a as unknown as Anomaly);
    }
  });
  return { anomalies, errors };
}
