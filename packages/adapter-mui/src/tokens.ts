import type { ContrastPair, Mode, PaletteGroup, TokenModel, TypographyToken } from "@designloupe/core";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const SKIP_PALETTE = new Set(["mode", "contrastThreshold", "tonalOffset"]);
const SPACING_FACTORS = [0, 0.5, 1, 2, 3, 4, 5, 6, 8, 10, 12];

function schemePalettes(theme: Obj): { mode: Mode; palette: Obj }[] {
  const cs = theme.colorSchemes;
  if (isObj(cs)) {
    const out: { mode: Mode; palette: Obj }[] = [];
    for (const mode of ["light", "dark"] as const) {
      const s = cs[mode];
      if (isObj(s) && isObj(s.palette)) out.push({ mode, palette: s.palette });
    }
    if (out.length) return out;
  }
  const palette = (theme.palette ?? {}) as Obj;
  return [{ mode: palette.mode === "dark" ? "dark" : "light", palette }];
}

export function paletteGroups(palette: Obj): PaletteGroup[] {
  const groups: PaletteGroup[] = [];
  for (const [key, val] of Object.entries(palette)) {
    if (SKIP_PALETTE.has(key) || key.endsWith("Channel") || /^[A-Z]/.test(key)) continue;
    if (typeof val === "string" && key === "divider") {
      groups.push({ name: "divider", tokens: [{ path: "palette.divider", value: val }] });
      continue;
    }
    if (!isObj(val)) continue;
    const tokens = Object.entries(val)
      .filter(([k, v]) => typeof v === "string" && !k.endsWith("Channel"))
      .map(([k, v]) => ({ path: `palette.${key}.${k}`, value: v as string }));
    if (tokens.length) groups.push({ name: key, tokens });
  }
  return groups;
}

function typographyTokens(typography: Obj): TypographyToken[] {
  const out: TypographyToken[] = [];
  for (const [variant, val] of Object.entries(typography)) {
    if (!isObj(val) || !("fontSize" in val || "fontFamily" in val || "fontWeight" in val)) continue;
    const style: TypographyToken["style"] = {};
    const responsive: TypographyToken["responsive"] = [];
    for (const [k, v] of Object.entries(val)) {
      if (typeof v === "string" || typeof v === "number") style[k] = v;
      else if (k.startsWith("@media") && isObj(v))
        responsive.push({ query: k, style: Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x === "string" || typeof x === "number")) as TypographyToken["style"] });
    }
    out.push({ variant, style, responsive });
  }
  return out;
}

export function readTokens(themeIn: unknown): TokenModel {
  const theme = themeIn as Obj & { spacing: (n: number) => string };
  const t = (theme.transitions ?? {}) as { duration?: Obj; easing?: Obj };
  const bp = (theme.breakpoints ?? {}) as { keys?: string[]; values?: Record<string, number> };
  return {
    schemes: schemePalettes(theme).map(({ mode, palette }) => ({ mode, groups: paletteGroups(palette) })),
    typography: typographyTokens((theme.typography ?? {}) as Obj),
    spacing: SPACING_FACTORS.map((factor) => ({ factor, value: String(theme.spacing(factor)) })),
    shape: Object.entries((theme.shape ?? {}) as Obj)
      .filter(([, v]) => typeof v === "number" || typeof v === "string")
      .map(([name, v]) => ({ name, value: typeof v === "number" ? `${v}px` : (v as string) })),
    shadows: ((theme.shadows ?? []) as string[]).slice(),
    zIndex: Object.entries((theme.zIndex ?? {}) as Obj)
      .filter(([, v]) => typeof v === "number")
      .map(([name, v]) => ({ name, value: v as number }))
      .sort((a, b) => a.value - b.value),
    transitions: {
      durations: Object.entries(t.duration ?? {}).filter(([, v]) => typeof v === "number").map(([name, v]) => ({ name, ms: v as number })),
      easings: Object.entries(t.easing ?? {}).filter(([, v]) => typeof v === "string").map(([name, v]) => ({ name, value: v as string })),
    },
    breakpoints: (bp.keys ?? []).map((name) => ({ name, min: bp.values?.[name] ?? 0 })),
  };
}

export function resolveColour(themeIn: unknown, mode: Mode, path: string): string | undefined {
  const schemes = schemePalettes(themeIn as Obj);
  const palette = (schemes.find((s) => s.mode === mode) ?? schemes[0])!.palette;
  const parts = path.replace(/^palette\./, "").split(".");
  let cur: unknown = palette;
  for (const p of parts) {
    if (!isObj(cur)) return undefined;
    cur = cur[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

export function contrastPairs(themeIn: unknown): ContrastPair[] {
  const pairs: ContrastPair[] = [];
  for (const { mode, palette } of schemePalettes(themeIn as Obj)) {
    for (const g of paletteGroups(palette)) {
      const has = (k: string) => g.tokens.some((t) => t.path === `palette.${g.name}.${k}`);
      if (has("main") && has("contrastText"))
        pairs.push({ mode, label: `${g.name} text on main`, fg: `palette.${g.name}.contrastText`, bg: `palette.${g.name}.main`, kind: "text" });
    }
    for (const [fg, bg] of [["text.primary", "background.default"], ["text.secondary", "background.default"], ["text.primary", "background.paper"]] as const) {
      if (resolveColour(themeIn, mode, `palette.${fg}`) && resolveColour(themeIn, mode, `palette.${bg}`))
        pairs.push({ mode, label: `${fg} on ${bg}`, fg: `palette.${fg}`, bg: `palette.${bg}`, kind: "text" });
    }
  }
  return pairs;
}
