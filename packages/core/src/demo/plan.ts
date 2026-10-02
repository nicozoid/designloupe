import type { PropInfo } from "../model";

export type DemoPlan =
  | { kind: "grid"; base: Record<string, unknown>; axes: { prop: string; values: string[] }[] }
  | { kind: "needs-demo"; missing: string[] };

const INHERITED_AXES = ["variant", "size", "color"];
const isBoolUnion = (v: string[]) => v.length === 2 && v.includes("true") && v.includes("false");
const isEnum = (pr: PropInfo) => !!pr.enumValues && pr.enumValues.length >= 2 && pr.enumValues.length <= 6 && !isBoolUnion(pr.enumValues);
const isFunctionType = (t: string) => t.includes("=>") || /^\(/.test(t) || /Handler|Function/.test(t);
const isNodeType = (t: string) => /ReactNode|ReactElement|JSX\.Element/.test(t);

function fill(pr: PropInfo, name: string): { ok: true; value: unknown } | { ok: false } {
  if (pr.enumValues?.length) return { ok: true, value: isBoolUnion(pr.enumValues) ? false : pr.enumValues[0] };
  if (pr.type === "string") return { ok: true, value: name };
  if (pr.type === "number") return { ok: true, value: 1 };
  if (pr.type === "boolean") return { ok: true, value: false };
  if (isNodeType(pr.type)) return { ok: true, value: name };
  if (isFunctionType(pr.type)) return { ok: true, value: () => {} };
  return { ok: false };
}

export function planAutoDemo(c: { name: string; props: PropInfo[] }): DemoPlan {
  const base: Record<string, unknown> = {};
  const missing: string[] = [];
  for (const pr of c.props) {
    if (!pr.required || pr.defaultValue !== undefined) continue;
    const f = fill(pr, c.name);
    if (f.ok) base[pr.name] = f.value;
    else missing.push(pr.name);
  }
  if (missing.length) return { kind: "needs-demo", missing };

  const children = c.props.find((pr) => pr.name === "children");
  if (children && !("children" in base) && isNodeType(children.type)) base.children = c.name;

  const own = c.props.filter((pr) => !pr.inherited && isEnum(pr));
  const inherited = INHERITED_AXES.map((n) => c.props.find((pr) => pr.inherited && pr.name === n)).filter(
    (pr): pr is PropInfo => !!pr && isEnum(pr),
  );
  const axes = [...own, ...inherited].slice(0, 2).map((pr) => ({ prop: pr.name, values: pr.enumValues! }));
  return { kind: "grid", base, axes };
}
