const IMPORT = /import\s+(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*["']next\/font\/(?:google|local)["'];?/g;

/** next/font exports one function per font family, so the names can't be known ahead. Rewrite the import into consts. */
export function rewriteNextFontImports(code: string): string | null {
  if (!/["']next\/font\//.test(code)) return null;
  let found = false;
  const out = code.replace(IMPORT, (_m, def: string | undefined, named: string | undefined) => {
    found = true;
    const locals: string[] = [];
    if (def) locals.push(def);
    for (const part of (named ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
      const m = /^(\w+)(?:\s+as\s+(\w+))?$/.exec(part);
      if (m) locals.push(m[2] ?? m[1]!);
    }
    return locals.map((l) => `const ${l} = __loupeFont;`).join(" ");
  });
  return found ? `import { loupeFont as __loupeFont } from "virtual:loupe/next-font";\n${out}` : null;
}
