import { it, expect } from "vitest";
import { mergeAnomalies } from "./merge";
import type { Anomaly } from "../loupe-files";

const auto: Anomaly[] = [
  { id: "aaaa", title: "Hard-coded colour", category: "color", status: "open", flaggedBy: "system", description: "d", locations: ["src/a.tsx:3"] },
  { id: "bbbb", title: "Raw px", category: "structure", status: "open", flaggedBy: "system", description: "d", locations: ["src/b.tsx:4"] },
];
const authored: Anomaly[] = [
  { id: "aaaa", title: "ignored", category: "color", status: "intentional", description: "ignored", locations: [], note: "Brand tint, agreed with design." },
  { id: "h001", title: "Two greens", category: "color", status: "todo", description: "Two near-identical greens.", locations: ["theme"] },
];

it("authored entries override status/note of matching auto codes and append the rest", () => {
  const m = mergeAnomalies(auto, authored);
  expect(m.map((a) => `${a.id}:${a.status}:${a.flaggedBy}`)).toEqual(["bbbb:open:system", "h001:todo:human", "aaaa:intentional:system"]);
  const a = m.find((x) => x.id === "aaaa")!;
  expect(a.title).toBe("Hard-coded colour");
  expect(a.locations).toEqual(["src/a.tsx:3"]);
  expect(a.note).toBe("Brand tint, agreed with design.");
});
