import { it, expect } from "vitest";
import type { ComponentInfo, ComponentDocInput } from "@designloupe/core";
import { groupComponents } from "./groups";

const c = (name: string, folder: string): ComponentInfo => ({
  id: `${folder}/${name}.tsx#${name}`, name, exportName: name, file: `${folder}/${name}.tsx`, folder,
  source: { kind: "custom" }, props: [], inheritedPropCount: 0, builtFrom: { library: [], own: [] }, usages: [], isIcon: false,
});
const comps = [c("PrimaryButton", "src/components"), c("SparkIcon", "src/components/icons"), c("Broken", "src/components")];

it("groups by folder (common prefix stripped) when no tiers are set", () => {
  const g = groupComponents(comps, new Map());
  expect(g.map((x) => [x.key, x.label, x.items.map((i) => i.name)])).toEqual([
    ["src/components", "components", ["Broken", "PrimaryButton"]],
    ["src/components/icons", "components/icons", ["SparkIcon"]],
  ]);
});

it("groups by tier when any doc sets one, with Unsorted last, and drops hidden components", () => {
  const docs = new Map<string, ComponentDocInput>([
    [comps[0]!.id, { component: comps[0]!.file, tier: "atom" }],
    [comps[2]!.id, { component: comps[2]!.file, hidden: true }],
  ]);
  const g = groupComponents(comps, docs);
  expect(g.map((x) => [x.key, x.label, x.items.map((i) => i.name)])).toEqual([
    ["atom", "Atoms", ["PrimaryButton"]],
    ["unsorted", "Unsorted", ["SparkIcon"]],
  ]);
});
