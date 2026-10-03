const IDENT = /^[A-Za-z_$][\w$]*$/;

/** Readable JS-ish source for theme values. Functions print as their source text; a cycle prints as [Circular]. */
export function serialise(v: unknown, indent = 0, ancestors: WeakSet<object> = new WeakSet()): string {
  const pad = "  ".repeat(indent + 1);
  const end = "  ".repeat(indent);
  if (typeof v === "function") return v.toString();
  if (v === undefined) return "undefined";
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? String(v); // bigint, symbol
  if (ancestors.has(v)) return "[Circular]";
  ancestors.add(v);
  try {
    const inner = (x: unknown) => serialise(x, indent + 1, ancestors);
    if (Array.isArray(v)) return v.length ? `[\n${v.map((x) => pad + inner(x)).join(",\n")}\n${end}]` : "[]";
    const entries = Object.entries(v as Record<string, unknown>);
    if (!entries.length) return "{}";
    const body = entries.map(([k, x]) => `${pad}${IDENT.test(k) ? k : JSON.stringify(k)}: ${inner(x)}`).join(",\n");
    return `{\n${body}\n${end}}`;
  } finally {
    ancestors.delete(v); // only the current path counts: the same object twice side by side is not a cycle
  }
}
