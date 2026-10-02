import { TIERS, type ComponentDocInput, type ComponentInfo, type Tier } from "@designloupe/core";

export interface ComponentGroup { key: string; label: string; items: ComponentInfo[] }

const TIER_LABEL: Record<Tier, string> = { atom: "Atoms", molecule: "Molecules", macromolecule: "Macromolecules", organelle: "Organelles" };

function commonPrefix(folders: string[]): string {
  if (!folders.length) return "";
  const split = folders.map((f) => f.split("/"));
  const first = split[0]!;
  let i = 0;
  while (i < first.length - 1 && split.every((s) => s[i] === first[i])) i++;
  return first.slice(0, i).join("/");
}

export function groupComponents(components: ComponentInfo[], docs: Map<string, ComponentDocInput>): ComponentGroup[] {
  const visible = components.filter((c) => !docs.get(c.id)?.hidden).sort((a, b) => a.name.localeCompare(b.name));
  const tiered = [...docs.values()].some((d) => d.tier);
  if (tiered) {
    const groups: ComponentGroup[] = TIERS.map((t) => ({ key: t, label: TIER_LABEL[t], items: visible.filter((c) => docs.get(c.id)?.tier === t) }));
    groups.push({ key: "unsorted", label: "Unsorted", items: visible.filter((c) => !docs.get(c.id)?.tier) });
    return groups.filter((g) => g.items.length);
  }
  const folders = [...new Set(visible.map((c) => c.folder))].sort();
  const prefix = commonPrefix(folders);
  const strip = (f: string) => (prefix && f.startsWith(prefix + "/") ? f.slice(prefix.length + 1) : f) || f;
  return folders.map((f) => ({ key: f, label: strip(f), items: visible.filter((c) => c.folder === f) }));
}
