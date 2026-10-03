import type { OverrideEntry } from "@designloupe/core";
import { serialise } from "./serialise";

type Obj = Record<string, unknown>;

export function readOverrides(themeIn: unknown): OverrideEntry[] {
  const components = ((themeIn as Obj).components ?? {}) as Record<string, Obj>;
  return Object.entries(components)
    .map(([key, def]): OverrideEntry => {
      const e: OverrideEntry = { key, component: key.replace(/^Mui/, "") };
      // One odd entry (a throwing getter, say) is reported in place rather than failing the whole theme.
      try {
        if (def.defaultProps !== undefined) e.defaultProps = serialise(def.defaultProps);
        if (def.styleOverrides !== undefined) e.styleOverrides = serialise(def.styleOverrides);
        if (Array.isArray(def.variants) && def.variants.length)
          e.variants = (def.variants as Obj[]).map((v) => ({ props: serialise(v.props), style: serialise(v.style) }));
      } catch (err) {
        return { key, component: e.component, styleOverrides: `/* Could not read this override: ${err instanceof Error ? err.message : String(err)} */` };
      }
      return e;
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}
