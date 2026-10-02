const IDENT = /^[A-Za-z_$][\w$]*$/;

/** Readable JS-ish source for theme values. Functions print as their source text. */
export function serialise(v: unknown, indent = 0): string {
  const pad = "  ".repeat(indent + 1);
  const end = "  ".repeat(indent);
  if (typeof v === "function") return v.toString();
  if (v === undefined) return "undefined";
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return v.length ? `[\n${v.map((x) => pad + serialise(x, indent + 1)).join(",\n")}\n${end}]` : "[]";
  const entries = Object.entries(v as Record<string, unknown>);
  if (!entries.length) return "{}";
  const body = entries.map(([k, x]) => `${pad}${IDENT.test(k) ? k : JSON.stringify(k)}: ${serialise(x, indent + 1)}`).join(",\n");
  return `{\n${body}\n${end}}`;
}
