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
