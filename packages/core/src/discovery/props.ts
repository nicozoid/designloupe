import type { ComponentDoc, PropItem } from "react-docgen-typescript";
import type { PropInfo } from "../model";

/** Inherited props worth carrying into the model (demo axes, children, common states). */
const USEFUL_INHERITED = new Set(["children", "variant", "size", "color", "disabled"]);
const NM = /[\\/]node_modules[\\/]/;

const isInherited = (p: PropItem) => {
  const decls = p.declarations?.length ? p.declarations : p.parent ? [p.parent] : [];
  return decls.length > 0 && decls.every((d) => NM.test(d.fileName));
};

function enumValues(p: PropItem): string[] | undefined {
  if (p.type.name !== "enum" || !Array.isArray(p.type.value)) return undefined;
  const vals = (p.type.value as { value: string }[])
    .map((v) => v.value)
    .filter((v) => /^"[^"]*"$/.test(v) || v === "true" || v === "false")
    .map((v) => v.replace(/^"|"$/g, ""));
  return vals.length ? vals : undefined;
}

export function toPropInfo(doc: ComponentDoc): { props: PropInfo[]; inheritedPropCount: number } {
  const own: PropInfo[] = [];
  const inherited: PropInfo[] = [];
  let inheritedPropCount = 0;
  for (const p of Object.values(doc.props)) {
    const inh = isInherited(p);
    if (inh) inheritedPropCount++;
    if (inh && !p.required && !USEFUL_INHERITED.has(p.name)) continue;
    const info: PropInfo = {
      name: p.name,
      type: p.type.name === "enum" ? (p.type.raw ?? "enum") : p.type.name,
      required: p.required,
      inherited: inh,
    };
    if (p.defaultValue?.value !== undefined && p.defaultValue?.value !== null) info.defaultValue = String(p.defaultValue.value);
    if (p.description) info.description = p.description;
    const ev = enumValues(p);
    if (ev) info.enumValues = ev;
    (inh ? inherited : own).push(info);
  }
  inherited.sort((a, b) => a.name.localeCompare(b.name));
  return { props: [...own, ...inherited], inheritedPropCount };
}
